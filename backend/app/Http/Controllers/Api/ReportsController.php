<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionResolver;
use App\Services\ProductInfo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Step 15: dashboard numbers + reports (sales/profit, stock value, purchases, repairs). */
class ReportsController extends Controller
{
    private static function m(float $v): float
    {
        return round($v, 2);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private static function range(Request $request): array
    {
        $d = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $to = isset($d['to']) ? Carbon::parse($d['to'])->endOfDay() : now()->endOfDay();
        $from = isset($d['from']) ? Carbon::parse($d['from'])->startOfDay() : $to->copy()->startOfMonth();

        return [$from, $to];
    }

    /** Har sale line: revenue (bill discount baant kar), cost (serial ki unit cost, warna product cost). */
    private static function saleLines(Carbon $from, Carbon $to)
    {
        $rows = DB::table('sale_lines')->join('sales', 'sales.id', '=', 'sale_lines.sale_id')
            ->whereBetween('sales.created_at', [$from, $to])
            ->get(['sale_lines.*', 'sales.subtotal', 'sales.total', 'sales.channel', 'sales.created_at as sold_at', 'sales.created_by', 'sales.id as sid']);
        $serialCost = DB::table('stock_serials')->whereIn('serial', $rows->pluck('serial')->filter()->all())->pluck('unit_cost', 'serial');
        $variantCost = DB::table('product_variants')->whereIn('product_id', $rows->pluck('product_id')->unique()->all())
            ->orderBy('id')->get(['product_id', 'cost_price'])->groupBy('product_id')->map(fn ($g) => (float) $g->first()->cost_price);

        return $rows->map(function ($l) use ($serialCost, $variantCost) {
            $ratio = (float) $l->subtotal > 0 ? (float) $l->total / (float) $l->subtotal : 1;
            $qty = $l->qty - $l->returned_qty;
            $unitCost = $l->serial && isset($serialCost[$l->serial]) ? (float) $serialCost[$l->serial] : (float) ($variantCost[$l->product_id] ?? 0);
            $l->net_qty = $qty;
            $l->revenue = self::m($qty * (float) $l->unit_price * $ratio);
            $l->cost = self::m($qty * $unitCost);

            return $l;
        });
    }

    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = self::range($request);
        $by = in_array($request->query('groupBy'), ['day', 'product', 'staff', 'channel'], true) ? $request->query('groupBy') : 'day';
        $lines = self::saleLines($from, $to);
        $groups = $lines->groupBy(fn ($l) => match ($by) {
            'day' => Carbon::parse($l->sold_at)->toDateString(),
            'product' => (string) $l->product_id,
            'staff' => (string) ($l->created_by ?? 0),
            'channel' => $l->channel,
        });
        $rows = $groups->map(function ($g, $key) use ($by) {
            $label = match ($by) {
                'product' => ProductInfo::get((int) $key)['name'],
                'staff' => (string) (DB::table('users')->where('id', (int) $key)->value('name') ?: '—'),
                default => $key,
            };
            $rev = self::m($g->sum('revenue'));
            $cost = self::m($g->sum('cost'));

            return ['key' => (string) $key, 'label' => $label, 'bills' => $g->pluck('sid')->unique()->count(), 'qty' => (int) $g->sum('net_qty'),
                'revenue' => $rev, 'cost' => $cost, 'profit' => self::m($rev - $cost), 'margin' => $rev > 0 ? round(($rev - $cost) / $rev * 100, 1) : 0.0];
        })->values()->sortBy($by === 'day' ? 'key' : fn ($r) => -$r['revenue'])->values();
        $refunds = (float) DB::table('sales_returns')->whereBetween('created_at', [$from, $to])->sum('amount');
        $rev = self::m($rows->sum('revenue'));
        $cost = self::m($rows->sum('cost'));

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'groupBy' => $by, 'rows' => $rows,
            'totals' => ['bills' => $lines->pluck('sid')->unique()->count(), 'qty' => (int) $rows->sum('qty'), 'revenue' => $rev, 'cost' => $cost,
                'profit' => self::m($rev - $cost), 'margin' => $rev > 0 ? round(($rev - $cost) / $rev * 100, 1) : 0.0, 'returns' => self::m($refunds)]]);
    }

    public function stock(Request $request): JsonResponse
    {
        $wh = $request->query('warehouseId');
        $q = DB::table('stock_serials')->where('status', 'in_stock')->when($wh, fn ($w) => $w->where('warehouse_id', (int) $wh));
        $rows = $q->get(['product_id', 'warehouse_id', 'unit_cost', 'created_at'])->groupBy('product_id')->map(function ($g, $pid) {
            $p = ProductInfo::get((int) $pid);
            $value = self::m($g->sum(fn ($s) => (float) $s->unit_cost));
            $oldest = $g->min('created_at');

            return ['productId' => (int) $pid, 'name' => $p['name'], 'sku' => $p['sku'], 'units' => $g->count(), 'value' => $value,
                'retailValue' => $p['price'] !== null ? self::m($p['price'] * $g->count()) : null,
                'oldestDays' => $oldest ? (int) Carbon::parse($oldest)->diffInDays(now()) : 0];
        })->sortByDesc('value')->values();

        return response()->json(['rows' => $rows, 'totals' => ['units' => (int) $rows->sum('units'), 'value' => self::m($rows->sum('value')),
            'retailValue' => self::m($rows->sum(fn ($r) => $r['retailValue'] ?? 0))],
            'byStatus' => DB::table('stock_serials')->select('status', DB::raw('count(*) as n'))->groupBy('status')->pluck('n', 'status')]);
    }

    public function purchases(Request $request): JsonResponse
    {
        [$from, $to] = self::range($request);
        $bills = DB::table('supplier_bills')->join('purchase_orders', 'purchase_orders.id', '=', 'supplier_bills.purchase_order_id')
            ->whereBetween('supplier_bills.bill_date', [$from->toDateString(), $to->toDateString()])
            ->get(['purchase_orders.supplier_id', 'supplier_bills.amount']);
        $pays = DB::table('supplier_payments')->whereBetween('date', [$from->toDateString(), $to->toDateString()])->get(['supplier_id', 'amount']);
        $ids = $bills->pluck('supplier_id')->merge($pays->pluck('supplier_id'))->unique();
        $rows = $ids->map(function ($sid) use ($bills, $pays) {
            $allBills = (float) DB::table('supplier_bills')->join('purchase_orders', 'purchase_orders.id', '=', 'supplier_bills.purchase_order_id')
                ->where('purchase_orders.supplier_id', $sid)->sum('supplier_bills.amount');
            $allPaid = (float) DB::table('supplier_payments')->where('supplier_id', $sid)->sum('amount');

            return ['supplierId' => (int) $sid, 'name' => (string) DB::table('suppliers')->where('id', $sid)->value('name'),
                'bills' => $bills->where('supplier_id', $sid)->count(), 'billed' => self::m($bills->where('supplier_id', $sid)->sum('amount')),
                'paid' => self::m($pays->where('supplier_id', $sid)->sum('amount')), 'payable' => self::m($allBills - $allPaid)];
        })->sortByDesc('billed')->values();

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'rows' => $rows,
            'totals' => ['bills' => (int) $rows->sum('bills'), 'billed' => self::m($rows->sum('billed')), 'paid' => self::m($rows->sum('paid')),
                'payable' => self::m($rows->sum('payable'))]]);
    }

    public function repairs(Request $request): JsonResponse
    {
        [$from, $to] = self::range($request);
        $done = DB::table('repair_jobs')->where('status', 'delivered')->whereBetween('delivered_at', [$from, $to])->get();
        $parts = (float) DB::table('repair_parts')->whereIn('repair_job_id', $done->pluck('id'))->selectRaw('COALESCE(SUM(qty * unit_price), 0) as t')->value('t');

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(),
            'delivered' => $done->count(), 'income' => self::m($done->sum('paid')), 'labour' => self::m($done->sum('labour')), 'parts' => self::m($parts),
            'inWarranty' => $done->where('warranty', 'in_warranty')->count(),
            'received' => DB::table('repair_jobs')->whereBetween('created_at', [$from, $to])->count(),
            'open' => DB::table('repair_jobs')->whereNotIn('status', ['delivered', 'cancelled'])->select('status', DB::raw('count(*) as n'))
                ->groupBy('status')->pluck('n', 'status'),
            'byTechnician' => $done->groupBy('assigned_to')->map(fn ($g, $uid) => ['name' => (string) (DB::table('users')->where('id', $uid)->value('name') ?: '—'),
                'jobs' => $g->count(), 'income' => self::m($g->sum('paid'))])->values()]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $u = $request->user();
        $money = $u->type === 'super_admin' || app(PermissionResolver::class)->has($u, 'reports.report.view');
        $today = now()->startOfDay();
        $month = now()->startOfMonth();
        $salesBetween = fn ($a, $b) => DB::table('sales')->whereBetween('created_at', [$a, $b]);
        $series = collect(range(13, 0))->map(function ($i) {
            $d = now()->subDays($i);

            return ['date' => $d->toDateString(), 'total' => (float) DB::table('sales')->whereBetween('created_at', [$d->copy()->startOfDay(), $d->copy()->endOfDay()])->sum('total')];
        });
        $out = [
            'todaySales' => (float) $salesBetween($today, now())->sum('total'), 'todayBills' => $salesBetween($today, now())->count(),
            'monthSales' => (float) $salesBetween($month, now())->sum('total'), 'last14' => $series,
            'stockUnits' => DB::table('stock_serials')->where('status', 'in_stock')->count(),
            'openRepairs' => DB::table('repair_jobs')->whereNotIn('status', ['delivered', 'cancelled'])->count(),
            'readyRepairs' => DB::table('repair_jobs')->where('status', 'ready')->count(),
            'openOrders' => DB::table('sales_orders')->whereIn('status', ['open', 'partial'])->count(),
            'pendingPOs' => DB::table('purchase_orders')->whereIn('status', ['pending_approval', 'approved', 'partially_received'])->count(),
            'canSeeMoney' => $money,
        ];
        if ($money) {
            $lines = self::saleLines($month, now()->endOfDay());
            $receivable = (float) DB::table('sales')->selectRaw('COALESCE(SUM(total - paid + change_due), 0) as b')->value('b')
                - (float) DB::table('sales_returns')->where('refund_method', 'credit')->sum('amount');
            $overdue = (float) DB::table('sales')->whereNotNull('due_date')->where('due_date', '<', now()->toDateString())
                ->selectRaw('COALESCE(SUM(total - paid + change_due), 0) as b')->value('b');
            $out += [
                'monthProfit' => self::m($lines->sum('revenue') - $lines->sum('cost')),
                'stockValue' => self::m((float) DB::table('stock_serials')->where('status', 'in_stock')->sum('unit_cost')),
                'receivable' => self::m(max($receivable, 0)), 'overdue' => self::m(max($overdue, 0)),
                'payable' => self::m((float) DB::table('supplier_bills')->sum('amount') - (float) DB::table('supplier_payments')->sum('amount')),
                'topProducts' => $lines->groupBy('product_id')->map(fn ($g, $pid) => ['name' => ProductInfo::get((int) $pid)['name'],
                    'qty' => (int) $g->sum('net_qty'), 'revenue' => self::m($g->sum('revenue'))])->sortByDesc('revenue')->take(5)->values(),
            ];
        }

        return response()->json($out);
    }
}
