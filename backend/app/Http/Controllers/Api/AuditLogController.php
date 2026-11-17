<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
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
}