<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\GrantPolicy;
use App\Services\UserAccessRules;
use App\Services\UserPresenter;
use App\Support\ApiQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function __construct(private GrantPolicy $policy, private UserAccessRules $rules)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user();
        $query = User::query()->with('branches');

        if ($actor->type !== 'super_admin') {
            $query->where('type', 'staff');
        }
        if ($v = ApiQuery::param($request, 'type')) {
            $query->where('type', $v);
        }
        if ($v = ApiQuery::param($request, 'roleId')) {
            $query->where('role', Role::whereKey($v)->value('key') ?? '__none__');
        } elseif ($v = ApiQuery::param($request, 'role')) {
            $query->where('role', $v);
        }
        if ($v = ApiQuery::param($request, 'branchId', 'branch_id')) {
            $query->whereHas('branches', fn ($b) => $b->where('branches.id', $v));
        }
        if (in_array($request->query('status'), ['active', 'inactive'], true)) {
            $query->where('is_active', $request->query('status') === 'active');
        }
        if ($v = ApiQuery::param($request, 'search')) {
            $query->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('email', 'like', "%{$v}%"));
        }
        ApiQuery::sort($query, $request, ['name' => 'name', 'email' => 'email', 'type' => 'type', 'roleName' => 'role'], 'name');

        $page = $query->paginate(ApiQuery::perPage($request, 15));

        return response()->json(ApiQuery::page($page, fn ($u) => UserPresenter::make($u)));
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $this->authorizeManage($request, $user);

        return response()->json(['data' => UserPresenter::make($user)]);
    }

    public function store(Request $request): JsonResponse
    {
        $actor = $request->user();
        $this->normalize($request);

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            // Frontend password nahi bhejta: random password + "password set karein" link email par
            'password' => 'sometimes|string|min:8',
            'access_expires_at' => 'nullable|date',
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
                'email' => Str::lower($data['email']),
                'password' => $data['password'] ?? Str::password(32),
                'access_expires_at' => $data['access_expires_at'] ?? null,
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

        if (! isset($data['password'])) {
            Password::sendResetLink(['email' => $user->email]);
        }

        return response()->json(['data' => UserPresenter::make($user->fresh('branches'))], 201);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $actor = $request->user();
        $this->authorizeManage($request, $user);
        $this->normalize($request);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'sometimes|in:super_admin,admin,staff',
            'is_active' => 'sometimes|boolean',
            'access_expires_at' => 'sometimes|nullable|date',
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

        $attrs = array_intersect_key($data, array_flip(['name', 'email', 'two_factor_enabled', 'is_active', 'access_expires_at']));
        if (isset($attrs['email'])) {
            $attrs['email'] = Str::lower($attrs['email']);
        }
        if (isset($data['type']) && $data['type'] !== $user->type) {
            // Super Admin ka type yahan nahi badalta; Admin sirf Super Admin bana sakta hai
            abort_if($user->type === 'super_admin' || $data['type'] === 'super_admin', 403, 'This user type cannot be changed here.');
            abort_if($data['type'] === 'admin' && $actor->type !== 'super_admin', 403, 'Only a Super Admin can create Admins.');
            $attrs['type'] = $data['type'];
        }

        $newType = $attrs['type'] ?? $user->type;
        if ($newType !== 'super_admin' && (array_key_exists('role', $data) || isset($attrs['type']))) {
            $attrs['role'] = $this->rules->roleFor($actor, $newType, $data['role'] ?? $user->role);
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

        $this->normalize($request);
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

    /** DELETE /users/{user}. Aakhri Super Admin model guard se bachta hai. */
    public function destroy(Request $request, User $user): Response
    {
        $actor = $request->user();
        $this->authorizeManage($request, $user);
        abort_if($actor->is($user), 409, 'You cannot delete your own account.');

        DB::transaction(function () use ($actor, $user) {
            $this->revokeSessions($user);
            AuditLog::record($actor, 'user.deleted', null, ['userId' => $user->id, 'email' => $user->email]);
            $user->delete();
        });

        return response()->noContent();
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

        $data = $request->validate(['password' => 'sometimes|string|min:8|confirmed']);

        if (! isset($data['password'])) {
            // Frontend ka tareeqa: user ko password reset link email par jata hai
            Password::sendResetLink(['email' => $user->email]);
            AuditLog::record($request->user(), 'user.password_reset_link', $user);

            return response()->json(['message' => 'A password reset link has been emailed to the user.']);
        }

        $user->update(['password' => $data['password']]);
        $this->revokeSessions($user);
        AuditLog::record($request->user(), 'user.password_reset', $user); // password kabhi log nahi hota

        return response()->json(['message' => 'Password has been reset.']);
    }

    /** Frontend (camelCase) body ko backend ke naamon par laata hai. Purane naam bhi chalte rahte hain. */
    private function normalize(Request $request): void
    {
        $in = $request->all();
        $map = [
            'isActive' => 'is_active', 'branchIds' => 'branch_ids', 'accessExpiresAt' => 'access_expires_at',
            'twoFactorEnabled' => 'two_factor_enabled',
        ];
        foreach ($map as $from => $to) {
            if (array_key_exists($from, $in) && ! array_key_exists($to, $in)) {
                $request->merge([$to => $in[$from]]);
            }
        }
        if (array_key_exists('roleId', $in) && ! array_key_exists('role', $in)) {
            $request->merge(['role' => $in['roleId'] ? Role::whereKey($in['roleId'])->value('key') : null]);
        }
        if ((array_key_exists('discountPercent', $in) || array_key_exists('adjustmentUnits', $in)) && ! array_key_exists('limits', $in)) {
            $request->merge(['limits' => [
                'discountPercent' => $in['discountPercent'] ?? null,
                'adjustmentUnits' => $in['adjustmentUnits'] ?? null,
                'maxSaleWithoutApproval' => null,
            ]]);
        }
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