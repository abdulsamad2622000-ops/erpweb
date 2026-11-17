<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PermissionRegistry;
use Illuminate\Http\JsonResponse;

class PermissionRegistryController extends Controller
{
    public function __invoke(PermissionRegistry $registry): JsonResponse
    {
        return response()->json(['data' => $registry->describe()]);
    }
}