<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 * Speed check: super admin ke taur par aham GET screens chala kar har ek ka waqt (ms) aur query count dikhata hai.
 * Sirf parhta hai, kuch nahi badalta. Temporary token bana kar aakhir mein mita deta hai.
 */
Artisan::command('perf:probe', function () {
    $user = \App\Models\User::where('type', 'super_admin')->where('is_active', true)->orderBy('id')->first();
    if (! $user) {
        $this->error('No active super admin.');

        return 1;
    }
    $token = $user->createToken('perf-probe');
    $paths = ['/api/v1/me', '/api/v1/dashboard', '/api/v1/products?page=1&pageSize=20', '/api/v1/inventory/stock?page=1&pageSize=20',
        '/api/v1/inventory/serials?page=1&pageSize=20', '/api/v1/customers?all=true', '/api/v1/sales/invoices?page=1&pageSize=20',
        '/api/v1/sales/orders?page=1&pageSize=20', '/api/v1/purchase/orders?page=1&pageSize=20', '/api/v1/warranty/jobs?status=open',
        '/api/v1/customers/aging', '/api/v1/reports/sales', '/api/v1/reports/stock', '/api/v1/reports/profit', '/api/v1/accounts/cashbook'];
    $rows = [];
    try {
        foreach ($paths as $p) {
            \Illuminate\Support\Facades\DB::flushQueryLog();
            \Illuminate\Support\Facades\DB::enableQueryLog();
            $req = \Illuminate\Http\Request::create($p, 'GET', server: ['HTTP_ACCEPT' => 'application/json', 'HTTP_X_CLIENT' => 'erp-web',
                'HTTP_AUTHORIZATION' => 'Bearer '.$token->plainTextToken]);
            $t = microtime(true);
            $res = app()->handle($req);
            $ms = (int) round((microtime(true) - $t) * 1000);
            $rows[] = [$p, $res->getStatusCode(), $ms, count(\Illuminate\Support\Facades\DB::getQueryLog()), round(strlen((string) $res->getContent()) / 1024, 1)];
            \Illuminate\Support\Facades\DB::disableQueryLog();
            auth()->forgetGuards();
        }
    } finally {
        $token->accessToken->delete();
    }
    $this->table(['Endpoint', 'HTTP', 'ms', 'Queries', 'KB'], $rows);
    $slow = array_filter($rows, fn ($r) => $r[2] > 500);
    $this->line($slow ? count($slow).' slow endpoint(s) (> 500 ms).' : 'All endpoints under 500 ms.');

    return 0;
})->purpose('Time the main API screens (read-only)');
