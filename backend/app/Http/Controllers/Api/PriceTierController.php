<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PriceTier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PriceTierController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => PriceTier::orderBy('sort_order')->orderBy('id')->get()->map(fn ($t) => $this->present($t))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:100',
            'sort_order' => 'sometimes|integer|min:0|max:1000',
            'is_default' => 'sometimes|boolean',
        ]);

        $base = Str::slug($data['name'], '_') ?: 'tier';
        $key = $base;
        $i = 2;
        while (PriceTier::where('key', $key)->exists()) {
            $key = $base.'_'.$i++;
        }

        $tier = PriceTier::create([
            'key' => $key,
            'name' => $data['name'],
            'sort_order' => $data['sort_order'] ?? (PriceTier::max('sort_order') + 1),
            'is_default' => false,
            'is_system' => false,
        ]);

        if (! empty($data['is_default'])) {
            $this->makeDefault($tier);
        }

        AuditLog::record($request->user(), 'price_tier.created', null, ['key' => $tier->key]);

        return response()->json(['data' => $this->present($tier->fresh())], 201);
    }

    public function update(Request $request, PriceTier $priceTier): JsonResponse
    {
        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'sort_order' => 'sometimes|integer|min:0|max:1000',
            'is_default' => 'sometimes|boolean',
        ]);

        if (array_key_exists('is_default', $data) && ! $data['is_default'] && $priceTier->is_default) {
            throw ValidationException::withMessages(['is_default' => 'There must always be one default tier.']);
        }

        $priceTier->update(array_intersect_key($data, array_flip(['name', 'sort_order'])));

        if (! empty($data['is_default'])) {
            $this->makeDefault($priceTier);
        }

        AuditLog::record($request->user(), 'price_tier.updated', null, ['key' => $priceTier->key, 'fields' => array_keys($data)]);

        return response()->json(['data' => $this->present($priceTier->fresh())]);
    }

    public function destroy(Request $request, PriceTier $priceTier): Response
    {
        if ($priceTier->is_system || $priceTier->is_default) {
            throw ValidationException::withMessages(['tier' => 'System and default tiers cannot be deleted.']);
        }

        $key = $priceTier->key;
        $priceTier->delete();
        AuditLog::record($request->user(), 'price_tier.deleted', null, ['key' => $key]);

        return response()->noContent();
    }

    private function makeDefault(PriceTier $tier): void
    {
        PriceTier::where('id', '!=', $tier->id)->update(['is_default' => false]);
        $tier->update(['is_default' => true]);
    }

    private function present(PriceTier $t): array
    {
        return [
            'id' => $t->id,
            'key' => $t->key,
            'name' => $t->name,
            'isDefault' => (bool) $t->is_default,
            'isSystem' => (bool) $t->is_system,
            'sortOrder' => (int) $t->sort_order,
        ];
    }
}