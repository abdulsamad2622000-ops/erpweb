<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Product;
use App\Models\ProductVariant;
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

/** Step 12 Retail POS: shift, scan/search, sale, held bills, receipt, returns, quick customer. */
class PosController extends Controller
{
    private const METHODS = ['cash', 'card', 'transfer'];

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    private static function money(float $v): float
    {
        return round($v, 2);
    }

    private function openShift(User $u): ?object
    {
        return DB::table('pos_shifts')->where('user_id', $u->id)->whereNull('closed_at')->first();
    }

    private function needShift(User $u): object
    {
        return $this->openShift($u) ?? abort(409, 'Open a shift before selling.');
    }

    /** Super admin: koi limit nahi. Baqi: user ka discount_percent (khaali = 0%). */
    public static function discountLimit(User $u): ?float
    {
        return $u->type === 'super_admin' ? null : (float) ($u->discount_percent ?? 0);
    }

    // ---------- Shift ----------

    private function shiftOut(object $s): array
    {
        $cash = $this->cashFlow($s->id);
        $sales = DB::table('sales')->where('pos_shift_id', $s->id);

        return [
            'id' => $s->id, 'warehouseId' => (int) $s->warehouse_id,
            'warehouseName' => (string) DB::table('warehouses')->where('id', $s->warehouse_id)->value('name'),
            'openingCash' => (float) $s->opening_cash, 'openedAt' => \Illuminate\Support\Carbon::parse($s->opened_at)->toIso8601String(),
            'closedAt' => $s->closed_at ? \Illuminate\Support\Carbon::parse($s->closed_at)->toIso8601String() : null,
            'salesCount' => (clone $sales)->count(), 'salesTotal' => (float) (clone $sales)->sum('total'),
            'cashIn' => $cash['in'], 'cashRefunds' => $cash['out'],
            'expectedCash' => self::money((float) $s->opening_cash + $cash['in'] - $cash['out']),
            'countedCash' => $s->counted_cash !== null ? (float) $s->counted_cash : null,
            'note' => $s->note,
        ];
    }

    private function cashFlow(int $shiftId): array
    {
        $in = (float) DB::table('sale_payments')->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->where('sales.pos_shift_id', $shiftId)->where('method', 'cash')->sum('amount')
            - (float) DB::table('sales')->where('pos_shift_id', $shiftId)->sum('change_due');
        $out = (float) DB::table('sales_returns')->where('pos_shift_id', $shiftId)->where('refund_method', 'cash')->sum('amount');

        return ['in' => self::money($in), 'out' => self::money($out)];
    }

    public function shift(Request $request): JsonResponse
    {
        $s = $this->openShift($request->user());

        return response()->json(['shift' => $s ? $this->shiftOut($s) : null, 'discountLimit' => self::discountLimit($request->user())]);
    }

    public function openShiftAction(Request $request): JsonResponse
    {
        $d = $request->validate(['warehouseId' => 'required|integer|exists:warehouses,id', 'openingCash' => 'required|numeric|min:0|max:100000000'],
            ['warehouseId.required' => 'Pick the counter warehouse.', 'openingCash.required' => 'Enter the opening cash.']);
        $u = $request->user();
        $id = DB::transaction(function () use ($u, $d) {
            if (DB::table('pos_shifts')->where('user_id', $u->id)->whereNull('closed_at')->lockForUpdate()->exists()) {
                abort(409, 'You already have an open shift.');
            }

            return DB::table('pos_shifts')->insertGetId(['user_id' => $u->id, 'warehouse_id' => $d['warehouseId'],
                'opening_cash' => self::money((float) $d['openingCash']), 'opened_at' => now()]);
        });
        AuditLog::record($u, 'pos.shift_opened', null, ['shiftId' => $id]);

        return response()->json($this->shiftOut(DB::table('pos_shifts')->find($id)), 201);
    }

    public function closeShift(Request $request): JsonResponse
    {
        $d = $request->validate(['countedCash' => 'required|numeric|min:0|max:100000000', 'note' => 'nullable|string|max:500'],
            ['countedCash.required' => 'Count the cash in the drawer.']);
        $u = $request->user();
        $s = $this->needShift($u);
        $out = $this->shiftOut($s);
        $counted = self::money((float) $d['countedCash']);
        $note = trim($d['note'] ?? '');
        if (abs($counted - $out['expectedCash']) >= 0.01 && mb_strlen($note) < 10) {
            throw ValidationException::withMessages(['note' => 'Cash does not match. Explain the difference (at least 10 characters).']);
        }
        DB::table('pos_shifts')->where('id', $s->id)->update(['closed_at' => now(), 'counted_cash' => $counted,
            'expected_cash' => $out['expectedCash'], 'note' => $note ?: null]);
        AuditLog::record($u, 'pos.shift_closed', null, ['shiftId' => $s->id, 'expected' => $out['expectedCash'], 'counted' => $counted]);

        return response()->json($this->shiftOut(DB::table('pos_shifts')->find($s->id)));
    }

    // ---------- Scan / search ----------

    private function item(int $productId, ?string $serial): array
    {
        $p = ProductInfo::get($productId);

        return ['productId' => $productId, 'serial' => $serial, 'name' => $p['name'], 'sku' => $p['sku'], 'specs' => $p['specs'],
            'price' => $p['price'], 'serialized' => $p['serialized'],
            'warrantyMonths' => (int) Product::where('id', $productId)->value('warranty_months')];
    }

    /** Serial bechne layak hai? Nahi to wajah. */
    private function serialProblem(?StockSerial $s, int $warehouseId): ?string
    {
        if (! $s) {
            return 'This serial is not in stock.';
        }
        if ($s->status !== 'in_stock') {
            return "This serial is {$s->status}, not available for sale.";
        }
        if ((int) $s->warehouse_id !== $warehouseId) {
            return 'This serial is in another warehouse.';
        }
        if ($ref = StockHolds::reservedRef($s->serial)) {
            return "This serial is reserved ({$ref}).";
        }
        if (StockHolds::inOpenTransfer($s->serial) || StockHolds::pendingAdjustment($s->serial)) {
            return 'This serial is held by a transfer or adjustment.';
        }

        return null;
    }

    public function scan(Request $request, string $code): JsonResponse
    {
        $shift = $this->needShift($request->user());
        $code = strtoupper(trim(urldecode($code)));
        $s = StockSerial::where('serial', $code)->first();
        if ($s) {
            if ($why = $this->serialProblem($s, (int) $shift->warehouse_id)) {
                abort(422, $why);
            }

            return response()->json($this->item((int) $s->product_id, $s->serial));
        }
        $v = ProductVariant::where('sku', $code)->orWhere('barcode', $code)->first();
        abort_unless($v, 404, 'No serial, SKU or barcode matches this code.');
        $item = $this->item((int) $v->product_id, null);
        if ($item['serialized']) {
            abort(422, 'This laptop is tracked by serial. Scan the serial number.');
        }

        return response()->json($item);
    }

    public function search(Request $request): JsonResponse
    {
        $shift = $this->needShift($request->user());
        $q = trim((string) $request->query('search', ''));
        if (mb_strlen($q) < 2) {
            return response()->json([]);
        }
        $ids = Product::where('is_active', true)->where(fn ($w) => $w->where('name', 'like', "%{$q}%")
            ->orWhereIn('id', ProductVariant::where('sku', 'like', "%{$q}%")->select('product_id')))->limit(20)->pluck('id');
        $stock = StockSerial::where('warehouse_id', $shift->warehouse_id)->where('status', 'in_stock')->whereIn('product_id', $ids)
            ->get(['product_id', 'serial'])->groupBy('product_id');

        return response()->json($ids->map(function ($id) use ($stock) {
            $serials = $stock->get($id, collect())->pluck('serial')->all();
            $free = array_values(array_filter($serials, fn ($s) => ! StockHolds::reservedRef($s) && ! StockHolds::inOpenTransfer($s) && ! StockHolds::pendingAdjustment($s)));

            return $this->item((int) $id, null) + ['inStock' => count($free), 'serials' => array_slice($free, 0, 20)];
        })->values());
    }

    // ---------- Sale ----------

    public function storeSale(Request $request): JsonResponse
    {
        $d = $request->validate([
            'customerId' => 'nullable|integer|exists:customers,id',
            'lines' => 'required|array|min:1|max:200',
            'lines.*.productId' => 'required|integer|exists:products,id',
            'lines.*.serial' => 'nullable|string|max:40',
            'lines.*.qty' => 'nullable|integer|min:1|max:999',
            'discount' => 'nullable|numeric|min:0',
            'payments' => 'required|array|min:1|max:5',
            'payments.*.method' => 'required|in:'.implode(',', self::METHODS),
            'payments.*.amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:500',
        ], ['lines.required' => 'Add at least one item.', 'payments.required' => 'Take a payment.']);
        $u = $request->user();
        $shift = $this->needShift($u);

        $id = DB::transaction(function () use ($d, $u, $shift) {
            $wh = (int) $shift->warehouse_id;
            $lines = [];
            $seen = [];
            foreach ($d['lines'] as $i => $l) {
                $info = $this->item((int) $l['productId'], null);
                if ($info['price'] === null) {
                    throw ValidationException::withMessages(["lines.{$i}" => "{$info['name']} has no retail price."]);
                }
                $serial = isset($l['serial']) && $l['serial'] !== '' ? strtoupper(trim($l['serial'])) : null;
                if ($info['serialized']) {
                    if (! $serial) {
                        throw ValidationException::withMessages(["lines.{$i}" => "Scan the serial for {$info['name']}."]);
                    }
                    if (isset($seen[$serial])) {
                        throw ValidationException::withMessages(["lines.{$i}" => "Serial {$serial} is added twice."]);
                    }
                    $seen[$serial] = true;
                    $s = StockSerial::where('serial', $serial)->lockForUpdate()->first();
                    if ($s && (int) $s->product_id !== (int) $l['productId']) {
                        throw ValidationException::withMessages(["lines.{$i}" => "Serial {$serial} belongs to another product."]);
                    }
                    if ($why = $this->serialProblem($s, $wh)) {
                        throw ValidationException::withMessages(["lines.{$i}" => "{$serial}: {$why}"]);
                    }
                    $qty = 1;
                } else {
                    $serial = null;
                    $qty = (int) ($l['qty'] ?? 1);
                }
                $lines[] = ['product_id' => (int) $l['productId'], 'serial' => $serial, 'qty' => $qty,
                    'unit_price' => self::money($info['price']), 'warranty_months' => $info['warrantyMonths']];
            }
            $subtotal = self::money(array_sum(array_map(fn ($l) => $l['qty'] * $l['unit_price'], $lines)));
            $discount = self::money((float) ($d['discount'] ?? 0));
            $limit = self::discountLimit($u);
            if ($discount > $subtotal) {
                throw ValidationException::withMessages(['discount' => 'Discount cannot be more than the bill.']);
            }
            if ($limit !== null && $discount > self::money($subtotal * $limit / 100) + 0.001) {
                throw ValidationException::withMessages(['discount' => "Your discount limit is {$limit}% of the bill."]);
            }
            $total = self::money($subtotal - $discount);
            $paid = self::money(array_sum(array_column($d['payments'], 'amount')));
            $cash = self::money(array_sum(array_map(fn ($p) => $p['method'] === 'cash' ? $p['amount'] : 0, $d['payments'])));
            if ($paid + 0.001 < $total) {
                throw ValidationException::withMessages(['payments' => 'Payment is less than the total.']);
            }
            $change = self::money($paid - $total);
            if ($change > $cash + 0.001) {
                throw ValidationException::withMessages(['payments' => 'Only cash can be overpaid (for change).']);
            }

            $number = $this->numbers->next('invoice');
            $now = now();
            $saleId = DB::table('sales')->insertGetId(['number' => $number, 'channel' => 'pos', 'pos_shift_id' => $shift->id,
                'warehouse_id' => $wh, 'customer_id' => $d['customerId'] ?? null, 'subtotal' => $subtotal, 'discount' => $discount,
                'total' => $total, 'paid' => $paid, 'change_due' => $change, 'note' => trim($d['note'] ?? '') ?: null,
                'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            foreach ($lines as $l) {
                DB::table('sale_lines')->insert($l + ['sale_id' => $saleId]);
                if ($l['serial']) {
                    StockSerial::where('serial', $l['serial'])->update(['status' => 'sold', 'bin_id' => null]);
                    StockMovement::create(['at' => $now, 'direction' => 'out', 'type' => 'sale', 'serial' => $l['serial'],
                        'product_id' => $l['product_id'], 'warehouse_id' => $wh, 'ref' => $number, 'note' => null, 'user_id' => $u->id]);
                }
            }
            foreach ($d['payments'] as $p) {
                DB::table('sale_payments')->insert(['sale_id' => $saleId, 'method' => $p['method'], 'amount' => self::money((float) $p['amount'])]);
            }
            AuditLog::record($u, 'pos.sale', null, ['number' => $number, 'total' => $total, 'discount' => $discount]);

            return $saleId;
        });

        return response()->json($this->saleOut($id), 201);
    }

    public function saleOut(int $id): array
    {
        $s = DB::table('sales')->find($id);
        abort_unless($s, 404, 'Sale not found.');
        $cust = $s->customer_id ? DB::table('customers')->find($s->customer_id) : null;

        return [
            'id' => $s->id, 'number' => $s->number, 'channel' => $s->channel,
            'createdAt' => \Illuminate\Support\Carbon::parse($s->created_at)->toIso8601String(),
            'cashier' => (string) DB::table('users')->where('id', $s->created_by)->value('name'),
            'warehouseName' => (string) DB::table('warehouses')->where('id', $s->warehouse_id)->value('name'),
            'customer' => $cust ? ['id' => $cust->id, 'name' => $cust->name, 'phone' => $cust->phone] : null,
            'subtotal' => (float) $s->subtotal, 'discount' => (float) $s->discount, 'total' => (float) $s->total,
            'paid' => (float) $s->paid, 'change' => (float) $s->change_due, 'note' => $s->note,
            'lines' => DB::table('sale_lines')->where('sale_id', $id)->orderBy('id')->get()->map(function ($l) {
                $p = ProductInfo::get((int) $l->product_id);

                return ['id' => $l->id, 'productId' => (int) $l->product_id, 'name' => $p['name'], 'sku' => $p['sku'], 'serial' => $l->serial,
                    'qty' => (int) $l->qty, 'unitPrice' => (float) $l->unit_price, 'warrantyMonths' => (int) $l->warranty_months,
                    'returnedQty' => (int) $l->returned_qty];
            })->all(),
            'payments' => DB::table('sale_payments')->where('sale_id', $id)->get()->map(fn ($p) => ['method' => $p->method, 'amount' => (float) $p->amount])->all(),
            'returns' => DB::table('sales_returns')->where('sale_id', $id)->orderBy('id')->get()->map(fn ($r) => ['number' => $r->number,
                'amount' => (float) $r->amount, 'refundMethod' => $r->refund_method,
                'createdAt' => \Illuminate\Support\Carbon::parse($r->created_at)->toIso8601String()])->all(),
        ];
    }

    public function sale(int $id): JsonResponse
    {
        return response()->json($this->saleOut($id));
    }

    /** Receipt number ya bika hua serial se sale dhoondo (return ke liye). */
    public function findSale(string $code): JsonResponse
    {
        $code = strtoupper(trim(urldecode($code)));
        $id = DB::table('sales')->where('number', $code)->value('id')
            ?? DB::table('sale_lines')->where('serial', $code)->orderByDesc('id')->value('sale_id');
        abort_unless($id, 404, 'No sale found for this receipt or serial.');

        return response()->json($this->saleOut((int) $id));
    }

    public function recentSales(Request $request): JsonResponse
    {
        $shift = $this->openShift($request->user());
        $q = DB::table('sales')->orderByDesc('id')->limit(50);
        if ($shift) {
            $q->where('pos_shift_id', $shift->id);
        } else {
            $q->where('created_by', $request->user()->id);
        }

        return response()->json($q->get()->map(fn ($s) => ['id' => $s->id, 'number' => $s->number, 'total' => (float) $s->total,
            'createdAt' => \Illuminate\Support\Carbon::parse($s->created_at)->toIso8601String()]));
    }

    // ---------- Held bills ----------

    public function holds(Request $request): JsonResponse
    {
        return response()->json(DB::table('pos_holds')->where('user_id', $request->user()->id)->orderByDesc('id')->get()
            ->map(fn ($h) => ['id' => $h->id, 'label' => $h->label, 'payload' => json_decode($h->payload, true),
                'createdAt' => \Illuminate\Support\Carbon::parse($h->created_at)->toIso8601String()]));
    }

    public function storeHold(Request $request): JsonResponse
    {
        $d = $request->validate(['label' => 'required|string|max:60', 'payload' => 'required|array']);
        $u = $request->user();
        if (DB::table('pos_holds')->where('user_id', $u->id)->count() >= 20) {
            abort(422, 'You already have 20 held bills. Recall or delete one first.');
        }
        $id = DB::table('pos_holds')->insertGetId(['user_id' => $u->id, 'label' => trim($d['label']),
            'payload' => json_encode($d['payload']), 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id], 201);
    }

    public function deleteHold(Request $request, int $id): JsonResponse
    {
        $n = DB::table('pos_holds')->where('id', $id)->where('user_id', $request->user()->id)->delete();
        abort_unless($n, 404, 'Held bill not found.');

        return response()->json(null, 204);
    }

    // ---------- Returns ----------

    public function storeReturn(Request $request): JsonResponse
    {
        $d = $request->validate([
            'saleId' => 'required|integer|exists:sales,id',
            'lines' => 'required|array|min:1',
            'lines.*.saleLineId' => 'required|integer',
            'lines.*.qty' => 'nullable|integer|min:1',
            'refundMethod' => 'required|in:'.implode(',', self::METHODS).',credit',
            'reason' => 'required|string|min:10|max:500',
        ], ['reason.min' => 'Write a reason of at least 10 characters.', 'lines.required' => 'Pick the items being returned.']);
        $u = $request->user();
        $shift = $this->openShift($u);
        if ($d['refundMethod'] === 'cash' && ! $shift) {
            abort(409, 'Open a shift to refund cash.');
        }

        $rid = DB::transaction(function () use ($d, $u, $shift) {
            $sale = DB::table('sales')->lockForUpdate()->find($d['saleId']);
            if ($d['refundMethod'] === 'credit' && ! $sale->customer_id) {
                throw ValidationException::withMessages(['refundMethod' => 'Credit refund needs a customer on the sale.']);
            }
            $ratio = (float) $sale->subtotal > 0 ? (float) $sale->total / (float) $sale->subtotal : 1;
            $rows = [];
            foreach ($d['lines'] as $i => $l) {
                $sl = DB::table('sale_lines')->where('sale_id', $sale->id)->where('id', $l['saleLineId'])->lockForUpdate()->first();
                if (! $sl) {
                    throw ValidationException::withMessages(["lines.{$i}" => 'This item is not on the sale.']);
                }
                $qty = $sl->serial ? 1 : (int) ($l['qty'] ?? 1);
                if ($qty > $sl->qty - $sl->returned_qty) {
                    throw ValidationException::withMessages(["lines.{$i}" => 'This item was already returned.']);
                }
                $rows[] = [$sl, $qty, self::money($qty * (float) $sl->unit_price * $ratio)];
            }
            $amount = self::money(array_sum(array_column($rows, 2)));
            $number = $this->numbers->next('sales_return');
            $now = now();
            $rid = DB::table('sales_returns')->insertGetId(['number' => $number, 'sale_id' => $sale->id, 'pos_shift_id' => $shift?->id,
                'amount' => $amount, 'refund_method' => $d['refundMethod'], 'reason' => trim($d['reason']),
                'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            $wh = $shift ? (int) $shift->warehouse_id : (int) $sale->warehouse_id;
            foreach ($rows as [$sl, $qty, $amt]) {
                DB::table('sales_return_lines')->insert(['sales_return_id' => $rid, 'sale_line_id' => $sl->id, 'serial' => $sl->serial, 'qty' => $qty, 'amount' => $amt]);
                DB::table('sale_lines')->where('id', $sl->id)->increment('returned_qty', $qty);
                if ($sl->serial) {
                    StockSerial::where('serial', $sl->serial)->update(['status' => 'in_stock', 'warehouse_id' => $wh, 'bin_id' => null]);
                    StockMovement::create(['at' => $now, 'direction' => 'in', 'type' => 'sales_return', 'serial' => $sl->serial,
                        'product_id' => $sl->product_id, 'warehouse_id' => $wh, 'ref' => $number, 'note' => trim($d['reason']), 'user_id' => $u->id]);
                }
            }
            AuditLog::record($u, 'pos.return', null, ['number' => $number, 'sale' => $sale->number, 'amount' => $amount]);

            return $rid;
        });
        $r = DB::table('sales_returns')->find($rid);

        return response()->json(['id' => $rid, 'number' => $r->number, 'amount' => (float) $r->amount, 'refundMethod' => $r->refund_method,
            'sale' => $this->saleOut((int) $r->sale_id)], 201);
    }

    // ---------- Customers (quick) ----------

    private function customerOut(object $c): array
    {
        return ['id' => $c->id, 'name' => $c->name, 'phone' => $c->phone, 'email' => $c->email, 'type' => $c->type,
            'priceTier' => $c->price_tier, 'creditLimit' => (float) $c->credit_limit, 'isActive' => (bool) $c->is_active,
            'paymentTermsDays' => (int) ($c->payment_terms_days ?? 0), 'address' => (string) ($c->address ?? ''), 'city' => (string) ($c->city ?? ''),
            'balance' => WholesaleController::outstanding((int) $c->id)];
    }

    public function customers(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('search', ''));
        $all = $request->query('all') === 'true';
        $rows = DB::table('customers')->when(! $all, fn ($w) => $w->where('is_active', true))
            ->when($request->query('type'), fn ($w, $t) => $w->where('type', $t))
            ->when($q !== '', fn ($w) => $w->where(fn ($x) => $x->where('name', 'like', "%{$q}%")->orWhere('phone', 'like', "%{$q}%")))
            ->orderBy('name')->limit($all ? 500 : 50)->get();

        return response()->json($rows->map(fn ($c) => $this->customerOut($c)));
    }

    public function customer(int $id): JsonResponse
    {
        $c = DB::table('customers')->find($id);
        abort_unless($c, 404, 'Customer not found.');

        return response()->json($this->customerOut($c));
    }

    private function customerData(Request $request, ?int $id): array
    {
        $d = $request->validate(['name' => 'required|string|min:2|max:120', 'phone' => 'required|string|min:7|max:30',
            'email' => 'nullable|email|max:120', 'type' => 'nullable|in:retail,wholesale,dealer',
            'priceTier' => 'nullable|string|exists:price_tiers,key', 'creditLimit' => 'nullable|numeric|min:0|max:1000000000',
            'paymentTermsDays' => 'nullable|integer|min:0|max:365', 'address' => 'nullable|string|max:300', 'city' => 'nullable|string|max:80',
            'isActive' => 'nullable|boolean'],
            ['phone.required' => 'Enter a phone number.']);
        $phone = preg_replace('/[^0-9+]/', '', $d['phone']);
        if (DB::table('customers')->where('phone', $phone)->when($id, fn ($w) => $w->where('id', '!=', $id))->exists()) {
            throw ValidationException::withMessages(['phone' => 'A customer with this phone already exists.']);
        }
        $type = $d['type'] ?? 'retail';
        $credit = (float) ($d['creditLimit'] ?? 0);
        if ($credit > 0 && $request->user()->type !== 'super_admin' && ! app(\App\Services\PermissionResolver::class)->has($request->user(), 'customers.customer.edit')) {
            throw ValidationException::withMessages(['creditLimit' => 'You cannot set a credit limit.']);
        }

        return ['name' => trim($d['name']), 'phone' => $phone, 'email' => trim($d['email'] ?? ''), 'type' => $type,
            'price_tier' => $d['priceTier'] ?? $type, 'credit_limit' => $credit, 'payment_terms_days' => (int) ($d['paymentTermsDays'] ?? 0),
            'address' => trim($d['address'] ?? ''), 'city' => trim($d['city'] ?? ''), 'is_active' => $d['isActive'] ?? true];
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $id = DB::table('customers')->insertGetId($this->customerData($request, null) + ['created_at' => now(), 'updated_at' => now()]);
        AuditLog::record($request->user(), 'customer.created', null, ['id' => $id]);

        return response()->json($this->customerOut(DB::table('customers')->find($id)), 201);
    }

    public function updateCustomer(Request $request, int $id): JsonResponse
    {
        abort_unless(DB::table('customers')->where('id', $id)->exists(), 404, 'Customer not found.');
        DB::table('customers')->where('id', $id)->update($this->customerData($request, $id) + ['updated_at' => now()]);
        AuditLog::record($request->user(), 'customer.updated', null, ['id' => $id]);

        return response()->json($this->customerOut(DB::table('customers')->find($id)));
    }
}
