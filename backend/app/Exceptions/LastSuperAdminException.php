<?php

namespace App\Exceptions;

use RuntimeException;

class LastSuperAdminException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The last active Super Admin cannot be removed, deactivated or downgraded.');
    }

    public function render()
    {
        return response()->json(['message' => $this->getMessage()], 422);
    }
}