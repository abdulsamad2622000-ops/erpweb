<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Memo;
use App\Models\AuditLog;
use App\Services\NumberSeriesService;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Kharche (expenses) aur cash book (cash / bank aamad-kharch roz ke hisaab se). */
class AccountsController extends Controller
{
    public function __construct(private NumberSeriesService $numbers)
    {
    }

    private static function m(float $v): float
    {
        return round($v, 2);
    }

    public function categories(): JsonResponse
    {
        return response()->json(DB::table('expense_categories')->orderBy('name')->get()
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'isActive' => (bool) $c->is_active]));
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $d = $request->validate(['name' => 'required|string|min:2|max:80']);
        $name = trim($d['name']);
        if (DB::table('expense_categories')->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists()) {
            throw ValidationException::withMessages(['name' => 'This category already exists.']);
        }
        $id = DB::table('expense_categories')->insertGetId(['name' => $name, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id, 'name' => $name, 'isActive' => true], 201);
    }

    private function out(object $e): array
    {
        return ['id' => $e->id, 'number' => $e->number, 'date' => $e->date, 'categoryId' => (int) $e->expense_category_id,
            'category' => (string) DB::table('expense_categories')->where('id', $e->expense_category_id)->value('name'),
            'branchId' => $e->branch_id ? (int) $e->branch_id : null, 'amount' => (float) $e->amount, 'method' => $e->method,
            'paidTo' => $e->paid_to, 'reference' => $e->reference, 'note' => $e->note,
            'voided' => (bool) $e->voided_at, 'voidReason' => $e->void_reason,
            'createdBy' => Memo::userName($e->created_by),
            'createdAt' => Carbon::parse($e->created_at)->toIso8601String()];
    }

    public function expenses(Request $request): JsonResponse
    {
        $q = DB::table('expenses');
        if ($v = ApiQuery::param($request, 'from')) {
            $q->where('date', '>=', $v);
        }
        if ($v = ApiQuery::param($request, 'to')) {
            $q->where('date', '<=', $v);
        }
        if ($v = ApiQuery::param($request, 'categoryId')) {
            $q->where('expense_category_id', (int) $v);
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('number', 'like', "%{$v}%")->orWhere('paid_to', 'like', "%{$v}%")->orWhere('note', 'like', "%{$v}%"));
        }
        $sum = (float) (clone $q)->whereNull('voided_at')->sum('amount');
        $q->orderByDesc('date')->orderByDesc('id');

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($e) => $this->out($e)) + ['sum' => self::m($sum)]);
    }

    private function data(Request $request): array
    {
        return $request->validate([
            'date' => 'required|date|before_or_equal:today', 'categoryId' => 'required|integer|exists:expense_categories,id',
            'branchId' => 'nullable|integer|exists:branches,id', 'amount' => 'required|numeric|min:1|max:100000000',
            'method' => 'required|in:cash,card,transfer', 'paidTo' => 'nullable|string|max:120',
            'reference' => 'nullable|string|max:60', 'note' => 'nullable|string|max:500',
        ], ['categoryId.required' => 'Pick a category.', 'amount.required' => 'Enter the amount.', 'date.before_or_equal' => 'Date cannot be in the future.']);
    }

    private function row(array $d): array
    {
        return ['date' => $d['date'], 'expense_category_id' => $d['categoryId'], 'branch_id' => $d['branchId'] ?? null,
            'amount' => self::m((float) $d['amount']), 'method' => $d['method'], 'paid_to' => trim($d['paidTo'] ?? ''),
            'reference' => trim($d['reference'] ?? '') ?: null, 'note' => trim($d['note'] ?? '') ?: null, 'updated_at' => now()];
    }

    public function storeExpense(Request $request): JsonResponse
    {
        $d = $this->data($request);
        $id = DB::table('expenses')->insertGetId($this->row($d) + ['number' => $this->numbers->next('expense'), 'created_by' => $request->user()->id,
            'created_at' => now()]);
        AuditLog::record($request->user(), 'expense.created', null, ['id' => $id, 'amount' => (float) $d['amount']]);

        return response()->json($this->out(DB::table('expenses')->find($id)), 201);
    }

    public function updateExpense(Request $request, int $id): JsonResponse
    {
        $e = DB::table('expenses')->find($id);
        abort_unless($e, 404, 'Expense not found.');
        abort_if($e->voided_at, 409, 'This expense is voided.');
        DB::table('expenses')->where('id', $id)->update($this->row($this->data($request)));
        AuditLog::record($request->user(), 'expense.updated', null, ['id' => $id]);

        return response()->json($this->out(DB::table('expenses')->find($id)));
    }

    public function voidExpense(Request $request, int $id): JsonResponse
    {
        $d = $request->validate(['reason' => 'required|string|min:10|max:500'], ['reason.min' => 'Write a reason of at least 10 characters.']);
        $e = DB::table('expenses')->find($id);
        abort_unless($e, 404, 'Expense not found.');
        abort_if($e->voided_at, 409, 'Already voided.');
        DB::table('expenses')->where('id', $id)->update(['voided_at' => now(), 'void_reason' => trim($d['reason']), 'updated_at' => now()]);
        AuditLog::record($request->user(), 'expense.voided', null, ['id' => $id]);

        return response()->json($this->out(DB::table('expenses')->find($id)));
    }

    /** Ek din/dauran ki sab aamad-kharch entries (method ke hisaab se). */
    public static function movements(Carbon $from, Carbon $to): array
    {
        $rows = [];
        $add = function ($at, string $type, string $ref, string $method, float $in, float $out, ?string $note) use (&$rows) {
            $rows[] = ['at' => Carbon::parse($at), 'type' => $type, 'ref' => $ref, 'method' => $method, 'in' => self::m($in), 'out' => self::m($out), 'note' => $note];
        };
        $pays = DB::table('sale_payments')->join('sales', 'sales.id', '=', 'sale_payments.sale_id')
            ->whereRaw('COALESCE(sale_payments.paid_at, sales.created_at) between ? and ?', [$from, $to])
            ->get(['sale_payments.*', 'sales.number', 'sales.created_at as sold_at', 'sales.channel']);
        foreach ($pays as $p) {
            $add($p->paid_at ?? $p->sold_at, $p->customer_receipt_id ? 'receipt' : 'sale', $p->number, $p->method, (float) $p->amount, 0, $p->reference);
        }
        foreach (DB::table('sales')->where('change_due', '>', 0)->whereBetween('created_at', [$from, $to])->get() as $s) {
            $add($s->created_at, 'change', $s->number, 'cash', 0, (float) $s->change_due, null);
        }
        foreach (DB::table('sales_returns')->where('refund_method', '!=', 'credit')->whereBetween('created_at', [$from, $to])->get() as $r) {
            $add($r->created_at, 'refund', $r->number, $r->refund_method, 0, (float) $r->amount, $r->reason);
        }
        foreach (DB::table('repair_jobs')->where('paid', '>', 0)->whereBetween('delivered_at', [$from, $to])->get() as $j) {
            $add($j->delivered_at, 'repair', $j->number, $j->paid_method ?? 'cash', (float) $j->paid, 0, $j->device);
        }
        foreach (DB::table('supplier_payments')->whereBetween('date', [$from->toDateString(), $to->toDateString()])->get() as $p) {
            $add($p->date.' 12:00:00', 'supplier', (string) DB::table('suppliers')->where('id', $p->supplier_id)->value('name'), $p->method, 0, (float) $p->amount, $p->reference ?: null);
        }
        foreach (DB::table('expenses')->whereNull('voided_at')->whereBetween('date', [$from->toDateString(), $to->toDateString()])->get() as $e) {
            $add($e->date.' 12:00:00', 'expense', $e->number, $e->method, 0, (float) $e->amount,
                trim(DB::table('expense_categories')->where('id', $e->expense_category_id)->value('name').' · '.$e->paid_to, ' ·'));
        }
        usort($rows, fn ($a, $b) => $a['at'] <=> $b['at']);

        return $rows;
    }

    public function cashbook(Request $request): JsonResponse
    {
        $d = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date', 'method' => 'nullable|in:cash,card,transfer,all']);
        $from = Carbon::parse($d['from'] ?? now()->toDateString())->startOfDay();
        $to = Carbon::parse($d['to'] ?? $from->toDateString())->endOfDay();
        $method = $d['method'] ?? 'cash';
        $pick = fn ($r) => $method === 'all' || $r['method'] === $method;
        $before = array_filter(self::movements(Carbon::create(2000), $from->copy()->subSecond()), $pick);
        $opening = self::m(array_sum(array_column($before, 'in')) - array_sum(array_column($before, 'out')));
        $bal = $opening;
        $entries = [];
        foreach (array_filter(self::movements($from, $to), $pick) as $r) {
            $bal = self::m($bal + $r['in'] - $r['out']);
            $entries[] = ['at' => $r['at']->toIso8601String(), 'type' => $r['type'], 'ref' => $r['ref'], 'method' => $r['method'],
                'in' => $r['in'], 'out' => $r['out'], 'balance' => $bal, 'note' => $r['note']];
        }

        return response()->json(['from' => $from->toDateString(), 'to' => $to->toDateString(), 'method' => $method, 'opening' => $opening,
            'totalIn' => self::m(array_sum(array_column($entries, 'in'))), 'totalOut' => self::m(array_sum(array_column($entries, 'out'))),
            'closing' => $bal, 'entries' => $entries]);
    }
}
