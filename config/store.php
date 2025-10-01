<?php

return [
    'dashboard' => [
        'default_range_days' => 14,
        'max_range_days' => 90,
        'cache_minutes' => 5,
    ],
    'inventory' => [
        'low_stock_threshold' => 10,
        'notification_roles' => ['Administrator'],
        'notification_channels' => ['mail', 'database'],
    ],
];
