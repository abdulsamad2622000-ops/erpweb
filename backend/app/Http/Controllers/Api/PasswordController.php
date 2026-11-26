<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Login se pehle ke recovery endpoints. Jawab hamesha generic hota hai,
 * taake koi yeh na jaan sake ke kaunsa email ya phone system mein hai.
 */
class PasswordController extends Controller
{
    private const GENERIC = 'If this account exists, we have sent the next steps.';

    public function forgot(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email']);
        $user = User::where('email', Str::lower($data['email']))->where('is_active', true)->first();
        if ($user) {
            // Frontend 6-digit code wala tareeqa use karta hai (link nahi). Code 15 minute, 5 koshishen.
            $key = 'pwreset:'.sha1($user->email);
            $prev = Cache::get($key);
            if ($prev && now()->timestamp - $prev['sent'] < 30) {
                return response()->json(['message' => self::GENERIC]); // jaldi jaldi dobara na bhejo
            }
            $code = (string) random_int(100000, 999999);
            Cache::put($key, ['hash' => Hash::make($code), 'tries' => 0, 'sent' => now()->timestamp], now()->addMinutes(15));
            try {
                $company = (string) (app(\App\Services\SettingsService::class)->get('company')['name'] ?? 'Novastackhub');
                Mail::raw("Your password reset code is {$code}.\n\nIt expires in 15 minutes. If you did not ask for this, you can ignore this email.\n\n{$company}",
                    fn ($m) => $m->to($user->email)->subject("Password reset code: {$code}"));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json(['message' => self::GENERIC]);
    }

    /** Email wala 6-digit code check: sahi ho to reset token (reset-password ke liye). */
    public function verifyCode(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => 'required|email', 'code' => 'required|digits:6'], ['code.digits' => 'Enter the 6-digit code.']);
        $email = Str::lower($data['email']);
        $key = 'pwreset:'.sha1($email);
        $entry = Cache::get($key);
        $user = User::where('email', $email)->where('is_active', true)->first();
        if (! $entry || ! $user || $entry['tries'] >= 5) {
            Cache::forget($key);
            throw ValidationException::withMessages(['code' => 'This code has expired. Ask for a new one.']);
        }
        if (! Hash::check($data['code'], $entry['hash'])) {
            $entry['tries']++;
            Cache::put($key, $entry, now()->addMinutes(15));
            throw ValidationException::withMessages(['code' => 'That code is not correct.']);
        }
        Cache::forget($key);

        return response()->json(['token' => Password::createToken($user)]);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            ['email' => Str::lower($data['email'])] + $data,
            function (User $user, string $password) {
                DB::transaction(function () use ($user, $password) {
                    $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                    $user->tokens()->delete();
                    if (config('session.driver') === 'database') {
                        DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
                    }
                    AuditLog::record($user, 'user.password_changed', $user);
                });
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'This reset link is invalid or has expired.']);
        }

        return response()->json(['message' => 'Your password has been reset. You can sign in now.']);
    }

    /**
     * Phone number se email yaad dilana. SMS provider abhi tay nahi hua, is liye
     * sirf generic jawab aur audit; provider aane par yahan SMS bhejna hai.
     */
    public function recoverEmail(Request $request): JsonResponse
    {
        $request->validate(['phone' => 'required|string|max:30']);
        AuditLog::record(null, 'auth.recover_email_requested', null, ['phone' => substr(preg_replace('/\D/', '', $request->input('phone')), -4)]);

        return response()->json(['message' => self::GENERIC]);
    }
}
