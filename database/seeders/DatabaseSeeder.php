<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Customer;
use App\Models\InventoryAdjustment;
use App\Models\InventoryLevel;
use App\Models\InventoryLocation;
use App\Models\Product;
use App\Models\ProductLot;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StoreSetting;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionItem;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        collect([
            'manage roles',
            'manage permissions',
            'manage users',
            'manage settings',
        ])->each(static function (string $name): void {
            Permission::firstOrCreate([
                'name' => $name,
                'guard_name' => 'web',
            ]);
        });

        $administratorRole = Role::firstOrCreate([
            'name' => 'Administrator',
            'guard_name' => 'web',
        ]);

        $administratorRole->syncPermissions(Permission::all());

        if (! $user->hasRole($administratorRole->name)) {
            $user->assignRole($administratorRole);
        }

        $additionalUsers = User::factory()->count(4)->create();
        $users = $additionalUsers->push($user);

        StoreSetting::current();

        $categories = Category::factory()->count(8)->create();
        $suppliers = Supplier::factory()->count(5)->create();
        $customers = Customer::factory()->count(10)->create();

        $products = Product::factory()
            ->count(20)
            ->recycle($suppliers)
            ->create()
            ->each(function (Product $product) use ($categories): void {
                $product->categories()->syncWithoutDetaching(
                    $categories->random(fake()->numberBetween(1, 3))->pluck('id')->all()
                );
            });

        $locations = Collection::make([
            InventoryLocation::factory()->create([
                'name' => 'Main Warehouse',
                'code' => 'MAIN',
                'is_default' => true,
            ]),
            InventoryLocation::factory()->create([
                'name' => 'Front Store',
                'code' => 'FRONT',
            ]),
            InventoryLocation::factory()->create([
                'name' => 'Overflow Storage',
                'code' => 'OVER',
            ]),
        ]);

        $products->each(function (Product $product) use ($locations): void {
            $levels = $locations->map(function (InventoryLocation $location) use ($product) {
                return InventoryLevel::factory()->create([
                    'product_id' => $product->id,
                    'inventory_location_id' => $location->id,
                ]);
            });

            $product->update([
                'stock' => $levels->sum('quantity'),
                'reorder_point' => fake()->numberBetween(5, 20),
                'reorder_quantity' => fake()->numberBetween(10, 40),
            ]);
        });

        InventoryAdjustment::factory()
            ->count(20)
            ->state(function () use ($products, $locations, $users) {
                $product = $products->random();

                return [
                    'product_id' => $product->id,
                    'inventory_location_id' => $locations->random()->id,
                    'user_id' => $users->random()->id,
                ];
            })
            ->create();

        $purchaseOrders = PurchaseOrder::factory()
            ->count(5)
            ->recycle($suppliers)
            ->create();

        $purchaseOrders->each(function (PurchaseOrder $purchaseOrder) use ($products, $locations): void {
            $items = PurchaseOrderItem::factory()
                ->count(fake()->numberBetween(2, 5))
                ->make()
                ->each(function (PurchaseOrderItem $item) use ($purchaseOrder, $products): void {
                    $product = $products->random();
                    $item->purchase_order_id = $purchaseOrder->id;
                    $item->product_id = $product->id;
                });

            $purchaseOrder->items()->saveMany($items);
            $purchaseOrder->refresh();

            $purchaseOrder->items->each(function (PurchaseOrderItem $item) use ($locations): void {
                if ($item->quantity_received <= 0) {
                    return;
                }

                $lotCount = min($item->quantity_received, fake()->numberBetween(1, 2));
                $remaining = $item->quantity_received;

                for ($index = 1; $index <= $lotCount; $index++) {
                    $quantity = $index === $lotCount
                        ? $remaining
                        : fake()->numberBetween(1, max($remaining - ($lotCount - $index), 1));

                    ProductLot::factory()->create([
                        'product_id' => $item->product_id,
                        'inventory_location_id' => $locations->random()->id,
                        'purchase_order_item_id' => $item->id,
                        'quantity' => $quantity,
                        'received_at' => fake()->dateTimeBetween('-2 weeks', 'now'),
                    ]);

                    $remaining -= $quantity;
                }
            });

            $totalCost = $purchaseOrder->items->sum(fn (PurchaseOrderItem $item) => $item->quantity_ordered * $item->unit_cost);

            $purchaseOrder->update([
                'total_cost' => $totalCost,
                'status' => $purchaseOrder->items->every->isFulfilled()
                    ? PurchaseOrder::STATUS_RECEIVED
                    : PurchaseOrder::STATUS_PARTIAL,
                'received_at' => $purchaseOrder->items->every(fn (PurchaseOrderItem $item) => $item->quantity_received > 0)
                    ? now()->subDays(fake()->numberBetween(1, 14))
                    : null,
            ]);
        });

        $transactions = Transaction::factory()
            ->count(20)
            ->state(function () use ($users, $customers) {
                return [
                    'user_id' => $users->random()->id,
                    'customer_id' => fake()->boolean(70) ? $customers->random()->id : null,
                ];
            })
            ->create();

        $transactions->each(function (Transaction $transaction) use ($products): void {
            $items = TransactionItem::factory()
                ->count(fake()->numberBetween(1, 4))
                ->make()
                ->each(function (TransactionItem $item) use ($transaction, $products): void {
                    $product = $products->random();
                    $item->transaction_id = $transaction->id;
                    $item->product_id = $product->id;
                    $item->barcode = $product->barcode;
                    $item->name = $product->name;
                });

            $transaction->items()->saveMany($items);
            $transaction->refresh();

            $items = $transaction->items;
            $itemsCount = $items->sum('quantity');
            $subtotal = round($items->sum('line_total'), 2);
            $taxTotal = round($items->sum('tax_amount'), 2);
            $discount = fake()->boolean(30)
                ? round($subtotal * fake()->randomFloat(2, 0.02, 0.1), 2)
                : 0.0;
            $total = round($subtotal + $taxTotal - $discount, 2);
            $amountPaid = $total + (fake()->boolean(20) ? round(fake()->randomFloat(2, 100, 20000), 2) : 0.0);

            $transaction->update([
                'items_count' => $itemsCount,
                'subtotal' => $subtotal,
                'tax_total' => $taxTotal,
                'discount_total' => $discount,
                'total' => $total,
                'amount_paid' => $amountPaid,
                'change_due' => round(max($amountPaid - $total, 0), 2),
            ]);
        });
    }
}
