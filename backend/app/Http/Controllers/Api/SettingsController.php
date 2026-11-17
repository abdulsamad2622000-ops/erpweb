<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private SettingsService $settings)
    {
    }

    public function show(string $group): JsonResponse
    {
        abort_unless(in_array($group, SettingsService::groups(), true), 404);

        return response()->json(['data' => $this->settings->get($group)]);
    }

    public function update(Request $request, string $group): JsonResponse
    {
        abort_unless(in_array($group, SettingsService::groups(), true), 404);

        $data = $request->validate(SettingsService::RULES[$group]);

        if (isset($data['currency'])) {
            $data['currency'] = strtoupper($data['currency']);
        }

        $saved = $this->settings->put($group, $data);
        AuditLog::record($request->user(), 'settings.updated', null, ['group' => $group, 'fields' => array_keys($data)]);

        return response()->json(['data' => $saved]);
    }
}