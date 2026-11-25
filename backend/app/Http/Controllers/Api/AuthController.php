<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', Str::lower($data['email']))->first();

        if (! $user || ! $user->is_active || $user->accessExpired() || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        if ($user->two_factor_enabled) {
            $this->issueCode($user);
            $request->session()->put('2fa.user_id', $user->id);

            return response()->json([
                'twoFactorRequired' => true,
                'method' => 'email',
                'maskedEmail' => $this->mask($user->email),
                'resendAfterSeconds' => config('otp.resend_seconds'),
            ]);
        }

        $this->signIn($request, $user);

        return response()->json(['twoFactorRequired' => false]);
    }

    public function twoFactor(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);

        $userId = $request->hasSession() ? $request->session()->get('2fa.user_id') : null;
        $user = $userId ? User::find($userId) : null;
        if (! $user) {
            return response()->json(['message' => 'Login expired.'], 401);
        }

        $attemptsKey = "otp-attempts:{$user->id}";
        if (RateLimiter::tooManyAttempts($attemptsKey, 5)) {
            Cache::forget("otp:{$user->id}");
            return response()->json(['message' => 'Too many attempts. Request a new code.'], 429);
        }

        $hash = Cache::get("otp:{$user->id}");
        if (! $hash || ! Hash::check($data['code'], $hash)) {
            RateLimiter::hit($attemptsKey, 600);
            throw ValidationException::withMessages(['code' => ['The code is invalid.']]);
        }

        Cache::forget("otp:{$user->id}");
        RateLimiter::clear($attemptsKey);
        $this->signIn($request, $user);

        return response()->json(['ok' => true]);
    }

    public function resend(Request $request): JsonResponse
    {
        $userId = $request->hasSession() ? $request->session()->get('2fa.user_id') : null;
        $user = $userId ? User::find($userId) : null;
        if (! $user) {
            return response()->json(['message' => 'Login expired.'], 401);
        }

        $seconds = (int) config('otp.resend_seconds');
        if (Cache::has("otp-sent:{$user->id}")) {
            return response()->json(['message' => 'Please wait before requesting a new code.'], 429);
        }

        $this->issueCode($user);

        return response()->json(['resendAfterSeconds' => $seconds]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    private function signIn(Request $request, User $user): void
    {
        Auth::guard('web')->login($user);
        $request->session()->forget('2fa.user_id');
        $request->session()->regenerate();
    }

    private function issueCode(User $user): void
    {
        $code = config('otp.fixed_code') ?: str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        Cache::put("otp:{$user->id}", Hash::make($code), now()->addMinutes((int) config('otp.ttl_minutes')));
        Cache::put("otp-sent:{$user->id}", 1, (int) config('otp.resend_seconds'));

        Mail::raw("Your verification code is {$code}. It expires in " . config('otp.ttl_minutes') . ' minutes.',
            fn ($m) => $m->to($user->email)->subject('Your ERP verification code'));
    }

    private function mask(string $email): string
    {
        [$name, $domain] = explode('@', $email);

        return substr($name, 0, 2) . '***@' . $domain;
    }
}