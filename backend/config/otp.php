<?php

return [
    // Sirf local/dev: hamesha yehi code chalega. Production mein khali rakho.
    'fixed_code' => env('OTP_FIXED_CODE'),
    'ttl_minutes' => 10,
    'resend_seconds' => 60,
];