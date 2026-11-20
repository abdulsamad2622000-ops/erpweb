<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\NumberSeries;
use App\Models\PriceTier;
use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Settings screens ka frontend contract (/settings/company, costing, number-series, price-tiers, backup).
 * Data wahi app_settings / number_series / price_tiers tables mein rehta hai.
 */
class SettingsScreenController extends Controller
{
    private const SERIES = ['po' => 'PO', 'grn' => 'GRN', 'invoice' => 'INVOICE'];

    /** Frontend <-> backend naam (costing) */
    private const METHOD_IN = ['fifo' => 'fifo', 'weighted_average' => 'weighted_average', 'serial_specific' => 'specific_serial'];

    private const NEGATIVE_IN = ['block' => 'block', 'warn' => 'allow_with_approval', 'allow' => 'allow'];

    public function __construct(private SettingsService $settings)
    {
    }

    public function company(): JsonResponse
    {
        return response()->json(['data' => $this->companyOut($this->settings->get('company'))]);
    }

    public function updateCompany(Request $request): JsonResponse
    {
        $d = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'logo' => ['nullable', 'string', 'max:700000', 'regex:#^(https?://|data:image/(png|jpeg|webp|svg\+xml);base64,)#'],
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'taxNumber' => 'nullable|string|max:100',
            'taxRate' => 'sometimes|numeric|min:0|max:100',
            'currency' => 'sometimes|string|size:3|alpha',
            'logoUrl' => 'sometimes|nullable|url|max:500',
        ]);
        // Sirf bheje gaye fields badalte hain (partial update bhi chalta hai)
        $map = ['logo' => 'logoUrl', 'logoUrl' => 'logoUrl'];
        $values = [];
        foreach ($d as $k => $v) {
            $values[$map[$k] ?? $k] = is_string($v) ? trim($v) : $v;
        }
        if (isset($values['currency'])) {
            $values['currency'] = strtoupper($values['currency']);
        }
        if (isset($values['taxRate'])) {
            $values['taxRate'] = (float) $values['taxRate'];
        }
        $saved = $this->settings->put('company', $values);
        AuditLog::record($request->user(), 'settings.updated', null, ['group' => 'company']);

        return response()->json(['data' => $this->companyOut($saved)]);
    }

    public function costing(): JsonResponse
    {
        return response()->json($this->costingOut($this->settings->get('inventory')));
    }

    public function updateCosting(Request $request): JsonResponse
    {
        $d = $request->validate([
            'method' => 'required|in:'.implode(',', array_keys(self::METHOD_IN)),
            'negativeStock' => 'required|in:'.implode(',', array_keys(self::NEGATIVE_IN)),
        ]);
        $saved = $this->settings->put('inventory', [
            'costingMethod' => self::METHOD_IN[$d['method']],
            'negativeStock' => self::NEGATIVE_IN[$d['negativeStock']],
        ]);
        AuditLog::record($request->user(), 'settings.updated', null, ['group' => 'costing']);

        return response()->json($this->costingOut($saved));
    }

    public function numberSeries(): JsonResponse
    {
        return response()->json(
            NumberSeries::whereIn('key', array_keys(self::SERIES))->orderBy('id')->get()->map(fn ($s) => $this->seriesOut($s))->values()
        );
    }

    public function updateNumberSeries(Request $request, int $id): JsonResponse
    {
        $series = NumberSeries::whereIn('key', array_keys(self::SERIES))->findOrFail($id);
        $d = $request->validate([
            'prefix' => ['present', 'nullable', 'string', 'regex:#^[A-Za-z0-9\-_/]{0,12}$#'],
            'nextNumber' => 'required|integer|min:1',
            'padding' => 'required|integer|min:1|max:10',
            'resetYearly' => 'required|boolean',
        ]);
        if ($d['nextNumber'] < $series->next_number) {
            throw ValidationException::withMessages(['nextNumber' => 'The next number cannot be lower than the current one.']);
        }
        $series->update([
            'prefix' => $d['prefix'] ?? '', 'next_number' => $d['nextNumber'],
            'padding' => $d['padding'], 'include_year' => $d['resetYearly'],
        ]);
        AuditLog::record($request->user(), 'number_series.updated', null, ['key' => $series->key]);

        return response()->json($this->seriesOut($series->fresh()));
    }

    public function priceTiers(): JsonResponse
    {
        return response()->json(PriceTier::orderBy('sort_order')->orderBy('id')->get()->map(fn ($t) => $this->tierOut($t))->values());
    }

    public function updatePriceTier(Request $request, PriceTier $priceTier): JsonResponse
    {
        $d = $request->validate(['name' => 'required|string|max:50', 'isActive' => 'required|boolean']);
        if (! $d['isActive'] && $priceTier->is_default) {
            throw ValidationException::withMessages(['isActive' => 'The default price tier cannot be turned off.']);
        }
        $priceTier->update(['name' => trim($d['name']), 'is_active' => $d['isActive']]);
        AuditLog::record($request->user(), 'price_tier.updated', null, ['key' => $priceTier->key]);

        return response()->json($this->tierOut($priceTier->fresh()));
    }

    public function backup(): JsonResponse
    {
        $b = $this->settings->get('backup');

        return response()->json([
            'status' => $b['lastStatus'] ?? 'never',
            'lastBackupAt' => $b['lastBackupAt'] ?? null,
            'frequency' => in_array($b['frequency'], ['daily', 'weekly'], true) ? $b['frequency'] : 'daily',
            'time' => $b['time'] ?? '02:00',
            'retentionDays' => (int) $b['retentionDays'],
            'location' => $b['location'] ?? 'Server: /root/backups',
        ]);
    }

    private function companyOut(array $c): array
    {
        return [
            'name' => (string) $c['name'], 'logo' => $c['logoUrl'] ?? null, 'address' => (string) ($c['address'] ?? ''),
            'city' => (string) ($c['city'] ?? ''), 'country' => (string) ($c['country'] ?? 'Pakistan'),
            'phone' => (string) ($c['phone'] ?? ''), 'email' => (string) ($c['email'] ?? ''),
            'taxNumber' => (string) ($c['taxNumber'] ?? ''), 'taxRate' => (float) ($c['taxRate'] ?? 0),
            'currency' => (string) ($c['currency'] ?? 'PKR'),
            'logoUrl' => $c['logoUrl'] ?? null,
        ];
    }

    private function costingOut(array $i): array
    {
        return [
            'method' => array_search($i['costingMethod'], self::METHOD_IN, true) ?: 'weighted_average',
            'negativeStock' => array_search($i['negativeStock'], self::NEGATIVE_IN, true) ?: 'block',
        ];
    }

    private function seriesOut(NumberSeries $s): array
    {
        return [
            'id' => $s->id, 'code' => self::SERIES[$s->key], 'prefix' => (string) $s->prefix,
            'nextNumber' => (int) $s->next_number, 'padding' => (int) $s->padding, 'resetYearly' => (bool) $s->include_year,
        ];
    }

    private function tierOut(PriceTier $t): array
    {
        return ['id' => $t->id, 'code' => $t->key, 'name' => $t->name, 'isActive' => (bool) ($t->is_active ?? true)];
    }
}
