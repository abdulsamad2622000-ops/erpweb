<?php

namespace App\Services;

class PermissionRegistry
{
    /** @return list<string> */
    public function keys(): array
    {
        return array_values(array_unique(config('permission_keys', [])));
    }

    public function has(string $key): bool
    {
        return in_array($key, $this->keys(), true);
    }

    /** Key format: module.resource.action (kuch keys mein resource nahi hota, jaise settings.manage). */
    public function describe(): array
    {
        return array_map(function (string $key) {
            $parts = explode('.', $key);
            $module = array_shift($parts);
            $action = array_pop($parts);

            return [
                'key' => $key,
                'module' => $module,
                'resource' => $parts[0] ?? null,
                'action' => $action,
            ];
        }, $this->keys());
    }
}