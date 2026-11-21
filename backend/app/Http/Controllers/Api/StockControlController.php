<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StockMovement;
use App\Models\StockSerial;
use App\Models\User;
use App\Services\NumberSeriesService;
use App\Services\ProductInfo;
use App\Services\StockHolds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 9b: stock counts, adjustments (approval), reservations (customer hold). */
class StockControlController extends Controller
{
    private const MIN_REASON = 10;

    private const MAX_RESERVATION = 100;

    private const TARGET = ['damage' => 'damaged', 'quarantine' => 'quarantine', 'release' => 'in_stock'];

    private const ADJUST_FROM = ['damage' => ['in_stock', 'quarantine'], 'quarantine' => ['in_stock'], 'release' => ['quarantine']];

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    private function users(): array
    {
        return User::pluck('name', 'id')->all();
    }

    private function line(string $serial, int $productId): array
    {
        $p = ProductInfo::get($productId);

        return ['serial' => $serial, 'name' => $p['name'], 'sku' => $p['sku']];
    }

    private function reason(?string $text, string $field = 'note'): string
    {
        $r = trim((string) $text);
        if (mb_strlen($r) < self::MIN_REASON) {
            throw ValidationException::withMessages([$field => 'Write a reason of at least '.self::MIN_REASON.' characters.']);
        }

        return $r;
    }

    /** Timeline ke liye (ledger mein nahi aata). */
    private function event(string $serial, int $productId, ?int $warehouseId, string $type, string $ref, ?string $note, int $userId): void
    {
        StockMovement::create(['at' => now(), 'direction' => '-', 'type' => $type, 'serial' => $serial, 'product_id' => $productId,
            'warehouse_id' => $warehouseId, 'ref' => $ref, 'note' => $note, 'user_id' => $userId]);
    }

    // ---------- Counts ----------

    public function counts(): JsonResponse
    {
        $users = $this->users();

        return response()->json(DB::table('stock_counts')->orderByDesc('id')->limit(300)->get()->map(fn ($c) => $this->countOut($c, $users)));
    }

    public function count(int $id): JsonResponse
    {
        $c = DB::table('stock_counts')->find($id);
        abort_unless($c, 404, 'Count not found.');

        return response()->json($this->countOut($c, $this->users()));
    }

    public function storeCount(Request $request): JsonResponse
    {
        $d = $request->validate(['warehouseId' => 'required|integer|exists:warehouses,id', 'note' => 'nullable|string|max:500'],
            ['warehouseId.required' => 'Pick a warehouse.']);
        $id = DB::transaction(function () use ($d, $request) {
            if (DB::table('stock_counts')->where('warehouse_id', $d['warehouseId'])->whereIn('status', ['open', 'submitted'])->lockForUpdate()->exists()) {
                throw ValidationException::withMessages(['warehouseId' => 'This warehouse already has a count in progress.']);
            }
            $expected = StockSerial::where('warehouse_id', $d['warehouseId'])->where('status', 'in_stock')->get(['serial', 'product_id']);
            if ($expected->isEmpty()) {
                throw ValidationException::withMessages(['warehouseId' => 'This warehouse has no stock to count.']);
            }
            $id = DB::table('stock_counts')->insertGetId([
                'number' => $this->numbers->next('stock_count'), 'warehouse_id' => $d['warehouseId'], 'status' => 'open',
                'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('stock_count_lines')->insert($expected->map(fn ($s) => ['stock_count_id' => $id, 'kind' => 'expected', 'serial' => $s->serial, 'product_id' => $s->product_id])->all());
            AuditLog::record($request->user(), 'stock_count.created', null, ['warehouseId' => $d['warehouseId']]);

            return $id;
        });

        return response()->json($this->countOut(DB::table('stock_counts')->find($id), $this->users()), 201);
    }

    public function countAction(Request $request, int $id, string $action): JsonResponse
    {
        $from = ['submit' => 'open', 'approve' => 'submitted', 'reject' => 'submitted'][$action] ?? abort(404);
        DB::transaction(function () use ($request, $id, $action, $from) {
            $c = DB::table('stock_counts')->lockForUpdate()->find($id);
            abort_unless($c, 404, 'Count not found.');
            if ($c->status !== $from) {
                abort(409, "This count cannot be {$action}ed now.");
            }
            $now = now();
            if ($action === 'submit') {
                $wanted = array_values(array_unique(array_filter(array_map([PurchaseController::class, 'normalizeSerial'], (array) $request->input('serials', [])))));
                if (! $wanted) {
                    throw ValidationException::withMessages(['serials' => 'Scan at least one serial.']);
                }
                $known = StockSerial::whereIn('serial', $wanted)->pluck('product_id', 'serial');
                foreach ($wanted as $s) {
                    if (! isset($known[$s])) {
                        throw ValidationException::withMessages(['serials' => "Serial {$s} is not known."]);
                    }
                }
                DB::table('stock_count_lines')->where('stock_count_id', $id)->where('kind', 'counted')->delete();
                DB::table('stock_count_lines')->insert(array_map(fn ($s) => ['stock_count_id' => $id, 'kind' => 'counted', 'serial' => $s, 'product_id' => $known[$s]], $wanted));
                DB::table('stock_counts')->where('id', $id)->update(['status' => 'submitted', 'submitted_at' => $now, 'updated_at' => $now]);
            } elseif ($action === 'approve') {
                DB::table('stock_counts')->where('id', $id)->update(['status' => 'approved', 'decided_at' => $now, 'decided_by' => $request->user()->id, 'updated_at' => $now]);
            } else {
                DB::table('stock_counts')->where('id', $id)->update(['status' => 'rejected', 'reason' => $this->reason($request->input('note')),
                    'decided_at' => $now, 'decided_by' => $request->user()->id, 'updated_at' => $now]);
            }
            AuditLog::record($request->user(), "stock_count.{$action}", null, ['number' => $c->number]);
        });

        return response()->json($this->countOut(DB::table('stock_counts')->find($id), $this->users()));
    }

    private function countOut(object $c, array $users): array
    {
        $lines = DB::table('stock_count_lines')->where('stock_count_id', $c->id)->orderBy('id')->get();
        $iso = fn ($v) => $v ? \Illuminate\Support\Carbon::parse($v)->toIso8601String() : null;

        return [
            'id' => $c->id, 'number' => $c->number, 'warehouseId' => (int) $c->warehouse_id, 'status' => $c->status,
            'expected' => $lines->where('kind', 'expected')->map(fn ($l) => $this->line($l->serial, $l->product_id))->values(),
            'counted' => $lines->where('kind', 'counted')->map(fn ($l) => $this->line($l->serial, $l->product_id))->values(),
            'note' => $c->note, 'reason' => $c->reason, 'createdBy' => $users[$c->created_by] ?? 'System',
            'createdAt' => $iso($c->created_at), 'submittedAt' => $iso($c->submitted_at), 'decidedAt' => $iso($c->decided_at),
        ];
    }

    // ---------- Adjustments ----------

    public function adjustments(): JsonResponse
    {
        $users = $this->users();

        return response()->json(DB::table('stock_adjustments')->orderByDesc('id')->limit(300)->get()->map(fn ($a) => $this->adjustmentOut($a, $users)));
    }

    public function adjustment(int $id): JsonResponse
    {
        $a = DB::table('stock_adjustments')->find($id);
        abort_unless($a, 404, 'Adjustment not found.');

        return response()->json($this->adjustmentOut($a, $this->users()));
    }

    public function storeAdjustment(Request $request): JsonResponse
    {
        $d = $request->validate([
            'kind' => 'required|in:damage,quarantine,release',
            'serials' => 'required|array|min:1|max:200',
            'serials.*' => 'required|string|max:60',
            'reason' => 'required|string|max:500',
        ], ['kind.required' => 'Pick what to do with the stock.', 'kind.in' => 'Pick what to do with the stock.']);
        $reason = $this->reason($d['reason'], 'reason');

        $id = DB::transaction(function () use ($d, $reason, $request) {
            $lines = [];
            foreach (array_unique(array_map([PurchaseController::class, 'normalizeSerial'], $d['serials'])) as $serial) {
                $s = StockSerial::where('serial', $serial)->lockForUpdate()->first();
                if (! $s) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is not known."]);
                }
                if ($s->warehouse_id === null) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is in transit."]);
                }
                if (StockHolds::pendingAdjustment($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} already has a request waiting."]);
                }
                if ($held = StockHolds::reservedRef($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is reserved ({$held}). Release the reservation first."]);
                }
                if (! in_array($s->status, self::ADJUST_FROM[$d['kind']], true)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} cannot be changed from {$s->status}."]);
                }
                $lines[] = ['serial' => $serial, 'product_id' => $s->product_id, 'from_status' => $s->status, 'to_status' => self::TARGET[$d['kind']]];
            }
            $id = DB::table('stock_adjustments')->insertGetId([
                'number' => $this->numbers->next('stock_adjustment'), 'kind' => $d['kind'], 'status' => 'pending', 'reason' => $reason,
                'created_by' => $request->user()->id, 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('stock_adjustment_lines')->insert(array_map(fn ($l) => ['stock_adjustment_id' => $id] + $l, $lines));
            AuditLog::record($request->user(), 'stock_adjustment.requested', null, ['kind' => $d['kind'], 'serials' => count($lines)]);

            return $id;
        });

        return response()->json($this->adjustmentOut(DB::table('stock_adjustments')->find($id), $this->users()), 201);
    }

    public function adjustmentAction(Request $request, int $id, string $action): JsonResponse
    {
        abort_unless(in_array($action, ['approve', 'reject'], true), 404);
        DB::transaction(function () use ($request, $id, $action) {
            $a = DB::table('stock_adjustments')->lockForUpdate()->find($id);
            abort_unless($a, 404, 'Adjustment not found.');
            if ($a->status !== 'pending') {
                abort(409, "This adjustment cannot be {$action}d now.");
            }
            $note = trim((string) $request->input('note', ''));
            $now = now();
            if ($action === 'reject') {
                DB::table('stock_adjustments')->where('id', $id)->update(['status' => 'rejected', 'decision_note' => $this->reason($note),
                    'decided_by' => $request->user()->id, 'decided_at' => $now, 'updated_at' => $now]);
            } else {
                $lines = DB::table('stock_adjustment_lines')->where('stock_adjustment_id', $id)->get();
                foreach ($lines as $l) {
                    $s = StockSerial::where('serial', $l->serial)->lockForUpdate()->first();
                    if (! $s || $s->status !== $l->from_status) {
                        abort(409, "Serial {$l->serial} has changed since this request was made.");
                    }
                }
                foreach ($lines as $l) {
                    $s = StockSerial::where('serial', $l->serial)->first();
                    $s->update(['status' => $l->to_status]);
                    $this->event($l->serial, $l->product_id, $s->warehouse_id, 'adjusted', $a->number, $a->reason, $request->user()->id);
                }
                DB::table('stock_adjustments')->where('id', $id)->update(['status' => 'approved', 'decision_note' => $note ?: null,
                    'decided_by' => $request->user()->id, 'decided_at' => $now, 'updated_at' => $now]);
            }
            AuditLog::record($request->user(), "stock_adjustment.{$action}", null, ['number' => $a->number]);
        });

        return response()->json($this->adjustmentOut(DB::table('stock_adjustments')->find($id), $this->users()));
    }

    private function adjustmentOut(object $a, array $users): array
    {
        $iso = fn ($v) => $v ? \Illuminate\Support\Carbon::parse($v)->toIso8601String() : null;

        return [
            'id' => $a->id, 'number' => $a->number, 'kind' => $a->kind, 'status' => $a->status,
            'lines' => DB::table('stock_adjustment_lines')->where('stock_adjustment_id', $a->id)->orderBy('id')->get()
                ->map(fn ($l) => $this->line($l->serial, $l->product_id) + ['from' => $l->from_status, 'to' => $l->to_status])->values(),
            'reason' => $a->reason, 'decisionNote' => $a->decision_note, 'createdBy' => $users[$a->created_by] ?? 'System',
            'createdAt' => $iso($a->created_at), 'decidedAt' => $iso($a->decided_at),
        ];
    }

    // ---------- Reservations ----------

    public function reservations(): JsonResponse
    {
        $users = $this->users();

        return response()->json(DB::table('reservations')->orderByDesc('id')->limit(300)->get()->map(fn ($r) => $this->reservationOut($r, $users)));
    }

    public function reservation(int $id): JsonResponse
    {
        $r = DB::table('reservations')->find($id);
        abort_unless($r, 404, 'Reservation not found.');

        return response()->json($this->reservationOut($r, $this->users()));
    }

    public function storeReservation(Request $request): JsonResponse
    {
        $d = $request->validate([
            'customerName' => 'required|string|min:2|max:100',
            'note' => 'nullable|string|max:500',
            'holdUntil' => 'nullable|date|after_or_equal:today',
            'serials' => 'required|array|min:1|max:'.self::MAX_RESERVATION,
            'serials.*' => 'required|string|max:60',
        ], [
            'customerName.required' => 'Enter the customer name.', 'customerName.min' => 'Enter the customer name.',
            'holdUntil.after_or_equal' => 'The hold date cannot be in the past.',
            'serials.max' => 'Too many serials ('.self::MAX_RESERVATION.' max).',
        ]);

        $id = DB::transaction(function () use ($d, $request) {
            $lines = [];
            foreach (array_unique(array_filter(array_map([PurchaseController::class, 'normalizeSerial'], $d['serials']))) as $serial) {
                $s = StockSerial::where('serial', $serial)->lockForUpdate()->first();
                if (! $s) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is not known."]);
                }
                if ($s->warehouse_id === null) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is in transit."]);
                }
                if ($s->status !== 'in_stock') {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is not available."]);
                }
                if ($held = StockHolds::reservedRef($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is already reserved ({$held})."]);
                }
                if (StockHolds::inOpenTransfer($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is in a transfer."]);
                }
                if (StockHolds::pendingAdjustment($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} already has a request waiting."]);
                }
                $lines[] = $s;
            }
            $number = $this->numbers->next('reservation');
            $customer = trim($d['customerName']);
            $id = DB::table('reservations')->insertGetId([
                'number' => $number, 'customer_name' => $customer, 'note' => trim($d['note'] ?? '') ?: null,
                'hold_until' => $d['holdUntil'] ?? null, 'status' => 'active', 'created_by' => $request->user()->id,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($lines as $s) {
                DB::table('reservation_lines')->insert(['reservation_id' => $id, 'serial' => $s->serial, 'product_id' => $s->product_id]);
                $this->event($s->serial, $s->product_id, $s->warehouse_id, 'reserved', $number, "For {$customer}", $request->user()->id);
            }
            AuditLog::record($request->user(), 'reservation.created', null, ['number' => $number, 'serials' => count($lines)]);

            return $id;
        });

        return response()->json($this->reservationOut(DB::table('reservations')->find($id), $this->users()), 201);
    }

    public function releaseReservation(Request $request, int $id): JsonResponse
    {
        DB::transaction(function () use ($request, $id) {
            $r = DB::table('reservations')->lockForUpdate()->find($id);
            abort_unless($r, 404, 'Reservation not found.');
            $state = $this->state($r);
            if ($state === 'released') {
                abort(409, 'This reservation is already released.');
            }
            if ($state === 'expired') {
                abort(409, 'This reservation has already expired.');
            }
            DB::table('reservations')->where('id', $id)->update(['status' => 'released', 'released_at' => now(), 'updated_at' => now()]);
            foreach (DB::table('reservation_lines')->where('reservation_id', $id)->get() as $l) {
                $this->event($l->serial, $l->product_id, StockSerial::where('serial', $l->serial)->value('warehouse_id'), 'released', $r->number, null, $request->user()->id);
            }
            AuditLog::record($request->user(), 'reservation.released', null, ['number' => $r->number]);
        });

        return response()->json($this->reservationOut(DB::table('reservations')->find($id), $this->users()));
    }

    private function state(object $r): string
    {
        if ($r->status === 'released') {
            return 'released';
        }

        return $r->hold_until !== null && (string) $r->hold_until < now()->toDateString() ? 'expired' : 'active';
    }

    private function reservationOut(object $r, array $users): array
    {
        $iso = fn ($v) => $v ? \Illuminate\Support\Carbon::parse($v)->toIso8601String() : null;

        return [
            'id' => $r->id, 'number' => $r->number, 'customerName' => $r->customer_name, 'note' => $r->note,
            'holdUntil' => $r->hold_until ? substr((string) $r->hold_until, 0, 10) : null, 'status' => $this->state($r),
            'lines' => DB::table('reservation_lines')->where('reservation_id', $r->id)->orderBy('id')->get()
                ->map(fn ($l) => $this->line($l->serial, $l->product_id))->values(),
            'createdBy' => $users[$r->created_by] ?? 'System', 'createdAt' => $iso($r->created_at), 'releasedAt' => $iso($r->released_at),
        ];
    }
}
