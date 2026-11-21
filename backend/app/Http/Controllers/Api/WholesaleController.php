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
use App\Services\TierPrice;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 11 Wholesale: quotation -> order -> challan -> invoice -> receipts, customer credit limit. */
class WholesaleController extends Controller
{
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

    private static function userName($id): string
    {
        return (string) DB::table('users')->where('id', $id)->value('name');
    }

    private static function customerBrief(int $id): array
    {
        $c = DB::table('customers')->find($id);

        return ['id' => $id, 'name' => (string) $c?->name, 'phone' => (string) $c?->phone, 'type' => (string) $c?->type];
    }

    // ---------- Customer balance & credit ----------

    /** Udhaar baqi: sab bills (total - paid + change) minus "credit" wale returns. */
    public static function outstanding(int $customerId): float
    {
        $bills = (float) DB::table('sales')->where('customer_id', $customerId)->selectRaw('COALESCE(SUM(total - paid + change_due), 0) as b')->value('b');

        return self::m($bills - self::creditReturns(fn ($q) => $q->where('sales.customer_id', $customerId)));
    }

    private static function creditReturns(callable $where): float
    {
        $q = DB::table('sales_returns')->join('sales', 'sales.id', '=', 'sales_returns.sale_id')->where('refund_method', 'credit');
        $where($q);

        return (float) $q->sum('sales_returns.amount');
    }

    /** Line prices: tier price default; user had (discount %) aur min price se neeche nahi. */
    private function priceLines(array $lines, object $customer, User $u, string $field = 'lines'): array
    {
        $limit = PosController::discountLimit($u);
        $out = [];
        foreach ($lines as $i => $l) {
            $info = ProductInfo::get((int) $l['productId']);
            $tp = TierPrice::get((int) $l['productId'], $customer->price_tier ?: 'retail');
            if ($tp['price'] === null) {
                throw ValidationException::withMessages(["{$field}.{$i}" => "{$info['name']} has no price for this customer."]);
            }
            $price = isset($l['unitPrice']) && $l['unitPrice'] !== null ? self::m((float) $l['unitPrice']) : $tp['price'];
            if ($limit !== null) {
                $floor = self::m(max($tp['minPrice'] ?? 0, $tp['price'] * (1 - $limit / 100)));
                if ($price + 0.001 < $floor) {
                    throw ValidationException::withMessages(["{$field}.{$i}" => "{$info['name']}: lowest price you can give is {$floor}."]);
                }
            }
            if ($price <= 0) {
                throw ValidationException::withMessages(["{$field}.{$i}" => 'Price must be more than 0.']);
            }
            $out[] = ['product_id' => (int) $l['productId'], 'qty' => (int) $l['qty'], 'unit_price' => $price];
        }

        return $out;
    }

    private function lineRules(): array
    {
        return [
            'customerId' => 'required|integer|exists:customers,id',
            'lines' => 'required|array|min:1|max:200',
            'lines.*.productId' => 'required|integer|exists:products,id',
            'lines.*.qty' => 'required|integer|min:1|max:9999',
            'lines.*.unitPrice' => 'nullable|numeric|min:0',
            'note' => 'nullable|string|max:500',
        ];
    }

    private static function linesOut($rows, array $extra = []): array
    {
        return collect($rows)->map(function ($l) use ($extra) {
            $p = ProductInfo::get((int) $l->product_id);
            $o = ['id' => $l->id, 'productId' => (int) $l->product_id, 'name' => $p['name'], 'sku' => $p['sku'], 'serialized' => $p['serialized'],
                'qty' => (int) $l->qty, 'unitPrice' => (float) $l->unit_price, 'amount' => self::m($l->qty * $l->unit_price)];
            foreach ($extra as $k => $col) {
                $o[$k] = (int) $l->{$col};
            }

            return $o;
        })->all();
    }

    // ---------- Price lookup ----------

    public function price(Request $request): JsonResponse
    {
        $d = $request->validate(['customerId' => 'required|integer|exists:customers,id', 'productId' => 'required|integer|exists:products,id']);
        $c = DB::table('customers')->find($d['customerId']);
        $tp = TierPrice::get((int) $d['productId'], $c->price_tier ?: 'retail');
        $limit = PosController::discountLimit($request->user());
        $floor = $tp['price'] === null ? null : ($limit === null ? 0.0 : self::m(max($tp['minPrice'] ?? 0, $tp['price'] * (1 - $limit / 100))));

        return response()->json(ProductInfo::get((int) $d['productId']) + ['tierPrice' => $tp['price'], 'lowestPrice' => $floor, 'tier' => $c->price_tier]);
    }

    // ---------- Quotations ----------

    private function quotationOut(int $id): array
    {
        $q = DB::table('quotations')->find($id);
        abort_unless($q, 404, 'Quotation not found.');
        $status = $q->status;
        if (in_array($status, ['draft', 'sent'], true) && $q->valid_until && $q->valid_until < now()->toDateString()) {
            $status = 'expired';
        }

        return ['id' => $q->id, 'number' => $q->number, 'customer' => self::customerBrief((int) $q->customer_id), 'status' => $status,
            'validUntil' => $q->valid_until, 'total' => (float) $q->total, 'note' => $q->note, 'createdBy' => self::userName($q->created_by),
            'createdAt' => self::iso($q->created_at),
            'orderId' => DB::table('sales_orders')->where('quotation_id', $q->id)->value('id'),
            'lines' => self::linesOut(DB::table('quotation_lines')->where('quotation_id', $id)->orderBy('id')->get())];
    }

    public function quotations(Request $request): JsonResponse
    {
        $q = DB::table('quotations')->join('customers', 'customers.id', '=', 'quotations.customer_id')->select('quotations.*');
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('quotations.number', 'like', "%{$v}%")->orWhere('customers.name', 'like', "%{$v}%"));
        }
        if ($v = ApiQuery::param($request, 'status')) {
            $q->where('quotations.status', $v);
        }
        ApiQuery::sort($q, $request, ['number' => 'quotations.number', 'createdAt' => 'quotations.created_at', 'total' => 'quotations.total'], 'quotations.id');
        if (! ApiQuery::param($request, 'sortField', 'sort')) {
            $q->reorder('quotations.id', 'desc');
        }

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($r) => $this->quotationOut((int) $r->id)));
    }

    public function quotation(int $id): JsonResponse
    {
        return response()->json($this->quotationOut($id));
    }

    private function saveQuotation(Request $request, ?int $id): int
    {
        $d = $request->validate($this->lineRules() + ['validUntil' => 'nullable|date|after_or_equal:today'],
            ['lines.required' => 'Add at least one item.', 'customerId.required' => 'Pick a customer.']);
        $u = $request->user();
        $c = DB::table('customers')->find($d['customerId']);
        $lines = $this->priceLines($d['lines'], $c, $u);
        $total = self::m(array_sum(array_map(fn ($l) => $l['qty'] * $l['unit_price'], $lines)));

        return DB::transaction(function () use ($d, $u, $lines, $total, $id) {
            $row = ['customer_id' => $d['customerId'], 'valid_until' => $d['validUntil'] ?? null, 'total' => $total,
                'note' => trim($d['note'] ?? '') ?: null, 'updated_at' => now()];
            if ($id) {
                $q = DB::table('quotations')->lockForUpdate()->find($id);
                abort_unless($q, 404, 'Quotation not found.');
                abort_unless($q->status === 'draft', 409, 'Only a draft quotation can be changed.');
                DB::table('quotations')->where('id', $id)->update($row);
                DB::table('quotation_lines')->where('quotation_id', $id)->delete();
            } else {
                $id = DB::table('quotations')->insertGetId($row + ['number' => $this->numbers->next('quotation'), 'status' => 'draft',
                    'created_by' => $u->id, 'created_at' => now()]);
            }
            foreach ($lines as $l) {
                DB::table('quotation_lines')->insert($l + ['quotation_id' => $id]);
            }
            AuditLog::record($u, 'quotation.saved', null, ['id' => $id, 'total' => $total]);

            return $id;
        });
    }

    public function storeQuotation(Request $request): JsonResponse
    {
        return response()->json($this->quotationOut($this->saveQuotation($request, null)), 201);
    }

    public function updateQuotation(Request $request, int $id): JsonResponse
    {
        return response()->json($this->quotationOut($this->saveQuotation($request, $id)));
    }

    public function quotationAction(Request $request, int $id): JsonResponse
    {
        $action = $request->route('action');
        $u = $request->user();
        $orderId = DB::transaction(function () use ($id, $action, $u) {
            $q = DB::table('quotations')->lockForUpdate()->find($id);
            abort_unless($q, 404, 'Quotation not found.');
            $expired = $q->valid_until && $q->valid_until < now()->toDateString();
            if ($action === 'send') {
                abort_unless($q->status === 'draft', 409, 'Only a draft can be sent.');
                DB::table('quotations')->where('id', $id)->update(['status' => 'sent', 'updated_at' => now()]);
            } elseif ($action === 'cancel') {
                abort_unless(in_array($q->status, ['draft', 'sent'], true), 409, 'This quotation cannot be cancelled.');
                DB::table('quotations')->where('id', $id)->update(['status' => 'cancelled', 'updated_at' => now()]);
            } else { // convert
                abort_unless(in_array($q->status, ['draft', 'sent'], true), 409, 'This quotation was already used or cancelled.');
                abort_if($expired, 409, 'This quotation has expired. Make a new one.');
                DB::table('quotations')->where('id', $id)->update(['status' => 'accepted', 'updated_at' => now()]);
                $oid = DB::table('sales_orders')->insertGetId(['number' => $this->numbers->next('sales_order'), 'customer_id' => $q->customer_id,
                    'quotation_id' => $q->id, 'status' => 'open', 'total' => $q->total, 'note' => $q->note, 'created_by' => $u->id,
                    'created_at' => now(), 'updated_at' => now()]);
                foreach (DB::table('quotation_lines')->where('quotation_id', $id)->get() as $l) {
                    DB::table('sales_order_lines')->insert(['sales_order_id' => $oid, 'product_id' => $l->product_id, 'qty' => $l->qty, 'unit_price' => $l->unit_price]);
                }
                AuditLog::record($u, 'sales_order.created', null, ['id' => $oid, 'from' => $q->number]);

                return $oid;
            }
            AuditLog::record($u, "quotation.{$action}", null, ['number' => $q->number]);

            return null;
        });

        return response()->json($orderId ? ['quotation' => $this->quotationOut($id), 'order' => $this->orderOut($orderId)] : $this->quotationOut($id));
    }

    // ---------- Sales orders ----------

    private function orderOut(int $id): array
    {
        $o = DB::table('sales_orders')->find($id);
        abort_unless($o, 404, 'Sales order not found.');

        return ['id' => $o->id, 'number' => $o->number, 'customer' => self::customerBrief((int) $o->customer_id), 'status' => $o->status,
            'quotationNumber' => $o->quotation_id ? DB::table('quotations')->where('id', $o->quotation_id)->value('number') : null,
            'total' => (float) $o->total, 'note' => $o->note, 'createdBy' => self::userName($o->created_by), 'createdAt' => self::iso($o->created_at),
            'lines' => self::linesOut(DB::table('sales_order_lines')->where('sales_order_id', $id)->orderBy('id')->get(), ['deliveredQty' => 'delivered_qty']),
            'challans' => DB::table('challans')->where('sales_order_id', $id)->orderBy('id')->get(['id', 'number', 'sale_id', 'created_at'])
                ->map(fn ($c) => ['id' => $c->id, 'number' => $c->number, 'invoiced' => (bool) $c->sale_id, 'createdAt' => self::iso($c->created_at)])->all()];
    }

    public function orders(Request $request): JsonResponse
    {
        $q = DB::table('sales_orders')->join('customers', 'customers.id', '=', 'sales_orders.customer_id')->select('sales_orders.*');
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('sales_orders.number', 'like', "%{$v}%")->orWhere('customers.name', 'like', "%{$v}%"));
        }
        if ($v = ApiQuery::param($request, 'status')) {
            $q->whereIn('sales_orders.status', explode(',', $v));
        }
        $q->orderByDesc('sales_orders.id');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($r) => $this->orderOut((int) $r->id)));
    }

    public function order(int $id): JsonResponse
    {
        return response()->json($this->orderOut($id));
    }

    public function storeOrder(Request $request): JsonResponse
    {
        $d = $request->validate($this->lineRules(), ['lines.required' => 'Add at least one item.', 'customerId.required' => 'Pick a customer.']);
        $u = $request->user();
        $lines = $this->priceLines($d['lines'], DB::table('customers')->find($d['customerId']), $u);
        $total = self::m(array_sum(array_map(fn ($l) => $l['qty'] * $l['unit_price'], $lines)));
        $id = DB::transaction(function () use ($d, $u, $lines, $total) {
            $id = DB::table('sales_orders')->insertGetId(['number' => $this->numbers->next('sales_order'), 'customer_id' => $d['customerId'],
                'status' => 'open', 'total' => $total, 'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $u->id,
                'created_at' => now(), 'updated_at' => now()]);
            foreach ($lines as $l) {
                DB::table('sales_order_lines')->insert($l + ['sales_order_id' => $id]);
            }

            return $id;
        });
        AuditLog::record($u, 'sales_order.created', null, ['id' => $id]);

        return response()->json($this->orderOut($id), 201);
    }

    public function cancelOrder(Request $request, int $id): JsonResponse
    {
        DB::transaction(function () use ($id) {
            $o = DB::table('sales_orders')->lockForUpdate()->find($id);
            abort_unless($o, 404, 'Sales order not found.');
            abort_unless($o->status === 'open', 409, 'Only an order with nothing delivered can be cancelled.');
            DB::table('sales_orders')->where('id', $id)->update(['status' => 'cancelled', 'updated_at' => now()]);
        });
        AuditLog::record($request->user(), 'sales_order.cancelled', null, ['id' => $id]);

        return response()->json($this->orderOut($id));
    }

    // ---------- Challans (goods out) ----------

    private function challanOut(int $id): array
    {
        $c = DB::table('challans')->find($id);
        abort_unless($c, 404, 'Challan not found.');
        $o = DB::table('sales_orders')->find($c->sales_order_id);
        $lines = DB::table('challan_lines')->where('challan_id', $id)->orderBy('id')->get()->map(function ($l) {
            $p = ProductInfo::get((int) $l->product_id);

            return ['id' => $l->id, 'orderLineId' => (int) $l->sales_order_line_id, 'productId' => (int) $l->product_id,
                'name' => $p['name'], 'sku' => $p['sku'], 'serial' => $l->serial, 'qty' => (int) $l->qty];
        })->all();

        return ['id' => $c->id, 'number' => $c->number, 'orderId' => (int) $o->id, 'orderNumber' => $o->number,
            'customer' => self::customerBrief((int) $o->customer_id), 'warehouseId' => (int) $c->warehouse_id,
            'warehouseName' => (string) DB::table('warehouses')->where('id', $c->warehouse_id)->value('name'),
            'invoiceId' => $c->sale_id ? (int) $c->sale_id : null,
            'invoiceNumber' => $c->sale_id ? DB::table('sales')->where('id', $c->sale_id)->value('number') : null,
            'note' => $c->note, 'createdBy' => self::userName($c->created_by), 'createdAt' => self::iso($c->created_at), 'lines' => $lines];
    }

    public function challans(Request $request): JsonResponse
    {
        $q = DB::table('challans')->join('sales_orders', 'sales_orders.id', '=', 'challans.sales_order_id')
            ->join('customers', 'customers.id', '=', 'sales_orders.customer_id')->select('challans.*');
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('challans.number', 'like', "%{$v}%")->orWhere('customers.name', 'like', "%{$v}%")
                ->orWhere('sales_orders.number', 'like', "%{$v}%"));
        }
        if (($v = ApiQuery::param($request, 'invoiced')) !== null) {
            $v === 'true' ? $q->whereNotNull('challans.sale_id') : $q->whereNull('challans.sale_id');
        }
        $q->orderByDesc('challans.id');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($r) => $this->challanOut((int) $r->id)));
    }

    public function challan(int $id): JsonResponse
    {
        return response()->json($this->challanOut($id));
    }

    public function storeChallan(Request $request): JsonResponse
    {
        $d = $request->validate([
            'orderId' => 'required|integer|exists:sales_orders,id',
            'warehouseId' => 'required|integer|exists:warehouses,id',
            'lines' => 'required|array|min:1',
            'lines.*.orderLineId' => 'required|integer',
            'lines.*.serials' => 'nullable|array',
            'lines.*.serials.*' => 'string|max:40',
            'lines.*.qty' => 'nullable|integer|min:0',
            'note' => 'nullable|string|max:500',
        ], ['lines.required' => 'Nothing to deliver.']);
        $u = $request->user();

        $id = DB::transaction(function () use ($d, $u) {
            $o = DB::table('sales_orders')->lockForUpdate()->find($d['orderId']);
            abort_unless(in_array($o->status, ['open', 'partial'], true), 409, 'This order is closed.');
            $wh = (int) $d['warehouseId'];
            $rows = [];
            $seen = [];
            foreach ($d['lines'] as $i => $l) {
                $ol = DB::table('sales_order_lines')->where('sales_order_id', $o->id)->where('id', $l['orderLineId'])->lockForUpdate()->first();
                if (! $ol) {
                    throw ValidationException::withMessages(["lines.{$i}" => 'This item is not on the order.']);
                }
                $info = ProductInfo::get((int) $ol->product_id);
                $left = $ol->qty - $ol->delivered_qty;
                if ($info['serialized']) {
                    $serials = array_values(array_unique(array_filter(array_map([PurchaseController::class, 'normalizeSerial'], $l['serials'] ?? []))));
                    if (! $serials) {
                        continue;
                    }
                    if (count($serials) > $left) {
                        throw ValidationException::withMessages(["lines.{$i}" => "{$info['name']}: only {$left} left to deliver."]);
                    }
                    foreach ($serials as $sn) {
                        if (isset($seen[$sn])) {
                            throw ValidationException::withMessages(["lines.{$i}" => "Serial {$sn} is added twice."]);
                        }
                        $seen[$sn] = true;
                        $s = StockSerial::where('serial', $sn)->lockForUpdate()->first();
                        $why = match (true) {
                            ! $s => 'is not in stock',
                            (int) $s->product_id !== (int) $ol->product_id => 'belongs to another product',
                            $s->status !== 'in_stock' => "is {$s->status}",
                            (int) $s->warehouse_id !== $wh => 'is in another warehouse',
                            StockHolds::inOpenTransfer($sn) || StockHolds::pendingAdjustment($sn) => 'is held by a transfer or adjustment',
                            default => null,
                        };
                        $ref = StockHolds::reservedRef($sn);
                        if (! $why && $ref) {
                            $why = "is reserved ({$ref})";
                        }
                        if ($why) {
                            throw ValidationException::withMessages(["lines.{$i}" => "Serial {$sn} {$why}."]);
                        }
                        $rows[] = [$ol, $sn, 1];
                    }
                } else {
                    $qty = (int) ($l['qty'] ?? 0);
                    if ($qty === 0) {
                        continue;
                    }
                    if ($qty > $left) {
                        throw ValidationException::withMessages(["lines.{$i}" => "{$info['name']}: only {$left} left to deliver."]);
                    }
                    $rows[] = [$ol, null, $qty];
                }
            }
            if (! $rows) {
                throw ValidationException::withMessages(['lines' => 'Scan at least one serial or enter a quantity.']);
            }
            $number = $this->numbers->next('challan');
            $now = now();
            $cid = DB::table('challans')->insertGetId(['number' => $number, 'sales_order_id' => $o->id, 'warehouse_id' => $wh,
                'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            foreach ($rows as [$ol, $sn, $qty]) {
                DB::table('challan_lines')->insert(['challan_id' => $cid, 'sales_order_line_id' => $ol->id, 'product_id' => $ol->product_id, 'serial' => $sn, 'qty' => $qty]);
                DB::table('sales_order_lines')->where('id', $ol->id)->increment('delivered_qty', $qty);
                if ($sn) {
                    StockSerial::where('serial', $sn)->update(['status' => 'sold', 'bin_id' => null]);
                    StockMovement::create(['at' => $now, 'direction' => 'out', 'type' => 'sale', 'serial' => $sn, 'product_id' => $ol->product_id,
                        'warehouse_id' => $wh, 'ref' => $number, 'note' => $o->number, 'user_id' => $u->id]);
                }
            }
            $left = DB::table('sales_order_lines')->where('sales_order_id', $o->id)->selectRaw('SUM(qty - delivered_qty) as l')->value('l');
            DB::table('sales_orders')->where('id', $o->id)->update(['status' => (int) $left === 0 ? 'delivered' : 'partial', 'updated_at' => $now]);
            AuditLog::record($u, 'challan.created', null, ['number' => $number, 'order' => $o->number]);

            return $cid;
        });

        return response()->json($this->challanOut($id), 201);
    }

    // ---------- Invoices (credit) ----------

    private function invoiceOut(int $id): array
    {
        $pos = app(PosController::class)->saleOut($id);
        $s = DB::table('sales')->find($id);
        $returned = (float) DB::table('sales_returns')->where('sale_id', $id)->sum('amount');
        $balance = self::m((float) $s->total - (float) $s->paid + (float) $s->change_due - self::creditReturns(fn ($q) => $q->where('sales.id', $id)));

        return $pos + ['challanNumber' => $s->challan_id ? DB::table('challans')->where('id', $s->challan_id)->value('number') : null,
            'dueDate' => $s->due_date, 'balance' => max($balance, 0.0), 'returned' => $returned,
            'status' => $balance <= 0.004 ? 'paid' : ((float) $s->paid > 0 ? 'partial' : ($s->due_date && $s->due_date < now()->toDateString() ? 'overdue' : 'unpaid')),
            'paymentsDetail' => DB::table('sale_payments')->where('sale_id', $id)->orderBy('id')->get()
                ->map(fn ($p) => ['method' => $p->method, 'amount' => (float) $p->amount, 'reference' => $p->reference, 'paidAt' => self::iso($p->paid_at)])->all()];
    }

    public function invoices(Request $request): JsonResponse
    {
        $q = DB::table('sales')->leftJoin('customers', 'customers.id', '=', 'sales.customer_id')->select('sales.*');
        if ($v = ApiQuery::param($request, 'channel')) {
            $q->where('sales.channel', $v);
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('sales.number', 'like', "%{$v}%")->orWhere('customers.name', 'like', "%{$v}%"));
        }
        if ($v = ApiQuery::param($request, 'customerId')) {
            $q->where('sales.customer_id', (int) $v);
        }
        if (ApiQuery::param($request, 'unpaid') === 'true') {
            $q->whereRaw('sales.total - sales.paid + sales.change_due > 0.004');
        }
        $q->orderByDesc('sales.id');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($r) => $this->invoiceOut((int) $r->id)));
    }

    public function invoice(int $id): JsonResponse
    {
        return response()->json($this->invoiceOut($id));
    }

    private function paymentRules(): array
    {
        return ['payments' => 'nullable|array|max:5', 'payments.*.method' => 'required|in:cash,card,transfer',
            'payments.*.amount' => 'required|numeric|min:0.01', 'payments.*.reference' => 'nullable|string|max:60'];
    }

    public function storeInvoice(Request $request): JsonResponse
    {
        $d = $request->validate(['challanId' => 'required|integer|exists:challans,id'] + $this->paymentRules());
        $u = $request->user();
        $id = DB::transaction(function () use ($d, $u) {
            $c = DB::table('challans')->lockForUpdate()->find($d['challanId']);
            abort_if($c->sale_id, 409, 'This challan is already invoiced.');
            $o = DB::table('sales_orders')->find($c->sales_order_id);
            $cust = DB::table('customers')->find($o->customer_id);
            $lines = DB::table('challan_lines')->join('sales_order_lines', 'sales_order_lines.id', '=', 'challan_lines.sales_order_line_id')
                ->where('challan_id', $c->id)->get(['challan_lines.*', 'sales_order_lines.unit_price']);
            $total = self::m($lines->sum(fn ($l) => $l->qty * $l->unit_price));
            $paid = self::m(array_sum(array_column($d['payments'] ?? [], 'amount')));
            if ($paid > $total + 0.001) {
                throw ValidationException::withMessages(['payments' => 'Payment is more than the invoice.']);
            }
            $credit = self::m($total - $paid);
            if ($credit > 0.004) {
                $limit = (float) $cust->credit_limit;
                if ($limit <= 0) {
                    throw ValidationException::withMessages(['payments' => 'This customer has no credit. Take full payment.']);
                }
                $due = self::outstanding((int) $cust->id);
                if ($due + $credit > $limit + 0.001) {
                    throw ValidationException::withMessages(['payments' => 'Credit limit exceeded. Limit '.$limit.', already due '.$due.', this bill adds '.$credit.'.']);
                }
            }
            $number = $this->numbers->next('invoice');
            $now = now();
            $sid = DB::table('sales')->insertGetId(['number' => $number, 'channel' => 'wholesale', 'warehouse_id' => $c->warehouse_id,
                'customer_id' => $cust->id, 'subtotal' => $total, 'discount' => 0, 'total' => $total, 'paid' => $paid, 'change_due' => 0,
                'note' => $o->number, 'challan_id' => $c->id, 'due_date' => $now->copy()->addDays((int) $cust->payment_terms_days)->toDateString(),
                'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            foreach ($lines as $l) {
                DB::table('sale_lines')->insert(['sale_id' => $sid, 'product_id' => $l->product_id, 'serial' => $l->serial, 'qty' => $l->qty,
                    'unit_price' => $l->unit_price, 'warranty_months' => (int) DB::table('products')->where('id', $l->product_id)->value('warranty_months')]);
            }
            foreach ($d['payments'] ?? [] as $p) {
                DB::table('sale_payments')->insert(['sale_id' => $sid, 'method' => $p['method'], 'amount' => self::m((float) $p['amount']),
                    'reference' => trim($p['reference'] ?? '') ?: null, 'paid_at' => $now]);
            }
            DB::table('challans')->where('id', $c->id)->update(['sale_id' => $sid, 'updated_at' => $now]);
            AuditLog::record($u, 'invoice.created', null, ['number' => $number, 'total' => $total, 'credit' => $credit]);

            return $sid;
        });

        return response()->json($this->invoiceOut($id), 201);
    }

    public function receivePayment(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['method' => 'required|in:cash,card,transfer', 'amount' => 'required|numeric|min:0.01',
            'reference' => 'nullable|string|max:60']);
        $u = $request->user();
        DB::transaction(function () use ($id, $d, $u) {
            $s = DB::table('sales')->lockForUpdate()->find($id);
            abort_unless($s, 404, 'Invoice not found.');
            $balance = self::m((float) $s->total - (float) $s->paid + (float) $s->change_due - self::creditReturns(fn ($q) => $q->where('sales.id', $id)));
            $amt = self::m((float) $d['amount']);
            if ($amt > $balance + 0.001) {
                throw ValidationException::withMessages(['amount' => "Only {$balance} is due on this invoice."]);
            }
            DB::table('sale_payments')->insert(['sale_id' => $id, 'method' => $d['method'], 'amount' => $amt,
                'reference' => trim($d['reference'] ?? '') ?: null, 'paid_at' => now()]);
            DB::table('sales')->where('id', $id)->update(['paid' => self::m((float) $s->paid + $amt), 'updated_at' => now()]);
            AuditLog::record($u, 'invoice.payment', null, ['number' => $s->number, 'amount' => $amt]);
        });

        return response()->json($this->invoiceOut($id));
    }
}
