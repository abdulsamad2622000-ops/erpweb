<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Throwable;

/** 6-digit password code: forgot password, naya user (invite), admin ka "reset". Email par jata hai. */
class PasswordCode
{
    public static function key(string $email): string
    {
        return 'pwreset:'.sha1(mb_strtolower($email));
    }

    /** Code banao, cache mein rakho, email bhejo. kind: forgot | invite | admin. Wapas: email gayi ya nahi. */
    public static function send(User $user, string $kind = 'forgot'): bool
    {
        $minutes = $kind === 'forgot' ? 15 : 48 * 60;
        $code = (string) random_int(100000, 999999);
        $until = now()->addMinutes($minutes);
        Cache::put(self::key($user->email), ['hash' => Hash::make($code), 'tries' => 0, 'sent' => now()->timestamp, 'until' => $until->timestamp], $until);
        $company = (string) (app(SettingsService::class)->get('company')['name'] ?? 'Novastackhub');
        $link = rtrim((string) config('app.frontend_url'), '/').'/forgot-password?email='.rawurlencode($user->email).'&code='.$code;
        $valid = $kind === 'forgot' ? '15 minutes' : '48 hours';
        [$subject, $intro] = match ($kind) {
            'invite' => ["Your Laptop ERP account – set your password", "Assalam o Alaikum {$user->name},\n\nAn account has been made for you on Laptop ERP ({$company}).\nYour sign-in email: {$user->email}"],
            'admin' => ["Set a new Laptop ERP password", "Assalam o Alaikum {$user->name},\n\nYour administrator asked for your Laptop ERP password to be reset."],
            default => ["Password reset code: {$code}", "Your password reset code is {$code}."],
        };
        $body = $intro."\n\nYour code: {$code}\n\nOpen this link to set your password:\n{$link}\n\n"
            ."Or go to the sign-in page, click \"Forgot password\", enter your email and this code.\n"
            ."The code works for {$valid}. If you did not expect this email, you can ignore it.\n\n{$company}";
        try {
            Mail::raw($body, fn ($m) => $m->to($user->email)->subject($subject));

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    /** Sahi code par true (aur code khatam). */
    public static function check(string $email, string $code): ?bool
    {
        $key = self::key($email);
        $entry = Cache::get($key);
        if (! $entry || $entry['tries'] >= 5) {
            Cache::forget($key);

            return null; // expired
        }
        if (! Hash::check($code, $entry['hash'])) {
            $entry['tries']++;
            Cache::put($key, $entry, \Illuminate\Support\Carbon::createFromTimestamp($entry['until'] ?? now()->addMinutes(15)->timestamp));

            return false;
        }
        Cache::forget($key);

        return true;
    }

    public static function recentlySent(string $email, int $seconds = 30): bool
    {
        $e = Cache::get(self::key($email));

        return $e && now()->timestamp - $e['sent'] < $seconds;
    }
}
