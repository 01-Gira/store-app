<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\User;
use App\Notifications\LowStockAlert;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;

class CheckLowStockCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'inventory:check-low-stock';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Notify designated users about products below their reorder thresholds';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $defaultReorderPoint = (int) config('store.inventory.low_stock_threshold', 0);

        $products = Product::query()
            ->belowReorderPoint($defaultReorderPoint)
            ->orderBy('stock')
            ->orderBy('name')
            ->get();

        if ($products->isEmpty()) {
            $this->info('No low-stock products detected.');

            return self::SUCCESS;
        }

        $roles = $this->notificationRoles();

        $usersQuery = User::query();

        if ($roles->isNotEmpty()) {
            $usersQuery->role($roles->all());
        }

        $users = $usersQuery->get();

        if ($users->isEmpty()) {
            $this->warn('Low-stock products found, but no notification recipients are configured.');

            return self::SUCCESS;
        }

        Notification::send($users, new LowStockAlert($products, $defaultReorderPoint));

        $this->info(sprintf(
            'Dispatched low-stock alert to %d user(s) for %d product(s).',
            $users->count(),
            $products->count()
        ));

        return self::SUCCESS;
    }

    /**
     * @return Collection<int, string>
     */
    private function notificationRoles(): Collection
    {
        return collect(config('store.inventory.notification_roles', []))
            ->filter(fn ($role) => is_string($role) && $role !== '')
            ->values();
    }
}
