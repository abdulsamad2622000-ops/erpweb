<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Grn;
use App\Models\GrnLandedCost;
use App\Models\GrnSerial;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\PurchaseReturn;
use App\Models\PurchaseReturnLine;
use App\Models\StockMovement;
use App\Models\StockSerial;
use App\Models\Supplier;
use App\Models\SupplierBill;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Services\NumberSeriesService;
use App\Services\ProductInfo;
use App\Services\StockHolds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 8b: supplier ledger, payments, landed cost, PO/GRN/bill matching, purchase returns. */
class PayablesController extends Controller
{
    private const MIN_REASON = 10;

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    public function ledger(Supplier $supplier): JsonResponse
    {
        return response()->json(['supplierId' => $supplier->id, 'entries' => $this->ledgerFor($supplier)]);
    }

    /** Supplier ko kitna dena hai: opening + GRN maal - returns - payments. */
    private function ledgerFor(Supplier $s): array
    {
        $out = [];
        if ((float) $s->opening_balance > 0) {
            $out[] = ['id' => 'open', 'date' => $s->created_at?->toDateString(), 'type' => 'opening', 'ref' => 'Opening balance', 'increase' => (float) $s->opening_balance, 'decrease' => 0];
        }
        $grns = Grn::where('status', 'posted')->whereHas('order', fn ($q) => $q->where('supplier_id', $s->id))->with('order.lines', 'lines', 'serials')->orderBy('posted_at')->get();
        foreach ($grns as $g) {
            $out[] = ['id' => "grn-{$g->id}", 'date' => $g->posted_at->toDateString(), 'type' => 'grn', 'ref' => $g->number, 'increase' => $this->grnValue($g), 'decrease' => 0];
        }
        foreach (PurchaseReturn::where('supplier_id', $s->id)->orderBy('id')->get() as $r) {
            $out[] = ['id' => "ret-{$r->id}", 'date' => $r->date, 'type' => 'return', 'ref' => $r->number, 'increase' => 0, 'decrease' => (float) $r->total];
        }
        foreach (SupplierPayment::where('supplier_id', $s->id)->orderBy('id')->get() as $p) {
            $out[] = ['id' => "pay-{$p->id}", 'date' => $p->date, 'type' => 'payment', 'ref' => $p->reference ?: "Payment {$p->id}", 'increase' => 0, 'decrease' => (float) $p->amount];
        }

        return $out;
    }

    private function grnValue(Grn $g): float
    {
        $sum = 0.0;
        foreach ($g->lines as $l) {
            $cost = (float) ($g->order->lines->firstWhere('product_id', $l->product_id)?->unit_cost ?? 0);
            $qty = ProductInfo::get($l->product_id)['serialized']
                ? $g->serials->where('product_id', $l->product_id)->where('status', 'accepted')->count()
                : $l->qty;
            $sum += $qty * $cost;
        }

        return round($sum, 2);
    }

    private function outstanding(Supplier $s): float
    {
        return round(array_sum(array_map(fn ($e) => $e['increase'] - $e['decrease'], $this->ledgerFor($s))), 2);
    }

    public function payments(Request $request): JsonResponse
    {
        $q = SupplierPayment::query()->orderByDesc('id');
        if ($v = $request->query('supplierId')) {
            $q->where('supplier_id', $v);
        }
        $users = User::pluck('name', 'id');

        return response()->json($q->limit(500)->get()->map(fn ($p) => $this->paymentOut($p, $users)));
    }

    public function storePayment(Request $request): JsonResponse
    {
        $d = $request->validate([
            'supplierId' => 'required|integer|exists:suppliers,id',
            'date' => 'required|date|before_or_equal:today',
            'amount' => 'required|numeric|gt:0|max:100000000',
            'method' => 'required|in:cash,bank_transfer,cheque',
            'reference' => 'nullable|string|max:100',
            'note' => 'nullable|string|max:500',
        ]);
        $p = DB::transaction(function () use ($d, $request) {
            $s = Supplier::whereKey($d['supplierId'])->lockForUpdate()->first();
            if (round((float) $d['amount'], 2) > $this->outstanding($s)) {
                throw ValidationException::withMessages(['amount' => 'This is more than the amount owed to the supplier.']);
            }
            $p = SupplierPayment::create([
                'supplier_id' => $s->id, 'date' => $d['date'], 'amount' => round((float) $d['amount'], 2), 'method' => $d['method'],
                'reference' => trim($d['reference'] ?? ''), 'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $request->user()->id,
            ]);
            AuditLog::record($request->user(), 'supplier.payment', null, ['supplier' => $s->name, 'amount' => $p->amount]);

            return $p;
        });

        return response()->json($this->paymentOut($p, User::pluck('name', 'id')), 201);
    }

    private function paymentOut(SupplierPayment $p, $users): array
    {
        return ['id' => $p->id, 'supplierId' => $p->supplier_id, 'date' => (string) $p->date, 'amount' => (float) $p->amount, 'method' => $p->method,
            'reference' => (string) $p->reference, 'note' => $p->note, 'createdBy' => $users[$p->created_by] ?? 'System'];
    }

    public function landedCost(Grn $grn): JsonResponse
    {
        return response()->json(['grnId' => $grn->id, 'items' => $grn->landedCosts->map(fn ($i) => ['label' => $i->label, 'amount' => (float) $i->amount])->values()]);
    }

    public function saveLandedCost(Request $request, Grn $grn): JsonResponse
    {
        if ($grn->status !== 'posted') {
            abort(409, 'Add landed cost after the GRN is posted.');
        }
        $d = $request->validate([
            'items' => 'present|array|max:20',
            'items.*.label' => 'required|string|max:100',
            'items.*.amount' => 'required|numeric|gt:0|max:10000000',
        ]);
        DB::transaction(function () use ($grn, $d, $request) {
            GrnLandedCost::where('grn_id', $grn->id)->delete();
            foreach ($d['items'] as $i) {
                GrnLandedCost::create(['grn_id' => $grn->id, 'label' => trim($i['label']), 'amount' => round((float) $i['amount'], 2)]);
            }
            AuditLog::record($request->user(), 'grn.landed_cost', null, ['grn' => $grn->number, 'total' => array_sum(array_column($d['items'], 'amount'))]);
        });

        return $this->landedCost($grn->fresh());
    }

    public function matching(PurchaseOrder $order): JsonResponse
    {
        return response()->json($this->matchingFor($order));
    }

    private function matchingFor(PurchaseOrder $po): array
    {
        $po->load('lines', 'bill');

        return [
            'poId' => $po->id, 'poNumber' => $po->number,
            'lines' => $po->lines->map(fn ($l) => ['productId' => $l->product_id, 'name' => ProductInfo::get($l->product_id)['name'],
                'orderedQty' => $l->qty, 'receivedQty' => $l->received_qty, 'unitCost' => (float) $l->unit_cost])->values(),
            'grnNumbers' => Grn::where('purchase_order_id', $po->id)->where('status', 'posted')->orderBy('id')->pluck('number'),
            'bill' => $po->bill ? $this->billOut($po->bill) : null,
        ];
    }

    public function saveBill(Request $request, PurchaseOrder $order): JsonResponse
    {
        if (! $order->lines()->where('received_qty', '>', 0)->exists()) {
            abort(409, 'Nothing is received on this order yet.');
        }
        $d = $request->validate(['number' => 'required|string|max:60', 'billDate' => 'required|date', 'amount' => 'required|numeric|gt:0']);
        $bill = SupplierBill::updateOrCreate(['purchase_order_id' => $order->id], [
            'number' => trim($d['number']), 'bill_date' => $d['billDate'], 'amount' => round((float) $d['amount'], 2),
        ]);
        AuditLog::record($request->user(), 'purchase_order.bill', null, ['po' => $order->number, 'bill' => $bill->number]);

        return response()->json($this->billOut($bill));
    }

    private function billOut(SupplierBill $b): array
    {
        return ['poId' => $b->purchase_order_id, 'number' => $b->number, 'billDate' => (string) $b->bill_date, 'amount' => (float) $b->amount];
    }

    // ---------- Purchase returns ----------

    public function returns(): JsonResponse
    {
        $users = User::pluck('name', 'id');

        return response()->json(PurchaseReturn::with('lines', 'supplier')->orderByDesc('id')->limit(500)->get()->map(fn ($r) => $this->returnOut($r, $users)));
    }

    public function returnableSerial(string $serial): JsonResponse
    {
        $serial = PurchaseController::normalizeSerial(urldecode($serial));
        $r = $this->received($serial);
        if (! $r) {
            abort(404, 'This serial was not received through a posted GRN.');
        }
        if ($r['stock']->status === 'returned') {
            abort(409, 'This serial is already returned to the supplier.');
        }

        return response()->json([
            'serial' => $serial, 'productId' => $r['stock']->product_id, 'name' => $r['info']['name'], 'sku' => $r['info']['sku'],
            'supplierId' => $r['po']->supplier_id, 'supplierName' => (string) $r['po']->supplier?->name, 'grnNumber' => $r['grn']->number,
            'unitCost' => (float) $r['stock']->unit_cost,
        ]);
    }

    public function storeReturn(Request $request): JsonResponse
    {
        $d = $request->validate([
            'supplierId' => 'required|integer|exists:suppliers,id',
            'serials' => 'required|array|min:1|max:200',
            'serials.*' => 'required|string|max:60',
            'reason' => 'required|string|min:'.self::MIN_REASON.'|max:500',
        ], ['reason.min' => 'Write a reason of at least '.self::MIN_REASON.' characters.']);
        $actor = $request->user();

        $ret = DB::transaction(function () use ($d, $actor) {
            $lines = [];
            foreach ($d['serials'] as $raw) {
                $serial = PurchaseController::normalizeSerial($raw);
                $r = $this->received($serial, true);
                if (! $r) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} was not received through a posted GRN."]);
                }
                if ($r['po']->supplier_id !== (int) $d['supplierId']) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} belongs to {$r['po']->supplier?->name}."]);
                }
                if ($r['stock']->status === 'returned' || isset($lines[$serial])) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is already returned."]);
                }
                if ($held = StockHolds::reservedRef($serial)) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is reserved ({$held}). Release the reservation first."]);
                }
                if ($r['stock']->warehouse_id === null) {
                    throw ValidationException::withMessages(['serials' => "Serial {$serial} is in transit between warehouses."]);
                }
                $lines[$serial] = $r;
            }
            $ret = PurchaseReturn::create([
                'number' => $this->numbers->next('purchase_return'), 'supplier_id' => $d['supplierId'], 'date' => now()->toDateString(),
                'total' => round(array_sum(array_map(fn ($r) => (float) $r['stock']->unit_cost, $lines)), 2), 'reason' => trim($d['reason']),
                'created_by' => $actor->id,
            ]);
            foreach ($lines as $serial => $r) {
                PurchaseReturnLine::create(['purchase_return_id' => $ret->id, 'serial' => $serial, 'product_id' => $r['stock']->product_id, 'unit_cost' => $r['stock']->unit_cost]);
                StockMovement::create(['at' => now(), 'direction' => 'out', 'type' => 'return', 'serial' => $serial, 'product_id' => $r['stock']->product_id,
                    'warehouse_id' => $r['stock']->warehouse_id, 'ref' => $ret->number, 'note' => $ret->reason, 'user_id' => $actor->id]);
                $r['stock']->update(['status' => 'returned', 'bin_id' => null]);
            }
            AuditLog::record($actor, 'purchase_return.created', null, ['number' => $ret->number, 'serials' => count($lines)]);

            return $ret;
        });

        return response()->json($this->returnOut($ret->fresh(), User::pluck('name', 'id')), 201);
    }

    /** Posted GRN se accepted aaya serial (stock row ke saath). */
    private function received(string $serial, bool $lock = false): ?array
    {
        $q = StockSerial::where('serial', $serial)->whereNotNull('grn_id');
        $stock = $lock ? $q->lockForUpdate()->first() : $q->first();
        if (! $stock || ! in_array($stock->status, ['in_stock', 'returned'], true)) {
            return null;
        }
        if (! GrnSerial::where('grn_id', $stock->grn_id)->where('serial', $serial)->where('status', 'accepted')->exists()) {
            return null;
        }
        $grn = Grn::with('order.supplier')->find($stock->grn_id);

        return ['stock' => $stock, 'grn' => $grn, 'po' => $grn->order, 'info' => ProductInfo::get($stock->product_id)];
    }

    private function returnOut(PurchaseReturn $r, $users): array
    {
        $r->loadMissing('lines', 'supplier');

        return [
            'id' => $r->id, 'number' => $r->number, 'supplierId' => $r->supplier_id, 'supplierName' => (string) $r->supplier?->name,
            'date' => (string) $r->date, 'total' => (float) $r->total, 'reason' => $r->reason, 'createdBy' => $users[$r->created_by] ?? 'System',
            'lines' => $r->lines->map(fn ($l) => ['serial' => $l->serial, 'name' => ProductInfo::get($l->product_id)['name'], 'unitCost' => (float) $l->unit_cost])->values(),
        ];
    }

    /** Purchase line ka unit cost (labels aur doosri jagah). */
    public static function unitCostFor(int $poId, int $productId): float
    {
        return (float) (PurchaseOrderLine::where('purchase_order_id', $poId)->where('product_id', $productId)->value('unit_cost') ?? 0);
    }
}
