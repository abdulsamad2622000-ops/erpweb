<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StockMovement;
use App\Models\StockSerial;
use App\Models\StockTransfer;
use App\Models\StockTransferLine;
use App\Models\User;
use App\Services\NumberSeriesService;
use App\Services\ProductInfo;
use App\Services\StockHolds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 9: stock summary, serials (timeline), ledger, warehouse transfers. Serial-based stock. */
class InventoryController extends Controller
{
    private const MIN_REASON = 10;

    private const FROM = [
        'approve' => ['requested'], 'reject' => ['requested'], 'cancel' => ['requested', 'approved'],
        'dispatch' => ['approved'], 'receive' => ['in_transit'],
    ];

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    public function stock(Request $request): JsonResponse
    {
        $q = StockSerial::query()->whereNotNull('warehouse_id')
            ->selectRaw('product_id, warehouse_id, status, count(*) as c')->groupBy('product_id', 'warehouse_id', 'status');
        if ($wh = (int) $request->query('warehouseId')) {
            $q->where('warehouse_id', $wh);
        }
        $rows = [];
        foreach ($q->get() as $r) {
            $key = "{$r->product_id}-{$r->warehouse_id}";
            if (! isset($rows[$key])) {
                $p = ProductInfo::get($r->product_id);
                $rows[$key] = ['productId' => $r->product_id, 'name' => $p['name'], 'sku' => $p['sku'], 'warehouseId' => $r->warehouse_id,
                    'inStock' => 0, 'reserved' => 0, 'quarantine' => 0, 'rejected' => 0, 'returned' => 0, 'damaged' => 0];
            }
            $field = ['in_stock' => 'inStock', 'quarantine' => 'quarantine', 'rejected' => 'rejected', 'returned' => 'returned', 'damaged' => 'damaged'][$r->status] ?? null;
            if ($field) {
                $rows[$key][$field] += (int) $r->c;
            }
        }
        // In-stock mein se kitne reserved hain
        $inStock = StockSerial::whereNotNull('warehouse_id')->where('status', 'in_stock')->when($wh = (int) $request->query('warehouseId'), fn ($q) => $q->where('warehouse_id', $wh))->get(['serial', 'product_id', 'warehouse_id']);
        $held = StockHolds::reservedRefs($inStock->pluck('serial')->all());
        foreach ($inStock as $x) {
            if (isset($held[$x->serial], $rows["{$x->product_id}-{$x->warehouse_id}"])) {
                $rows["{$x->product_id}-{$x->warehouse_id}"]['reserved']++;
            }
        }
        $rows = array_values($rows);
        usort($rows, fn ($a, $b) => strcmp($a['name'], $b['name']));

        return response()->json($rows);
    }

    public function serials(Request $request): JsonResponse
    {
        $q = StockSerial::query()->with(['grn', 'supplier'])->orderByDesc('received_at');
        if ($s = $request->query('status')) {
            $q->where('status', $s);
        }
        if ($term = trim((string) $request->query('q', ''))) {
            $q->where(fn ($w) => $w->where('serial', 'like', "%{$term}%")
                ->orWhereHas('grn', fn ($g) => $g->where('number', 'like', "%{$term}%"))
                ->orWhereHas('product', fn ($p) => $p->where('name', 'like', "%{$term}%")
                    ->orWhereHas('variants', fn ($v) => $v->where('sku', 'like', "%{$term}%"))));
        }

        $list = $q->limit(1000)->get();
        $held = StockHolds::reservedRefs($list->pluck('serial')->all());

        return response()->json($list->map(fn ($s) => $this->serialOut($s, $held[$s->serial] ?? null)));
    }

    public function serial(string $serial): JsonResponse
    {
        $s = StockSerial::with(['grn', 'supplier'])->where('serial', PurchaseController::normalizeSerial(urldecode($serial)))->first();
        abort_unless($s, 404, 'Serial not found.');

        $timeline = StockMovement::where('serial', $s->serial)->orderBy('at')->orderBy('id')->get()->map(fn ($m) => [
            'at' => $m->at->toIso8601String(),
            'type' => ['grn' => 'received', 'return' => 'returned', 'transfer_out' => 'transferred_out', 'transfer_in' => 'transferred_in'][$m->type] ?? $m->type, // adjusted | reserved | released
            'ref' => $m->ref, 'note' => $m->note,
        ])->values();

        return response()->json($this->serialOut($s, StockHolds::reservedRef($s->serial)) + ['timeline' => $timeline]);
    }

    private function serialOut(StockSerial $s, ?string $reservedRef = null): array
    {
        $p = ProductInfo::get($s->product_id);

        return [
            'serial' => $s->serial, 'productId' => $s->product_id, 'name' => $p['name'], 'sku' => $p['sku'],
            'warehouseId' => (int) ($s->warehouse_id ?? 0), 'status' => $s->status, 'grnNumber' => (string) $s->grn?->number,
            'supplierName' => (string) $s->supplier?->name, 'receivedAt' => $s->received_at?->toIso8601String(),
            'reservedRef' => $reservedRef,
        ];
    }

    public function ledger(Request $request): JsonResponse
    {
        // Sirf asli aana-jaana (reserve/adjust timeline ke liye hain, ledger ke nahi)
        $q = StockMovement::query()->whereIn('direction', ['in', 'out'])->orderByDesc('at')->orderByDesc('id');
        if ($wh = (int) $request->query('warehouseId')) {
            $q->where('warehouse_id', $wh);
        }

        return response()->json($q->limit(2000)->get()->map(fn ($m) => [
            'id' => (string) $m->id, 'at' => $m->at->toIso8601String(), 'direction' => $m->direction, 'serial' => $m->serial,
            'productName' => ProductInfo::get($m->product_id)['name'], 'ref' => $m->ref, 'warehouseId' => (int) $m->warehouse_id,
        ]));
    }

    // ---------- Transfers ----------

    public function transfers(): JsonResponse
    {
        $users = User::pluck('name', 'id');

        return response()->json(StockTransfer::with('lines')->orderByDesc('id')->limit(500)->get()->map(fn ($t) => $this->transferOut($t, $users)));
    }

    public function transfer(StockTransfer $transfer): JsonResponse
    {
        return response()->json($this->transferOut($transfer, User::pluck('name', 'id')));
    }

    public function storeTransfer(Request $request): JsonResponse
    {
        $d = $request->validate([
            'fromWarehouseId' => 'required|integer|exists:warehouses,id',
            'toWarehouseId' => 'required|integer|exists:warehouses,id|different:fromWarehouseId',
            'serials' => 'required|array|min:1|max:500',
            'serials.*' => 'required|string|max:60',
            'note' => 'nullable|string|max:500',
        ], ['toWarehouseId.different' => 'The two warehouses must be different.']);
        $actor = $request->user();

        $t = DB::transaction(function () use ($d, $actor) {
            $lines = [];
            foreach ($d['serials'] as $raw) {
                $serial = PurchaseController::normalizeSerial($raw);
                $s = StockSerial::where('serial', $serial)->lockForUpdate()->first();
                if (! $s) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is not in stock."]);
                }
                if ($s->status !== 'in_stock') {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is not available."]);
                }
                if ($held = StockHolds::reservedRef($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is reserved ({$held}). Release the reservation first."]);
                }
                if ((int) $s->warehouse_id !== (int) $d['fromWarehouseId']) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is in another warehouse."]);
                }
                $open = StockTransferLine::where('serial', $serial)
                    ->whereHas('transfer', fn ($q) => $q->whereIn('status', ['requested', 'approved']))->exists();
                if ($open || isset($lines[$serial])) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is already in a transfer."]);
                }
                $lines[$serial] = $s->product_id;
            }
            $t = StockTransfer::create([
                'number' => $this->numbers->next('transfer'), 'from_warehouse_id' => $d['fromWarehouseId'], 'to_warehouse_id' => $d['toWarehouseId'],
                'status' => 'requested', 'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $actor->id,
            ]);
            foreach ($lines as $serial => $pid) {
                $t->lines()->create(['serial' => $serial, 'product_id' => $pid]);
            }
            AuditLog::record($actor, 'transfer.requested', null, ['number' => $t->number, 'serials' => count($lines)]);

            return $t;
        });

        return response()->json($this->transferOut($t->fresh(), User::pluck('name', 'id')), 201);
    }

    public function transferAction(Request $request, StockTransfer $transfer, string $action): JsonResponse
    {
        abort_unless(isset(self::FROM[$action]), 404);
        $actor = $request->user();

        DB::transaction(function () use ($request, $transfer, $action, $actor) {
            $t = StockTransfer::whereKey($transfer->id)->lockForUpdate()->first();
            if (! in_array($t->status, self::FROM[$action], true)) {
                abort(409, "This transfer cannot be {$action}".(str_ends_with($action, 'e') ? 'd' : 'ed').' now.');
            }
            $now = now();
            if ($action === 'approve') {
                $t->update(['status' => 'approved']);
            } elseif ($action === 'cancel') {
                $t->update(['status' => 'cancelled']);
            } elseif ($action === 'reject') {
                $reason = trim((string) $request->input('note', ''));
                if (mb_strlen($reason) < self::MIN_REASON) {
                    throw ValidationException::withMessages(['note' => 'Write a reason of at least '.self::MIN_REASON.' characters.']);
                }
                $t->update(['status' => 'rejected', 'reason' => $reason]);
            } elseif ($action === 'dispatch') {
                foreach ($t->lines as $l) {
                    $s = StockSerial::where('serial', $l->serial)->lockForUpdate()->first();
                    if (! $s || $s->status !== 'in_stock' || (int) $s->warehouse_id !== (int) $t->from_warehouse_id) {
                        throw ValidationException::withMessages(['serials' => "Serial {$l->serial} is no longer available in the source warehouse."]);
                    }
                    $s->update(['warehouse_id' => null]);
                    StockMovement::create(['at' => $now, 'direction' => 'out', 'type' => 'transfer_out', 'serial' => $l->serial, 'product_id' => $l->product_id,
                        'warehouse_id' => $t->from_warehouse_id, 'ref' => $t->number, 'note' => null, 'user_id' => $actor->id]);
                }
                $t->update(['status' => 'in_transit', 'dispatched_at' => $now]);
            } elseif ($action === 'receive') {
                $got = array_unique(array_map([PurchaseController::class, 'normalizeSerial'], (array) $request->input('serials', [])));
                if (! $got) {
                    throw ValidationException::withMessages(['serials' => 'Scan at least one serial.']);
                }
                $inTransfer = $t->lines->pluck('serial')->all();
                foreach ($got as $serial) {
                    if (! in_array($serial, $inTransfer, true)) {
                        throw ValidationException::withMessages(['serials' => "Serial {$serial} is not in this transfer."]);
                    }
                }
                foreach ($t->lines as $l) {
                    if (in_array($l->serial, $got, true)) {
                        $l->update(['received' => true]);
                        StockSerial::where('serial', $l->serial)->update(['warehouse_id' => $t->to_warehouse_id]);
                        StockMovement::create(['at' => $now, 'direction' => 'in', 'type' => 'transfer_in', 'serial' => $l->serial, 'product_id' => $l->product_id,
                            'warehouse_id' => $t->to_warehouse_id, 'ref' => $t->number, 'note' => null, 'user_id' => $actor->id]);
                    }
                }
                $t->update(['status' => 'received', 'received_at' => $now]);
            }
            AuditLog::record($actor, 'transfer.'.$action, null, ['number' => $t->number]);
        });

        return response()->json($this->transferOut($transfer->fresh(), User::pluck('name', 'id')));
    }

    private function transferOut(StockTransfer $t, $users): array
    {
        $t->loadMissing('lines');

        return [
            'id' => $t->id, 'number' => $t->number, 'fromWarehouseId' => $t->from_warehouse_id, 'toWarehouseId' => $t->to_warehouse_id,
            'status' => $t->status, 'note' => $t->note, 'reason' => $t->reason, 'createdBy' => $users[$t->created_by] ?? 'System',
            'createdAt' => $t->created_at?->toIso8601String(), 'dispatchedAt' => $t->dispatched_at?->toIso8601String(),
            'receivedAt' => $t->received_at?->toIso8601String(),
            'lines' => $t->lines->map(function ($l) {
                $p = ProductInfo::get($l->product_id);

                return ['serial' => $l->serial, 'name' => $p['name'], 'sku' => $p['sku']];
            })->values(),
            'receivedSerials' => $t->lines->where('received', true)->pluck('serial')->values(),
        ];
    }
}
