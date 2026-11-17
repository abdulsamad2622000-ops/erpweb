<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\NumberSeries;
use App\Services\NumberSeriesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class NumberSeriesController extends Controller
{
    public function __construct(private NumberSeriesService $service)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => NumberSeries::orderBy('id')->get()->map(fn ($s) => $this->present($s))->values(),
        ]);
    }

    public function update(Request $request, string $key): JsonResponse
    {
        $series = NumberSeries::where('key', $key)->firstOrFail();

        $data = $request->validate([
            'name' => 'sometimes|string|max:100',
            'prefix' => 'sometimes|nullable|string|max:10',
            'padding' => 'sometimes|integer|min:3|max:10',
            'next_number' => 'sometimes|integer|min:1',
            'include_year' => 'sometimes|boolean',
        ]);

        // Counter peeche karne se duplicate numbers ban sakte hain
        if (isset($data['next_number']) && $data['next_number'] < $series->next_number) {
            throw ValidationException::withMessages([
                'next_number' => 'The next number cannot be lower than the current one.',
            ]);
        }

        if (array_key_exists('prefix', $data)) {
            $data['prefix'] = $data['prefix'] ?? '';
        }

        $series->update($data);
        AuditLog::record($request->user(), 'number_series.updated', null, ['key' => $key, 'fields' => array_keys($data)]);

        return response()->json(['data' => $this->present($series->fresh())]);
    }

    private function present(NumberSeries $s): array
    {
        return [
            'key' => $s->key,
            'name' => $s->name,
            'prefix' => $s->prefix,
            'padding' => (int) $s->padding,
            'nextNumber' => (int) $s->next_number,
            'includeYear' => (bool) $s->include_year,
            'preview' => $this->service->preview($s),
        ];
    }
}