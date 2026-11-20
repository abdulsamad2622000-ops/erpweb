<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            Password::sendResetLink(['email' => $user->email]);
        }

        return response()->json(['message' => self::GENERIC]);
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
