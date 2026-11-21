<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\EmailService;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Email templates, test, log; invoice / statement / repair-ready bhejna. */
class EmailController extends Controller
{
    public const VARS = [
        'invoice' => ['company', 'customer', 'number', 'date', 'total', 'balance', 'due_line', 'lines'],
        'statement' => ['company', 'customer', 'date', 'balance', 'lines'],
        'repair_ready' => ['company', 'customer', 'number', 'device', 'total'],
    ];

    public function __construct(private EmailService $mail)
    {
    }

    private static function fmt(float $n): string
    {
        return number_format($n, $n == floor($n) ? 0 : 2);
    }

    private function tplOut(object $t): array
    {
        return ['key' => $t->key, 'name' => $t->name, 'subject' => $t->subject, 'body' => $t->body, 'isActive' => (bool) $t->is_active,
            'variables' => self::VARS[$t->key] ?? [], 'updatedAt' => Carbon::parse($t->updated_at)->toIso8601String()];
    }

    public function templates(): JsonResponse
    {
        return response()->json(['templates' => DB::table('email_templates')->orderBy('id')->get()->map(fn ($t) => $this->tplOut($t)),
            'mailer' => (string) config('mail.default'), 'from' => (string) config('mail.from.address')]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $d = $request->validate(['subject' => 'required|string|max:200', 'body' => 'required|string|max:5000', 'isActive' => 'boolean']);
        abort_unless(DB::table('email_templates')->where('key', $key)->exists(), 404, 'Template not found.');
        DB::table('email_templates')->where('key', $key)->update(['subject' => trim($d['subject']), 'body' => trim($d['body']),
            'is_active' => $d['isActive'] ?? true, 'updated_at' => now()]);
        AuditLog::record($request->user(), 'email.template_updated', null, ['key' => $key]);

        return response()->json($this->tplOut(DB::table('email_templates')->where('key', $key)->first()));
    }

    private function result(array $r): JsonResponse
    {
        if ($r['status'] !== 'sent') {
            return response()->json(['message' => 'Email could not be sent. Check the mail settings on the server.', 'error' => $r['error']], 422);
        }

        return response()->json($r);
    }

    public function test(Request $request, string $key): JsonResponse
    {
        $d = $request->validate(['to' => 'required|email|max:160']);
        $sample = ['customer' => 'Test Customer', 'number' => 'TEST-00001', 'date' => now()->toDateString(), 'total' => '100,000',
            'balance' => '25,000', 'due_line' => ' (due '.now()->addDays(30)->toDateString().')', 'lines' => "Dell Latitude 5440 x 1 = 100,000", 'device' => 'Dell Latitude 5440'];

        return $this->result($this->mail->send($key, $d['to'], $sample, $request->user(), 'test'));
    }

    public function logs(Request $request): JsonResponse
    {
        $q = DB::table('email_logs')->orderByDesc('id');
        if ($v = ApiQuery::param($request, 'search')) {
            $q->where(fn ($w) => $w->where('to', 'like', "%{$v}%")->orWhere('subject', 'like', "%{$v}%")->orWhere('ref', 'like', "%{$v}%"));
        }

        return response()->json(ApiQuery::page($q->paginate(ApiQuery::perPage($request, 20)), fn ($l) => ['id' => $l->id, 'templateKey' => $l->template_key,
            'to' => $l->to, 'subject' => $l->subject, 'status' => $l->status, 'error' => $l->error, 'ref' => $l->ref,
            'by' => (string) DB::table('users')->where('id', $l->user_id)->value('name'), 'at' => Carbon::parse($l->at)->toIso8601String()]));
    }

    private function toFor(Request $request, ?int $customerId): string
    {
        $d = $request->validate(['to' => 'nullable|email|max:160']);
        $to = $d['to'] ?? ($customerId ? (string) DB::table('customers')->where('id', $customerId)->value('email') : '');
        if (! $to) {
            throw ValidationException::withMessages(['to' => 'This customer has no email. Enter one.']);
        }

        return $to;
    }

    public function sendInvoice(Request $request, int $id): JsonResponse
    {
        $s = DB::table('sales')->find($id);
        abort_unless($s, 404, 'Invoice not found.');
        $to = $this->toFor($request, $s->customer_id ? (int) $s->customer_id : null);
        $o = app(WholesaleController::class)->invoiceOut($id);
        $lines = collect($o['lines'])->map(fn ($l) => "{$l['name']}".($l['serial'] ? " (S/N {$l['serial']})" : '')." x {$l['qty']} = ".self::fmt($l['qty'] * $l['unitPrice']))->implode("\n");

        return $this->result($this->mail->send('invoice', $to, ['customer' => $o['customer']['name'] ?? 'Customer', 'number' => $o['number'],
            'date' => substr($o['createdAt'], 0, 10), 'total' => self::fmt($o['total']), 'balance' => self::fmt($o['balance']),
            'due_line' => $o['dueDate'] ? " (due {$o['dueDate']})" : '', 'lines' => $lines], $request->user(), $o['number']));
    }

    public function sendStatement(Request $request, int $id): JsonResponse
    {
        $c = DB::table('customers')->find($id);
        abort_unless($c, 404, 'Customer not found.');
        $to = $this->toFor($request, $id);
        $ledger = app(CustomerLedgerController::class)->ledger(Request::create('/', 'GET'), $id)->getData(true);
        $lines = collect($ledger['open'])->map(fn ($i) => "{$i['number']} ({$i['date']}): ".self::fmt($i['balance']).($i['dueDate'] ? " due {$i['dueDate']}" : ''))->implode("\n");

        return $this->result($this->mail->send('statement', $to, ['customer' => $c->name, 'date' => now()->toDateString(),
            'balance' => self::fmt((float) $ledger['closing']), 'lines' => $lines ?: 'No unpaid bills.'], $request->user(), 'customer:'.$id));
    }

    public function sendRepairReady(Request $request, int $id): JsonResponse
    {
        $j = DB::table('repair_jobs')->find($id);
        abort_unless($j, 404, 'Job card not found.');
        $to = $this->toFor($request, $j->customer_id ? (int) $j->customer_id : null);
        $total = (float) DB::table('repair_parts')->where('repair_job_id', $id)->selectRaw('COALESCE(SUM(qty * unit_price), 0) as t')->value('t') + (float) $j->labour;

        return $this->result($this->mail->send('repair_ready', $to, ['customer' => $j->customer_name, 'number' => $j->number, 'device' => $j->device,
            'total' => self::fmt($total)], $request->user(), $j->number));
    }
}
