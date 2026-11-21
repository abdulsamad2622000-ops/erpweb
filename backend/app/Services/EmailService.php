<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/** Template se email: {{var}} bharo, bhejo, log karo. Mail band ho to failed log + wajah. */
class EmailService
{
    public function __construct(private SettingsService $settings)
    {
    }

    public static function fill(string $text, array $vars): string
    {
        return preg_replace_callback('/\{\{\s*([a-z_]+)\s*\}\}/', fn ($m) => (string) ($vars[$m[1]] ?? ''), $text);
    }

    public function company(): string
    {
        return (string) ($this->settings->get('company')['name'] ?? 'Novastackhub');
    }

    /** @return array{status: string, error: ?string, subject: string} */
    public function send(string $key, string $to, array $vars, ?User $user, ?string $ref = null): array
    {
        $t = DB::table('email_templates')->where('key', $key)->first();
        abort_unless($t && $t->is_active, 422, 'This email template is turned off.');
        $vars += ['company' => $this->company()];
        $subject = self::fill($t->subject, $vars);
        $body = self::fill($t->body, $vars);
        $status = 'sent';
        $error = null;
        try {
            $html = '<div style="font:14px/1.5 system-ui,sans-serif">'.nl2br(e($body)).'</div>';
            Mail::html($html, fn ($m) => $m->to($to)->subject($subject));
        } catch (Throwable $ex) {
            $status = 'failed';
            $error = mb_substr($ex->getMessage(), 0, 480);
        }
        DB::table('email_logs')->insert(['template_key' => $key, 'to' => $to, 'subject' => $subject, 'status' => $status,
            'error' => $error, 'ref' => $ref, 'user_id' => $user?->id, 'at' => now()]);

        return ['status' => $status, 'error' => $error, 'subject' => $subject];
    }
}
