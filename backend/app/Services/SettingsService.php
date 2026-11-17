<?php

namespace App\Services;

use App\Models\AppSetting;

class SettingsService
{
    public const DEFAULTS = [
        'company' => [
            'name' => '', 'address' => null, 'phone' => null, 'email' => null,
            'taxNumber' => null, 'currency' => 'PKR', 'logoUrl' => null,
        ],
        'inventory' => [
            'costingMethod' => 'weighted_average',
            'negativeStock' => 'block',
        ],
        'backup' => [
            'frequency' => 'daily', 'retentionDays' => 30, 'notes' => null,
        ],
    ];

    public const RULES = [
        'company' => [
            'name' => 'sometimes|required|string|max:255',
            'address' => 'sometimes|nullable|string|max:500',
            'phone' => 'sometimes|nullable|string|max:50',
            'email' => 'sometimes|nullable|email|max:255',
            'taxNumber' => 'sometimes|nullable|string|max:100',
            'currency' => 'sometimes|string|size:3|alpha',
            'logoUrl' => 'sometimes|nullable|url|max:500',
        ],
        'inventory' => [
            'costingMethod' => 'sometimes|in:fifo,weighted_average,specific_serial',
            'negativeStock' => 'sometimes|in:block,allow,allow_with_approval',
        ],
        'backup' => [
            'frequency' => 'sometimes|in:daily,weekly,manual',
            'retentionDays' => 'sometimes|integer|min:1|max:3650',
            'notes' => 'sometimes|nullable|string|max:1000',
        ],
    ];

    public static function groups(): array
    {
        return array_keys(self::DEFAULTS);
    }

    public function get(string $group): array
    {
        $row = AppSetting::where('key', $group)->first();

        return array_merge(self::DEFAULTS[$group], $row?->value ?? []);
    }

    public function put(string $group, array $values): array
    {
        $merged = array_merge($this->get($group), $values);
        AppSetting::updateOrCreate(['key' => $group], ['value' => $merged]);

        return $merged;
    }
}