<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Services\GrantPolicy;
use App\Services\UserAccessRules;
use App\Services\UserPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(private GrantPolicy $policy, private UserAccessRules $rules)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = User::query()->with('branches')->orderBy('name');

        if ($actor->type !== 'super_admin') {
            $query->where('type', 'staff');
        }
        if ($v = $request->query('type')) {
            $query->where('type', $v);
        }
        if ($v = $request->query('role')) {
            $query->where('role', $v);
        }
        if ($v = $request->query('branch_id')) {
            $query->whereHas('branches', fn ($b) => $b->where('branches.id', $v));
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        if ($v = $request->query('search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('email', 'like', "%{$v}%"));
        }

        $page = $query->paginate(min(max((int) $request->query('per_page', 15), 1), 100));

        return response()->json([
            'data' => $page->getCollection()->map(fn ($u) => UserPresenter::make($u))->values(),
            'meta' => [
                'page' => $page->currentPage(),
                'perPage' => $page->perPage(),
                'total' => $page->total(),
                'lastPage' => $page->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeManage($request, $user);

        return response()->json(['data' => UserPresenter::make($user)]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:8',
            'type' => 'required|in:admin,staff',
            'role' => 'nullable|string|exists:roles,key',
            'branch_ids' => 'sometimes|array',
            'branch_ids.*' => 'integer|exists:branches,id',
            'is_active' => 'sometimes|boolean',
            'two_factor_enabled' => 'sometimes|boolean',
            'limits' => 'sometimes|nullable|array',
            'limits.discountPercent' => 'nullable|numeric|min:0|max:100',
            'limits.adjustmentUnits' => 'nullable|integer|min:0',
            'limits.maxSaleWithoutApproval' => 'nullable|numeric|min:0',
        ]);

        if ($data['type'] === 'admin' && $actor->type !== 'super_admin') {
            abort(403, 'Only a Super Admin can create Admins.');
        }

        $role = $this->rules->roleFor($actor, $data['type'], $data['role'] ?? null);
        $branchIds = array_map('intval', $data['branch_ids'] ?? []);
        $this->rules->assertBranches($actor, $branchIds);

        $columns = array_key_exists('limits', $data)
            ? $this->rules->columns($data['limits'])
            : $this->rules->inherit($actor);
        $this->rules->assertLimits($actor, $columns);

        $user = DB::transaction(function () use ($actor, $data, $role, $branchIds, $columns) {
            $u = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => $data['password'],
                'type' => $data['type'],
                'role' => $role,
                'is_active' => $data['is_active'] ?? true,
                'two_factor_enabled' => $data['two_factor_enabled'] ?? ($data['type'] === 'admin'),
            ] + $columns);

            $u->branches()->sync($branchIds);

            AuditLog::record($actor, 'user.created', $u, [
                'type' => $u->type, 'role' => $u->role, 'branchIds' => $branchIds,
            ]);

            return $u;
        });

        return response()->json(['data' => UserPresenter::make($user->fresh('branches'))], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $this->authorizeManage($request, $user);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role' => 'sometimes|nullable|string|exists:roles,key',
            'branch_ids' => 'sometimes|array',
            'branch_ids.*' => 'integer|exists:branches,id',
            'two_factor_enabled' => 'sometimes|boolean',
            'limits' => 'sometimes|nullable|array',
            'limits.discountPercent' => 'nullable|numeric|min:0|max:100',
            'limits.adjustmentUnits' => 'nullable|integer|min:0',
            'limits.maxSaleWithoutApproval' => 'nullable|numeric|min:0',
        ]);

        $attrs = array_intersect_key($data, array_flip(['name', 'email', 'two_factor_enabled']));

        if (array_key_exists('role', $data) && $user->type === 'staff') {
            $attrs['role'] = $this->rules->roleFor($actor, 'staff', $data['role']);
        }

        if (array_key_exists('limits', $data)) {
            $columns = $this->rules->columns($data['limits']);
            $this->rules->assertLimits($actor, $columns);
            $attrs += $columns;
        }

        $branchIds = null;
        if (array_key_exists('branch_ids', $data)) {
            $branchIds = array_map('intval', $data['branch_ids']);
            $this->rules->assertBranches($actor, $branchIds);
        }

        DB::transaction(function () use ($actor, $user, $attrs, $branchIds, $data) {
            $user->update($attrs);
            if ($branchIds !== null) {
                $user->branches()->sync($branchIds);
            }
            AuditLog::record($actor, 'user.updated', $user, ['fields' => array_keys($data)]);
        });

        return response()->json(['data' => UserPresenter::make($user->fresh('branches'))]);
    }

    public function status(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $this->authorizeManage($request, $user);

        $data = $request->validate(['is_active' => 'required|boolean']);

        // Aakhri active Super Admin ko disable karne par model LastSuperAdminException (422) deta hai
        DB::transaction(function () use ($actor, $user, $data) {
            $user->update(['is_active' => $data['is_active']]);
            if (! $data['is_active']) {
                $this->revokeSessions($user);
            }
            AuditLog::record($actor, 'user.status_changed', $user, ['isActive' => (bool) $data['is_active']]);
        });

        return response()->json(['data' => UserPresenter::make($user->fresh('branches'))]);
    }

    public function forceLogout(Request $request, User $user): JsonResponse
    {
        $this->authorizeManage($request, $user);

        $this->revokeSessions($user);
        AuditLog::record($request->user(), 'user.force_logout', $user);

        return response()->json(['message' => 'User has been signed out everywhere.']);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $this->authorizeManage($request, $user);

        $data = $request->validate(['password' => 'required|string|min:8|confirmed']);

        $user->update(['password' => $data['password']]);
        $this->revokeSessions($user);
        AuditLog::record($request->user(), 'user.password_reset', $user); // password kabhi log nahi hota

        return response()->json(['message' => 'Password has been reset.']);
    }

    private function authorizeManage(Request $request, User $user): void
    {
        abort_unless($this->policy->canManage($request->user(), $user), 403, 'You cannot manage this user.');
    }

    private function revokeSessions(User $user): void
    {
        $user->tokens()->delete();

        if (config('session.driver') === 'database') {
            DB::table(config('session.table', 'sessions'))->where('user_id', $user->id)->delete();
        }
    }
}