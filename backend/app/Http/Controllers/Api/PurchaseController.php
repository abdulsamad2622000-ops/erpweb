<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Grn;
use App\Models\GrnLine;
use App\Models\GrnSerial;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderLine;
use App\Models\StockMovement;
use App\Models\StockSerial;
use App\Models\Supplier;
use App\Services\NumberSeriesService;
use App\Services\ProductInfo;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Purchase: suppliers, purchase orders (approval flow), GRN with serial capture. Frontend contract shape. */
class PurchaseController extends Controller
{
    public const SERIAL_RE = '/^[A-Z0-9][A-Z0-9-]{3,39}$/';

    private const NEXT = [
        'submit' => [['draft', 'rejected'], 'pending_approval'],
        'approve' => [['pending_approval'], 'approved'],
        'reject' => [['pending_approval'], 'rejected'],
        'cancel' => [['draft', 'rejected', 'approved'], 'cancelled'],
    ];

    public function __construct(private NumberSeriesService $numbers)
    {
    }

    public static function normalizeSerial(?string $s): string
    {
        return strtoupper(preg_replace('/\s+/', '', trim((string) $s)));
    }

    // ---------- Suppliers ----------

    public function suppliers(Request $request): JsonResponse
    {
        $q = Supplier::query();
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('phone', 'like', "%{$v}%")->orWhere('city', 'like', "%{$v}%"));
        }
        ApiQuery::sort($q, $request, ['name' => 'name', 'city' => 'city'], 'name');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 50)), fn ($s) => $this->supplierOut($s)));
    }

    public function storeSupplier(Request $request): JsonResponse
    {
        $s = Supplier::create($this->supplierData($request));
        AuditLog::record($request->user(), 'supplier.created', null, ['supplier' => $s->name]);

        return response()->json($this->supplierOut($s), 201);
    }

    public function updateSupplier(Request $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($this->supplierData($request, $supplier));
        AuditLog::record($request->user(), 'supplier.updated', null, ['supplier' => $supplier->name]);

        return response()->json($this->supplierOut($supplier));
    }

    private function supplierData(Request $request, ?Supplier $s = null): array
    {
        $d = $request->validate([
            'name' => 'required|string|max:120',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:120',
            'city' => 'nullable|string|max:60',
            'taxNumber' => 'nullable|string|max:30',
            'paymentTermsDays' => 'required|integer|min:0|max:365',
            'isActive' => 'required|boolean',
        ]);
        $name = trim($d['name']);
        $taken = Supplier::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->when($s, fn ($q) => $q->whereKeyNot($s->id))->exists();
        if ($taken) {
            throw ValidationException::withMessages(['name' => 'This supplier already exists.']);
        }

        return [
            'name' => $name, 'phone' => trim($d['phone'] ?? ''), 'email' => trim($d['email'] ?? ''), 'city' => trim($d['city'] ?? ''),
            'tax_number' => trim($d['taxNumber'] ?? ''), 'payment_terms_days' => $d['paymentTermsDays'], 'is_active' => $d['isActive'],
        ];
    }

    private function supplierOut(Supplier $s): array
    {
        return [
            'id' => $s->id, 'name' => $s->name, 'phone' => $s->phone, 'email' => $s->email, 'city' => $s->city,
            'taxNumber' => $s->tax_number, 'paymentTermsDays' => (int) $s->payment_terms_days, 'isActive' => (bool) $s->is_active,
        ];
    }

    // ---------- Purchase orders ----------

    public function orders(): JsonResponse
    {
        return response()->json(PurchaseOrder::with(['lines', 'supplier', 'approver'])->orderByDesc('id')->limit(500)->get()->map(fn ($o) => $this->orderOut($o)));
    }

    public function order(PurchaseOrder $order): JsonResponse
    {
        return response()->json($this->orderOut($order));
    }

    public function storeOrder(Request $request): JsonResponse
    {
        [$header, $lines] = $this->orderData($request);
        $order = DB::transaction(function () use ($request, $header, $lines) {
            $o = PurchaseOrder::create($header + ['number' => $this->numbers->next('po'), 'status' => 'draft', 'created_by' => $request->user()->id]);
            foreach ($lines as $l) {
                $o->lines()->create($l);
            }
            AuditLog::record($request->user(), 'purchase_order.created', null, ['number' => $o->number]);

            return $o;
        });

        return response()->json($this->orderOut($order->fresh()), 201);
    }

    public function updateOrder(Request $request, PurchaseOrder $order): JsonResponse
    {
        if (! in_array($order->status, ['draft', 'rejected'], true)) {
            abort(409, 'Only draft or rejected orders can be edited.');
        }
        [$header, $lines] = $this->orderData($request);
        DB::transaction(function () use ($order, $header, $lines) {
            $order->update($header);
            $order->lines()->delete();
            foreach ($lines as $l) {
                $order->lines()->create($l);
            }
        });

        return response()->json($this->orderOut($order->fresh()));
    }

    public function orderAction(Request $request, PurchaseOrder $order, string $action): JsonResponse
    {
        abort_unless(isset(self::NEXT[$action]), 404);
        $note = trim((string) $request->input('note', '')) ?: null;
        [$from, $to] = self::NEXT[$action];
        if (! in_array($order->status, $from, true)) {
            abort(409, 'This order cannot be '.($action === 'submit' ? 'submitted' : $action.'d').' now.');
        }
        if ($action === 'reject' && ! $note) {
            throw ValidationException::withMessages(['note' => 'A reason is required to reject.']);
        }
        $attrs = ['status' => $to];
        if ($action === 'approve') {
            $attrs['approved_by'] = $request->user()->id;
        }
        if (in_array($action, ['approve', 'reject'], true)) {
            $attrs['approval_note'] = $note;
        }
        $order->update($attrs);
        AuditLog::record($request->user(), 'purchase_order.'.$action, null, ['number' => $order->number]);

        return response()->json($this->orderOut($order->fresh()));
    }

    /** @return array{0: array, 1: array} */
    private function orderData(Request $request): array
    {
        $d = $request->validate([
            'supplierId' => ['required', 'integer', Rule::exists('suppliers', 'id')->where('is_active', true)],
            'warehouseId' => 'required|integer|exists:warehouses,id',
            'orderDate' => 'required|date',
            'expectedDate' => 'nullable|date|after_or_equal:orderDate',
            'terms' => 'nullable|string|max:255',
            'lines' => 'required|array|min:1|max:100',
            'lines.*.productId' => 'required|integer|distinct|exists:products,id',
            'lines.*.qty' => 'required|integer|min:1|max:100000',
            'lines.*.unitCost' => 'required|numeric|min:0',
        ], ['lines.*.productId.distinct' => 'The same product is added twice.']);

        return [
            ['supplier_id' => $d['supplierId'], 'warehouse_id' => $d['warehouseId'], 'order_date' => $d['orderDate'],
                'expected_date' => $d['expectedDate'] ?? null, 'terms' => trim($d['terms'] ?? '')],
            array_map(fn ($l) => ['product_id' => $l['productId'], 'qty' => $l['qty'], 'unit_cost' => round((float) $l['unitCost'], 2)], $d['lines']),
        ];
    }

    public function orderOut(PurchaseOrder $o): array
    {
        $o->loadMissing(['lines', 'supplier', 'approver']);

        return [
            'id' => $o->id, 'number' => $o->number, 'supplierId' => $o->supplier_id, 'supplierName' => (string) $o->supplier?->name,
            'warehouseId' => $o->warehouse_id, 'orderDate' => $o->order_date->toDateString(), 'expectedDate' => $o->expected_date?->toDateString(),
            'terms' => (string) $o->terms, 'status' => $o->status, 'approvalNote' => $o->approval_note, 'approvedBy' => $o->approver?->name,
            'lines' => $o->lines->map(function ($l) {
                $p = ProductInfo::get($l->product_id);

                return ['productId' => $l->product_id, 'sku' => $p['sku'], 'name' => $p['name'], 'serialized' => $p['serialized'],
                    'qty' => $l->qty, 'unitCost' => $l->unit_cost, 'receivedQty' => $l->received_qty];
            })->values(),
        ];
    }

    // ---------- GRN ----------

    public function grns(): JsonResponse
    {
        return response()->json(Grn::with(['order.supplier', 'order.lines', 'lines', 'serials'])->orderByDesc('id')->limit(500)->get()->map(fn ($g) => $this->grnOut($g)));
    }

    public function grn(Grn $grn): JsonResponse
    {
        return response()->json($this->grnOut($grn));
    }

    /** PO se draft GRN (khuli draft ho to wahi). Sirf baqi qty wali lines. */
    public function storeGrn(Request $request): JsonResponse
    {
        $po = PurchaseOrder::findOrFail($request->validate(['poId' => 'required|integer'])['poId']);
        if (! in_array($po->status, ['approved', 'partially_received'], true)) {
            abort(409, 'Only approved orders can be received.');
        }
        $open = Grn::where('purchase_order_id', $po->id)->where('status', 'draft')->first();
        if ($open) {
            return response()->json($this->grnOut($open));
        }
        $grn = DB::transaction(function () use ($request, $po) {
            $g = Grn::create(['number' => $this->numbers->next('grn'), 'purchase_order_id' => $po->id, 'warehouse_id' => $po->warehouse_id,
                'status' => 'draft', 'created_by' => $request->user()->id]);
            foreach ($po->lines as $l) {
                if ($l->qty > $l->received_qty) {
                    $g->lines()->create(['product_id' => $l->product_id, 'qty' => 0]);
                }
            }

            return $g;
        });

        return response()->json($this->grnOut($grn->fresh()), 201);
    }

    public function saveGrn(Request $request, Grn $grn): JsonResponse
    {
        $this->assertDraft($grn);
        $lines = $this->grnLines($request, $grn, false);
        DB::transaction(fn () => $this->writeGrnLines($grn, $lines));

        return response()->json($this->grnOut($grn->fresh()));
    }

    public function postGrn(Request $request, Grn $grn): JsonResponse
    {
        $this->assertDraft($grn);
        $lines = $this->grnLines($request, $grn, true);
        $actor = $request->user();

        DB::transaction(function () use ($grn, $lines, $actor) {
            $grn = Grn::whereKey($grn->id)->lockForUpdate()->first();
            $this->assertDraft($grn);
            $this->writeGrnLines($grn, $lines);
            $po = $grn->order()->with('lines')->first();
            $now = now();
            foreach ($lines as $l) {
                $poLine = $po->lines->firstWhere('product_id', $l['productId']);
                $accepted = $l['serialized'] ? count(array_filter($l['serials'], fn ($s) => $s['status'] === 'accepted')) : $l['qty'];
                $poLine->increment('received_qty', $accepted);
                foreach ($l['serials'] as $s) {
                    $status = ['accepted' => 'in_stock', 'quarantine' => 'quarantine', 'rejected' => 'rejected'][$s['status']];
                    StockSerial::updateOrCreate(['serial' => $s['serial']], [
                        'product_id' => $l['productId'], 'warehouse_id' => $grn->warehouse_id, 'status' => $status, 'grn_id' => $grn->id,
                        'supplier_id' => $po->supplier_id, 'unit_cost' => $poLine->unit_cost, 'received_at' => $now,
                    ]);
                    if ($status !== 'rejected') {
                        StockMovement::create(['at' => $now, 'direction' => 'in', 'type' => 'grn', 'serial' => $s['serial'], 'product_id' => $l['productId'],
                            'warehouse_id' => $grn->warehouse_id, 'ref' => $grn->number, 'note' => $s['note'], 'user_id' => $actor->id]);
                    }
                }
            }
            $grn->update(['status' => 'posted', 'posted_at' => $now]);
            $po->refresh()->load('lines');
            $done = $po->lines->every(fn ($x) => $x->received_qty >= $x->qty);
            $any = $po->lines->contains(fn ($x) => $x->received_qty > 0);
            $po->update(['status' => $done ? 'received' : ($any ? 'partially_received' : 'approved')]);
            AuditLog::record($actor, 'grn.posted', null, ['number' => $grn->number, 'po' => $po->number]);
        });

        return response()->json($this->grnOut($grn->fresh()));
    }

    /** Serial ka check: format, stock mein pehle se, kisi aur product ka. */
    public function checkSerial(Request $request): JsonResponse
    {
        $d = $request->validate(['serial' => 'required|string|max:60', 'productId' => 'required|integer']);

        return response()->json($this->serialCheck(self::normalizeSerial($d['serial']), (int) $d['productId']));
    }

    public function serialCheck(string $serial, int $productId): array
    {
        if (! preg_match(self::SERIAL_RE, $serial)) {
            return ['ok' => false, 'reason' => 'invalid_format', 'actualModel' => null];
        }
        $existing = StockSerial::where('serial', $serial)->first();
        if ($existing && $existing->status !== 'rejected') {
            if ($existing->product_id !== $productId && $existing->status === 'returned') {
                return ['ok' => false, 'reason' => 'wrong_model', 'actualModel' => ProductInfo::get($existing->product_id)['name']];
            }
            if ($existing->status !== 'returned') {
                return ['ok' => false, 'reason' => 'duplicate_in_stock', 'actualModel' => null];
            }
        }

        return ['ok' => true, 'reason' => null, 'actualModel' => null];
    }

    private function assertDraft(Grn $grn): void
    {
        if ($grn->status !== 'draft') {
            abort(409, 'This GRN is already posted.');
        }
    }

    /** Request ki lines ko check karke saaf array deta hai. */
    private function grnLines(Request $request, Grn $grn, bool $posting): array
    {
        $request->validate([
            'lines' => 'required|array',
            'lines.*.productId' => 'required|integer',
            'lines.*.qty' => 'nullable|integer|min:0',
            'lines.*.serials' => 'present|array',
            'lines.*.serials.*.serial' => 'required|string|max:60',
            'lines.*.serials.*.status' => 'required|in:accepted,rejected,quarantine',
            'lines.*.serials.*.note' => 'nullable|string|max:255',
        ]);
        $po = $grn->order()->with('lines')->first();
        $seen = [];
        $out = [];
        $anything = false;
        foreach ($request->input('lines') as $l) {
            if (! $grn->lines()->where('product_id', $l['productId'])->exists()) {
                throw ValidationException::withMessages(['lines' => 'Unknown line.']);
            }
            $info = ProductInfo::get((int) $l['productId']);
            $poLine = $po->lines->firstWhere('product_id', $l['productId']);
            $left = $poLine->qty - $poLine->received_qty;
            $serials = [];
            foreach ($l['serials'] as $s) {
                $serial = self::normalizeSerial($s['serial']);
                if (isset($seen[$serial])) {
                    throw ValidationException::withMessages(['lines' => "Serial {$serial} is entered twice."]);
                }
                $seen[$serial] = true;
                $note = trim((string) ($s['note'] ?? '')) ?: null;
                if ($s['status'] !== 'accepted' && ! $note) {
                    throw ValidationException::withMessages(['lines' => "Serial {$serial}: write why it is {$s['status']}."]);
                }
                if ($posting && $s['status'] !== 'rejected' && ! $this->serialCheck($serial, (int) $l['productId'])['ok']) {
                    throw ValidationException::withMessages(['lines' => "Serial {$serial} cannot be accepted."]);
                }
                $serials[] = ['serial' => $serial, 'status' => $s['status'], 'note' => $note];
            }
            $qty = $info['serialized'] ? count(array_filter($serials, fn ($s) => $s['status'] === 'accepted')) : (int) ($l['qty'] ?? 0);
            if (! $info['serialized'] && $serials) {
                throw ValidationException::withMessages(['lines' => "{$info['name']} is not tracked by serial."]);
            }
            if ($qty > $left) {
                throw ValidationException::withMessages(['lines' => "{$info['name']}: only {$left} left to receive."]);
            }
            $anything = $anything || $qty > 0;
            $out[] = ['productId' => (int) $l['productId'], 'serialized' => $info['serialized'], 'qty' => $info['serialized'] ? 0 : $qty, 'serials' => $serials];
        }
        if ($posting && ! $anything) {
            throw ValidationException::withMessages(['lines' => 'Nothing to post. Accept at least one item.']);
        }

        return $out;
    }

    private function writeGrnLines(Grn $grn, array $lines): void
    {
        foreach ($lines as $l) {
            GrnLine::where('grn_id', $grn->id)->where('product_id', $l['productId'])->update(['qty' => $l['qty']]);
            GrnSerial::where('grn_id', $grn->id)->where('product_id', $l['productId'])->delete();
            foreach ($l['serials'] as $s) {
                GrnSerial::create(['grn_id' => $grn->id, 'product_id' => $l['productId']] + $s);
            }
        }
    }

    public function grnOut(Grn $g): array
    {
        $g->loadMissing(['order.supplier', 'order.lines', 'lines', 'serials']);
        $po = $g->order;

        return [
            'id' => $g->id, 'number' => $g->number, 'poId' => $po->id, 'poNumber' => $po->number, 'supplierName' => (string) $po->supplier?->name,
            'warehouseId' => $g->warehouse_id, 'createdAt' => $g->created_at?->toIso8601String(), 'postedAt' => $g->posted_at?->toIso8601String(),
            'status' => $g->status,
            'lines' => $g->lines->map(function ($l) use ($g, $po) {
                $p = ProductInfo::get($l->product_id);
                $poLine = $po->lines->firstWhere('product_id', $l->product_id);
                $serials = $g->serials->where('product_id', $l->product_id)->values();
                $mine = $p['serialized'] ? $serials->where('status', 'accepted')->count() : $l->qty;
                // Posted GRN: pehle se aaya = PO received - is GRN ka hissa
                $prev = $g->status === 'posted' ? max(0, $poLine->received_qty - $mine) : $poLine->received_qty;

                return [
                    'productId' => $l->product_id, 'sku' => $p['sku'], 'name' => $p['name'], 'serialized' => $p['serialized'],
                    'orderedQty' => $poLine->qty, 'previouslyReceived' => $prev, 'qty' => (int) $l->qty,
                    'serials' => $serials->map(fn ($s) => ['serial' => $s->serial, 'productId' => $l->product_id, 'status' => $s->status, 'note' => $s->note])->values(),
                ];
            })->values(),
        ];
    }

    public function destroySupplier(Request $request, Supplier $supplier): Response
    {
        if (PurchaseOrder::where('supplier_id', $supplier->id)->exists()) {
            abort(409, 'This supplier has purchase orders. Turn it off instead of deleting.');
        }
        $supplier->delete();
        AuditLog::record($request->user(), 'supplier.deleted', null, ['supplier' => $supplier->name]);

        return response()->noContent();
    }
}
