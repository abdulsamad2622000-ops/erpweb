<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use App\Support\ApiQuery;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = AuditLog::query()->with(['actor:id,name', 'target:id,name'])->orderByDesc('id');

        // Admin sirf apne actions ya Staff par hue actions dekhta hai
        if ($actor->type !== 'super_admin') {
            $query->where(fn ($w) => $w
                ->where('actor_id', $actor->id)
                ->orWhereIn('target_user_id', User::where('type', 'staff')->select('id')));
        }

        if ($v = $request->query('action')) {
            $query->where('action', $v);
        }
        if ($v = $request->query('target_user_id')) {
            $query->where('target_user_id', $v);
        }
        if ($v = $request->query('actor_id')) {
            $query->where('actor_id', $v);
        }

        $page = $query->paginate(min(max((int) $request->query('per_page', 25), 1), 100));

        return response()->json([
            'data' => $page->getCollection()->map(fn ($l) => [
                'id' => $l->id,
                'action' => $l->action,
                'details' => $l->details,
                'actor' => $l->actor ? ['id' => $l->actor->id, 'name' => $l->actor->name] : null,
                'target' => $l->target ? ['id' => $l->target->id, 'name' => $l->target->name] : null,
                'createdAt' => $l->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'page' => $page->currentPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'lastPage' => $page->lastPage(),
            ],
        ]);
    }

    /** GET /audit (frontend contract): ?search=&sort=at:desc&page=&pageSize= -> { data: AuditEntry[], total } */
    public function simple(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = AuditLog::query()->with(['actor:id,name', 'target:id,name']);
        if ($actor->type !== 'super_admin') {
            $query->where(fn ($w) => $w
                ->where('actor_id', $actor->id)
                ->orWhereIn('target_user_id', User::where('type', 'staff')->select('id')));
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where(fn ($w) => $w->where('action', 'like', "%{$v}%")
                ->orWhereHas('actor', fn ($a) => $a->where('name', 'like', "%{$v}%"))
                ->orWhereHas('target', fn ($t) => $t->where('name', 'like', "%{$v}%")));
        }
        ApiQuery::sort($query, $request, ['at' => 'id', 'action' => 'action'], 'id');
        if (! $request->query('sort')) {
            $query->reorder()->orderByDesc('id');
        }
        $page = $query->paginate(ApiQuery::perPage($request, 10));

        return response()->json(ApiQuery::page($page, fn ($l) => [
            'id' => $l->id,
            'at' => $l->created_at?->toIso8601String(),
            'actor' => $l->actor?->name ?? 'System',
            'action' => $l->action,
            'target' => $l->target?->name ?? (string) ($l->details['role'] ?? $l->details['email'] ?? ''),
            'detail' => $this->detail($l->details ?? []),
        ]));
    }

    private function detail(array $d): string
    {
        $parts = [];
        foreach ($d as $k => $v) {
            $parts[] = $k.': '.(is_scalar($v) || $v === null ? var_export($v, true) : json_encode($v));
        }

        return implode(', ', $parts);
    }
}
