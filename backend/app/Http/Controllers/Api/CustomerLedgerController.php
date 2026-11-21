<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\NumberSeriesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Step 13: customer ledger/statement, receipts (FIFO ya chuni hui invoices par), aging. */
class CustomerLedgerController extends Controller
{
    public function __construct(private NumberSeriesService $numbers)
    {
    }

    private static function m(float $v): float
    {
        return round($v, 2);
    }

    /** Har bill ka baqi (credit returns minus). */
    private static function openInvoices(int $customerId)
    {
        return DB::table('sales')->where('customer_id', $customerId)->orderBy('created_at')->orderBy('id')->get()
            ->map(function ($s) {
                $credit = (float) DB::table('sales_returns')->where('sale_id', $s->id)->where('refund_method', 'credit')->sum('amount');
                $s->balance = self::m((float) $s->total - (float) $s->paid + (float) $s->change_due - $credit);

                return $s;
            })->filter(fn ($s) => $s->balance > 0.004)->values();
    }

    /** Ledger ki sab entries (date order). debit = customer par, credit = customer ki taraf se. */
    private static function entries(int $customerId): array
    {
        $rows = [];
        $sales = DB::table('sales')->where('customer_id', $customerId)->get();
        foreach ($sales as $s) {
            $at = Carbon::parse($s->created_at);
            $rows[] = ['at' => $at, 'type' => 'invoice', 'ref' => $s->number, 'refId' => $s->id, 'debit' => (float) $s->total, 'credit' => 0.0,
                'note' => $s->channel];
            if ((float) $s->change_due > 0) {
                $rows[] = ['at' => $at, 'type' => 'change', 'ref' => $s->number, 'refId' => $s->id, 'debit' => (float) $s->change_due, 'credit' => 0.0, 'note' => null];
            }
            foreach (DB::table('sale_payments')->where('sale_id', $s->id)->whereNull('customer_receipt_id')->get() as $p) {
                $rows[] = ['at' => $p->paid_at ? Carbon::parse($p->paid_at) : $at, 'type' => 'payment', 'ref' => $s->number, 'refId' => $s->id,
                    'debit' => 0.0, 'credit' => (float) $p->amount, 'note' => trim($p->method.' '.($p->reference ?? ''))];
            }
            foreach (DB::table('sales_returns')->where('sale_id', $s->id)->where('refund_method', 'credit')->get() as $r) {
                $rows[] = ['at' => Carbon::parse($r->created_at), 'type' => 'return', 'ref' => $r->number, 'refId' => $s->id,
                    'debit' => 0.0, 'credit' => (float) $r->amount, 'note' => $s->number];
            }
        }
        foreach (DB::table('customer_receipts')->where('customer_id', $customerId)->get() as $r) {
            $rows[] = ['at' => Carbon::parse($r->created_at), 'type' => 'receipt', 'ref' => $r->number, 'refId' => $r->id,
                'debit' => 0.0, 'credit' => (float) $r->amount, 'note' => trim($r->method.' '.($r->reference ?? ''))];
        }
        usort($rows, fn ($a, $b) => [$a['at'], $a['debit'] > 0 ? 0 : 1] <=> [$b['at'], $b['debit'] > 0 ? 0 : 1]);

        return $rows;
    }

    public function ledger(Request $request, int $id): JsonResponse
    {
        $c = DB::table('customers')->find($id);
        abort_unless($c, 404, 'Customer not found.');
        $d = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = isset($d['from']) ? Carbon::parse($d['from'])->startOfDay() : null;
        $to = isset($d['to']) ? Carbon::parse($d['to'])->endOfDay() : null;
        $opening = 0.0;
        $bal = 0.0;
        $out = [];
        foreach (self::entries($id) as $e) {
            $bal = self::m($bal + $e['debit'] - $e['credit']);
            if ($from && $e['at']->lt($from)) {
                $opening = $bal;

                continue;
            }
            if ($to && $e['at']->gt($to)) {
                continue;
            }
            $out[] = ['date' => $e['at']->toIso8601String(), 'type' => $e['type'], 'ref' => $e['ref'], 'refId' => $e['refId'],
                'debit' => self::m($e['debit']), 'credit' => self::m($e['credit']), 'balance' => $bal, 'note' => $e['note']];
        }

        return response()->json([
            'customer' => ['id' => $c->id, 'name' => $c->name, 'phone' => $c->phone, 'creditLimit' => (float) $c->credit_limit,
                'paymentTermsDays' => (int) $c->payment_terms_days],
            'from' => $from?->toDateString(), 'to' => $to?->toDateString(), 'opening' => $opening,
            'closing' => $out ? end($out)['balance'] : $opening, 'entries' => $out,
            'totalDebit' => self::m(array_sum(array_column($out, 'debit'))), 'totalCredit' => self::m(array_sum(array_column($out, 'credit'))),
            'open' => self::openInvoices($id)->map(fn ($s) => ['id' => $s->id, 'number' => $s->number, 'date' => Carbon::parse($s->created_at)->toDateString(),
                'dueDate' => $s->due_date, 'total' => (float) $s->total, 'balance' => $s->balance])->all(),
        ]);
    }

    public function storeReceipt(Request $request, int $id): JsonResponse
    {
        $c = DB::table('customers')->find($id);
        abort_unless($c, 404, 'Customer not found.');
        $d = $request->validate([
            'method' => 'required|in:cash,card,transfer', 'amount' => 'required|numeric|min:0.01',
            'reference' => 'nullable|string|max:60', 'note' => 'nullable|string|max:500',
            'allocations' => 'nullable|array', 'allocations.*.invoiceId' => 'required|integer', 'allocations.*.amount' => 'required|numeric|min:0.01',
        ], ['amount.required' => 'Enter the amount.']);
        $u = $request->user();
        $amount = self::m((float) $d['amount']);

        $rid = DB::transaction(function () use ($c, $d, $u, $amount) {
            DB::table('customers')->where('id', $c->id)->lockForUpdate()->first();
            $open = self::openInvoices((int) $c->id)->keyBy('id');
            $due = self::m($open->sum('balance'));
            if ($amount > $due + 0.001) {
                throw ValidationException::withMessages(['amount' => "Only {$due} is due from this customer."]);
            }
            $plan = [];
            if (! empty($d['allocations'])) {
                foreach ($d['allocations'] as $i => $a) {
                    $s = $open->get((int) $a['invoiceId']);
                    if (! $s) {
                        throw ValidationException::withMessages(["allocations.{$i}" => 'This invoice has nothing due.']);
                    }
                    $amt = self::m((float) $a['amount']);
                    if ($amt > $s->balance + 0.001) {
                        throw ValidationException::withMessages(["allocations.{$i}" => "Only {$s->balance} is due on {$s->number}."]);
                    }
                    $plan[$s->id] = ($plan[$s->id] ?? 0) + $amt;
                }
                if (abs(array_sum($plan) - $amount) > 0.001) {
                    throw ValidationException::withMessages(['allocations' => 'Allocated amounts must add up to the receipt amount.']);
                }
            } else {
                $left = $amount;
                foreach ($open as $s) { // purani invoice pehle (FIFO)
                    if ($left <= 0.004) {
                        break;
                    }
                    $take = self::m(min($left, $s->balance));
                    $plan[$s->id] = $take;
                    $left = self::m($left - $take);
                }
            }
            $now = now();
            $rid = DB::table('customer_receipts')->insertGetId(['number' => $this->numbers->next('customer_receipt'), 'customer_id' => $c->id,
                'method' => $d['method'], 'amount' => $amount, 'reference' => trim($d['reference'] ?? '') ?: null,
                'note' => trim($d['note'] ?? '') ?: null, 'created_by' => $u->id, 'created_at' => $now, 'updated_at' => $now]);
            foreach ($plan as $saleId => $amt) {
                DB::table('sale_payments')->insert(['sale_id' => $saleId, 'method' => $d['method'], 'amount' => $amt,
                    'reference' => trim($d['reference'] ?? '') ?: null, 'paid_at' => $now, 'customer_receipt_id' => $rid]);
                DB::table('sales')->where('id', $saleId)->increment('paid', $amt);
            }
            AuditLog::record($u, 'customer.receipt', null, ['customer' => $c->id, 'amount' => $amount]);

            return $rid;
        });

        return response()->json($this->receiptOut($rid), 201);
    }

    private function receiptOut(int $id): array
    {
        $r = DB::table('customer_receipts')->find($id);

        return ['id' => $r->id, 'number' => $r->number, 'customerId' => (int) $r->customer_id, 'method' => $r->method, 'amount' => (float) $r->amount,
            'reference' => $r->reference, 'note' => $r->note, 'createdAt' => Carbon::parse($r->created_at)->toIso8601String(),
            'createdBy' => (string) DB::table('users')->where('id', $r->created_by)->value('name'),
            'allocations' => DB::table('sale_payments')->join('sales', 'sales.id', '=', 'sale_payments.sale_id')->where('customer_receipt_id', $id)
                ->get(['sales.id', 'sales.number', 'sale_payments.amount'])->map(fn ($a) => ['invoiceId' => $a->id, 'number' => $a->number, 'amount' => (float) $a->amount])->all()];
    }

    public function receipt(int $id): JsonResponse
    {
        abort_unless(DB::table('customer_receipts')->where('id', $id)->exists(), 404, 'Receipt not found.');

        return response()->json($this->receiptOut($id));
    }

    /** Aging: due date ke hisaab se baqi (not due, 1-30, 31-60, 61-90, 90+). */
    public function aging(Request $request): JsonResponse
    {
        $today = now()->startOfDay();
        $rows = [];
        $ids = DB::table('sales')->whereNotNull('customer_id')->distinct()->pluck('customer_id');
        foreach ($ids as $cid) {
            $b = ['current' => 0.0, 'd30' => 0.0, 'd60' => 0.0, 'd90' => 0.0, 'over90' => 0.0];
            foreach (self::openInvoices((int) $cid) as $s) {
                $due = Carbon::parse($s->due_date ?? $s->created_at)->startOfDay();
                $late = $due->lt($today) ? (int) $due->diffInDays($today) : 0;
                $k = $late === 0 ? 'current' : ($late <= 30 ? 'd30' : ($late <= 60 ? 'd60' : ($late <= 90 ? 'd90' : 'over90')));
                $b[$k] = self::m($b[$k] + $s->balance);
            }
            $total = self::m(array_sum($b));
            if ($total <= 0.004) {
                continue;
            }
            $c = DB::table('customers')->find($cid);
            $rows[] = ['customerId' => (int) $cid, 'name' => $c->name, 'phone' => $c->phone, 'creditLimit' => (float) $c->credit_limit] + $b + ['total' => $total];
        }
        usort($rows, fn ($a, $b) => $b['total'] <=> $a['total']);
        $sum = fn ($k) => self::m(array_sum(array_column($rows, $k)));

        return response()->json(['rows' => $rows, 'totals' => ['current' => $sum('current'), 'd30' => $sum('d30'), 'd60' => $sum('d60'),
            'd90' => $sum('d90'), 'over90' => $sum('over90'), 'total' => $sum('total')]]);
    }
}
