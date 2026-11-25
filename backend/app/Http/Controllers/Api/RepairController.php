<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Memo;
use App\Models\AuditLog;
use App\Services\NumberSeriesService;
use App\Models\StockMovement;
use App\Services\ProductInfo;
use App\Services\StockHolds;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 14: warranty check by serial, repair job cards. */
class RepairController extends Controller
{
    /** Agla status kya ho sakta hai. */
    public const FLOW = [
        'received' => ['diagnosing', 'cancelled'],
        'diagnosing' => ['waiting_parts', 'repairing', 'ready', 'cancelled'],
        'waiting_parts' => ['repairing', 'cancelled'],
        'repairing' => ['waiting_parts', 'ready'],
        'ready' => ['repairing'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    private static function m(float $v): float
    {
        return round($v, 2);
    }

    private static function iso($v): ?string
    {
        return $v ? Carbon::parse($v)->toIso8601String() : null;
    }

    /** Serial se: kahan bika, warranty kab tak. */
    public static function warrantyFor(string $serial): array
    {
        $serial = PurchaseController::normalizeSerial($serial);
        $line = DB::table('sale_lines')->join('sales', 'sales.id', '=', 'sale_lines.sale_id')->where('sale_lines.serial', $serial)
            ->where('sale_lines.returned_qty', 0)->orderByDesc('sales.id')
            ->first(['sale_lines.*', 'sales.number', 'sales.created_at as sold_at', 'sales.customer_id', 'sales.id as sid']);
        $stock = DB::table('stock_serials')->where('serial', $serial)->first();
        $productId = $line->product_id ?? $stock->product_id ?? null;
        $out = ['serial' => $serial, 'productId' => $productId ? (int) $productId : null,
            'productName' => $productId ? ProductInfo::get((int) $productId)['name'] : null,
            'sale' => null, 'warrantyMonths' => 0, 'warrantyUntil' => null, 'warranty' => 'not_ours', 'customer' => null,
            'openJob' => DB::table('repair_jobs')->where('serial', $serial)->whereNotIn('status', ['delivered', 'cancelled'])->value('number')];
        if ($line) {
            $until = $line->warranty_months ? Carbon::parse($line->sold_at)->addMonths((int) $line->warranty_months)->toDateString() : null;
            $c = $line->customer_id ? DB::table('customers')->find($line->customer_id) : null;
            $out = array_merge($out, ['sale' => ['id' => (int) $line->sid, 'number' => $line->number, 'date' => Carbon::parse($line->sold_at)->toDateString()],
                'warrantyMonths' => (int) $line->warranty_months, 'warrantyUntil' => $until,
                'warranty' => $until && $until >= now()->toDateString() ? 'in_warranty' : 'expired',
                'customer' => $c ? ['id' => $c->id, 'name' => $c->name, 'phone' => $c->phone] : null]);
        }

        return $out;
    }

    public function check(string $serial): JsonResponse
    {
        return response()->json(self::warrantyFor(urldecode($serial)));
    }

    private function jobOut(int $id): array
    {
        $j = DB::table('repair_jobs')->find($id);
        abort_unless($j, 404, 'Job card not found.');
        $parts = DB::table('repair_parts')->where('repair_job_id', $id)->orderBy('id')->get();
        $partsTotal = self::m($parts->sum(fn ($p) => $p->qty * $p->unit_price));
        $total = self::m($partsTotal + (float) $j->labour);

        return ['id' => $j->id, 'number' => $j->number, 'serial' => $j->serial, 'productId' => $j->product_id ? (int) $j->product_id : null,
            'device' => $j->device, 'customerId' => $j->customer_id ? (int) $j->customer_id : null, 'customerName' => $j->customer_name,
            'customerPhone' => $j->customer_phone, 'saleNumber' => $j->sale_id ? DB::table('sales')->where('id', $j->sale_id)->value('number') : null,
            'warranty' => $j->warranty, 'warrantyUntil' => $j->warranty_until, 'problem' => $j->problem, 'accessories' => $j->accessories,
            'diagnosis' => $j->diagnosis, 'status' => $j->status, 'next' => self::FLOW[$j->status] ?? [],
            'estimate' => $j->estimate !== null ? (float) $j->estimate : null, 'labour' => (float) $j->labour,
            'parts' => $parts->map(fn ($p) => ['id' => $p->id, 'description' => $p->description, 'qty' => (int) $p->qty, 'unitPrice' => (float) $p->unit_price,
                'serial' => $p->serial])->all(),
            'partsTotal' => $partsTotal, 'total' => $total, 'paid' => (float) $j->paid, 'paidMethod' => $j->paid_method,
            'promisedOn' => $j->promised_on, 'deliveredAt' => self::iso($j->delivered_at),
            'assignedTo' => $j->assigned_to ? ['id' => (int) $j->assigned_to, 'name' => Memo::userName($j->assigned_to)] : null,
            'createdBy' => Memo::userName($j->created_by), 'createdAt' => self::iso($j->created_at),
            'events' => DB::table('repair_events')->where('repair_job_id', $id)->orderBy('id')->get()->map(fn ($e) => ['status' => $e->status,
                'note' => $e->note, 'at' => self::iso($e->at), 'by' => Memo::userName($e->user_id)])->all()];
    }

    public function index(Request $request): JsonResponse
    {
        $q = DB::table('repair_jobs');
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('number', 'like', "%{$v}%")->orWhere('serial', 'like', "%{$v}%")
                ->orWhere('customer_name', 'like', "%{$v}%")->orWhere('customer_phone', 'like', "%{$v}%"));
        }
        if ($v = ApiQuery::param($request, 'status')) {
            $v === 'open' ? $q->whereNotIn('status', ['delivered', 'cancelled']) : $q->where('status', $v);
        }
        $q->orderByDesc('id');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($r) => $this->jobOut((int) $r->id)));
    }

    public function show(int $id): JsonResponse
    {
        return response()->json($this->jobOut($id));
    }

    private function partsRules(): array
    {
        return ['parts' => 'nullable|array|max:50', 'parts.*.description' => 'required|string|max:160', 'parts.*.qty' => 'required|integer|min:1|max:999',
            'parts.*.unitPrice' => 'required|numeric|min:0', 'parts.*.serial' => 'nullable|string|max:40', 'labour' => 'nullable|numeric|min:0', 'estimate' => 'nullable|numeric|min:0',
            'diagnosis' => 'nullable|string|max:1000', 'promisedOn' => 'nullable|date', 'assignedTo' => 'nullable|integer|exists:users,id'];
    }

    public function store(Request $request): JsonResponse
    {
        $d = $request->validate([
            'serial' => 'nullable|string|max:60', 'device' => 'nullable|string|max:160',
            'customerId' => 'nullable|integer|exists:customers,id', 'customerName' => 'nullable|string|max:120',
            'customerPhone' => 'nullable|string|max:30',
            'problem' => 'required|string|min:5|max:1000', 'accessories' => 'nullable|string|max:300',
        ] + $this->partsRules(), ['problem.required' => 'Describe the problem.', 'problem.min' => 'Describe the problem.']);
        $u = $request->user();
        $w = ! empty($d['serial']) ? self::warrantyFor($d['serial']) : null;
        if ($w && $w['openJob']) {
            throw ValidationException::withMessages(['serial' => "This laptop already has an open job card ({$w['openJob']})."]);
        }
        $device = trim($d['device'] ?? '') ?: ($w['productName'] ?? '');
        if ($device === '') {
            throw ValidationException::withMessages(['device' => 'Write the laptop model.']);
        }
        $custId = $d['customerId'] ?? ($w['customer']['id'] ?? null);
        $cust = $custId ? DB::table('customers')->find($custId) : null;
        $name = $cust->name ?? trim($d['customerName'] ?? '');
        $phone = $cust->phone ?? preg_replace('/[^0-9+]/', '', $d['customerPhone'] ?? '');
        if ($name === '' || strlen($phone) < 7) {
            throw ValidationException::withMessages(['customerPhone' => 'Enter the customer name and phone.']);
        }
        $id = DB::transaction(function () use ($d, $u, $w, $device, $custId, $name, $phone) {
            $now = now();
            $id = DB::table('repair_jobs')->insertGetId(['number' => $this->numbers->next('job_card'), 'serial' => $w['serial'] ?? null,
                'product_id' => $w['productId'] ?? null, 'device' => $device, 'customer_id' => $custId, 'customer_name' => $name, 'customer_phone' => $phone,
                'sale_id' => $w['sale']['id'] ?? null, 'warranty' => $w['warranty'] ?? 'not_ours', 'warranty_until' => $w['warrantyUntil'] ?? null,
                'problem' => trim($d['problem']), 'accessories' => trim($d['accessories'] ?? ''), 'status' => 'received',
                'estimate' => $d['estimate'] ?? null, 'promised_on' => $d['promisedOn'] ?? null, 'assigned_to' => $d['assignedTo'] ?? null,
                'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            DB::table('repair_events')->insert(['repair_job_id' => $id, 'status' => 'received', 'note' => null, 'user_id' => $u->id, 'at' => $now]);

            return $id;
        });
        AuditLog::record($u, 'repair.created', null, ['id' => $id]);

        return response()->json($this->jobOut($id), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $d = $request->validate($this->partsRules() + ['problem' => 'nullable|string|min:5|max:1000', 'accessories' => 'nullable|string|max:300']);
        DB::transaction(function () use ($d, $id) {
            $j = DB::table('repair_jobs')->lockForUpdate()->find($id);
            abort_unless($j, 404, 'Job card not found.');
            abort_if(in_array($j->status, ['delivered', 'cancelled'], true), 409, 'This job card is closed.');
            $row = ['updated_at' => now()];
            foreach (['diagnosis' => 'diagnosis', 'estimate' => 'estimate', 'labour' => 'labour', 'promisedOn' => 'promised_on',
                'assignedTo' => 'assigned_to', 'problem' => 'problem', 'accessories' => 'accessories'] as $in => $col) {
                if (array_key_exists($in, $d)) {
                    $row[$col] = is_string($d[$in]) ? trim($d[$in]) : $d[$in];
                }
            }
            if (array_key_exists('labour', $row) && $row['labour'] === null) {
                $row['labour'] = 0;
            }
            DB::table('repair_jobs')->where('id', $id)->update($row);
            if (array_key_exists('parts', $d)) {
                $this->saveParts($j, $d['parts'] ?? [], request()->user());
            }
        });

        return response()->json($this->jobOut($id));
    }

    /**
     * Parts dobara likho. Serial wala part stock se nikalta hai (status consumed, movement out);
     * hataya gaya serial wapas stock mein aata hai.
     */
    private function saveParts(object $j, array $parts, $user): void
    {
        $old = DB::table('repair_parts')->where('repair_job_id', $j->id)->whereNotNull('serial')->pluck('serial')->all();
        $new = [];
        foreach ($parts as $i => $p) {
            $sn = isset($p['serial']) && trim($p['serial']) !== '' ? PurchaseController::normalizeSerial($p['serial']) : null;
            if ($sn) {
                if (isset($new[$sn])) {
                    throw ValidationException::withMessages(["parts.{$i}" => "Serial {$sn} is added twice."]);
                }
                $new[$sn] = $i;
            }
        }
        $now = now();
        foreach (array_diff($old, array_keys($new)) as $sn) {
            $this->releasePart($j, $sn, $user, $now);
        }
        foreach (array_diff(array_keys($new), $old) as $sn) {
            $i = $new[$sn];
            $s = DB::table('stock_serials')->where('serial', $sn)->lockForUpdate()->first();
            $why = match (true) {
                ! $s => 'is not in stock',
                $s->status !== 'in_stock' => "is {$s->status}",
                StockHolds::reservedRef($sn) !== null => 'is reserved',
                StockHolds::inOpenTransfer($sn) || StockHolds::pendingAdjustment($sn) => 'is held by a transfer or adjustment',
                default => null,
            };
            if ($why) {
                throw ValidationException::withMessages(["parts.{$i}" => "Part serial {$sn} {$why}."]);
            }
            DB::table('stock_serials')->where('serial', $sn)->update(['status' => 'consumed', 'bin_id' => null, 'updated_at' => $now]);
            StockMovement::create(['at' => $now, 'direction' => 'out', 'type' => 'repair', 'serial' => $sn, 'product_id' => $s->product_id,
                'warehouse_id' => $s->warehouse_id, 'ref' => $j->number, 'note' => 'Used in repair', 'user_id' => $user->id]);
        }
        DB::table('repair_parts')->where('repair_job_id', $j->id)->delete();
        foreach ($parts as $p) {
            $sn = isset($p['serial']) && trim($p['serial']) !== '' ? PurchaseController::normalizeSerial($p['serial']) : null;
            $st = $sn ? DB::table('stock_serials')->where('serial', $sn)->first(['unit_cost', 'product_id']) : null;
            DB::table('repair_parts')->insert(['repair_job_id' => $j->id, 'description' => trim($p['description']), 'qty' => $sn ? 1 : (int) $p['qty'],
                'unit_price' => self::m((float) $p['unitPrice']), 'serial' => $sn, 'product_id' => $st->product_id ?? null,
                'unit_cost' => (float) ($st->unit_cost ?? 0)]);
        }
    }

    private function releasePart(object $j, string $sn, $user, $now): void
    {
        $s = DB::table('stock_serials')->where('serial', $sn)->first();
        if (! $s || $s->status !== 'consumed') {
            return;
        }
        DB::table('stock_serials')->where('serial', $sn)->update(['status' => 'in_stock', 'updated_at' => $now]);
        StockMovement::create(['at' => $now, 'direction' => 'in', 'type' => 'repair_return', 'serial' => $sn, 'product_id' => $s->product_id,
            'warehouse_id' => $s->warehouse_id, 'ref' => $j->number, 'note' => 'Removed from repair', 'user_id' => $user->id]);
    }

    public function status(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['status' => 'required|string', 'note' => 'nullable|string|max:500']);
        $u = $request->user();
        DB::transaction(function () use ($d, $id, $u) {
            $j = DB::table('repair_jobs')->lockForUpdate()->find($id);
            abort_unless($j, 404, 'Job card not found.');
            if (! in_array($d['status'], self::FLOW[$j->status] ?? [], true)) {
                throw ValidationException::withMessages(['status' => "Cannot move from {$j->status} to {$d['status']}."]);
            }
            $note = trim($d['note'] ?? '');
            if ($d['status'] === 'cancelled' && mb_strlen($note) < 10) {
                throw ValidationException::withMessages(['note' => 'Write why the job is cancelled (at least 10 characters).']);
            }
            if ($d['status'] === 'cancelled') {
                foreach (DB::table('repair_parts')->where('repair_job_id', $id)->whereNotNull('serial')->pluck('serial') as $sn) {
                    $this->releasePart($j, $sn, $u, now());
                }
            }
            DB::table('repair_jobs')->where('id', $id)->update(['status' => $d['status'], 'updated_at' => now()]);
            DB::table('repair_events')->insert(['repair_job_id' => $id, 'status' => $d['status'], 'note' => $note ?: null, 'user_id' => $u->id, 'at' => now()]);
        });
        AuditLog::record($u, 'repair.status', null, ['id' => $id, 'status' => $d['status']]);

        return response()->json($this->jobOut($id));
    }

    public function deliver(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['method' => 'nullable|in:cash,card,transfer', 'amount' => 'nullable|numeric|min:0', 'note' => 'nullable|string|max:500']);
        $u = $request->user();
        DB::transaction(function () use ($d, $id, $u) {
            $j = DB::table('repair_jobs')->lockForUpdate()->find($id);
            abort_unless($j, 404, 'Job card not found.');
            abort_unless($j->status === 'ready', 409, 'Only a ready job can be delivered.');
            $total = $this->jobOut($id)['total'];
            $amt = self::m((float) ($d['amount'] ?? 0));
            if (abs($amt - $total) > 0.004) {
                throw ValidationException::withMessages(['amount' => "Collect the full charges ({$total}) before delivery."]);
            }
            if ($amt > 0 && empty($d['method'])) {
                throw ValidationException::withMessages(['method' => 'Pick how the customer paid.']);
            }
            DB::table('repair_jobs')->where('id', $id)->update(['status' => 'delivered', 'paid' => $amt, 'paid_method' => $amt > 0 ? $d['method'] : null,
                'delivered_at' => now(), 'updated_at' => now()]);
            DB::table('repair_events')->insert(['repair_job_id' => $id, 'status' => 'delivered', 'note' => trim($d['note'] ?? '') ?: null,
                'user_id' => $u->id, 'at' => now()]);
        });
        AuditLog::record($u, 'repair.delivered', null, ['id' => $id]);

        return response()->json($this->jobOut($id));
    }
}
