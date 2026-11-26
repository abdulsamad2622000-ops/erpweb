<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Har auth step ki apni hadd (IP + raasta), taake forgot -> code -> reset ek doosre ki ginti na khayen.
        RateLimiter::for('auth-step', fn (Request $r) => Limit::perMinute(6)->by($r->ip().'|'.$r->path()));
        // Reset link frontend ke page par khulta hai: /reset-password?token=...&email=...
        ResetPassword::createUrlUsing(fn ($user, string $token) => rtrim((string) config('app.frontend_url'), '/')
            .'/reset-password?token='.urlencode($token).'&email='.urlencode($user->getEmailForPasswordReset()));
    }
}
