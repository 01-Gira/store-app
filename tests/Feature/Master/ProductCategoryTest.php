<?php

use App\Exports\ProductsExport;
use App\Imports\ProductsImport;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;

uses(RefreshDatabase::class);

test('products can be created with categories', function () {
    $user = User::factory()->create();
    $categories = Category::factory()->count(3)->create();

    $response = $this
        ->actingAs($user)
        ->from('/master/products')
        ->post('/master/products', [
            'barcode' => 'CAT-100',
            'name' => 'Category aware product',
            'stock' => 15,
            'price' => 49.99,
            'category_ids' => $categories->take(2)->pluck('id')->all(),
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/master/products');

    $product = Product::where('barcode', 'CAT-100')->firstOrFail();

    expect($product->categories()->pluck('categories.id')->all())
        ->toBe($categories->take(2)->pluck('id')->all());
});

test('products can be updated with categories', function () {
    $user = User::factory()->create();
    $initialCategories = Category::factory()->count(2)->create();
    $product = Product::create([
        'barcode' => 'CAT-200',
        'name' => 'Updatable product',
        'stock' => 5,
        'price' => 15.5,
    ]);
    $product->categories()->sync($initialCategories->pluck('id'));

    $newCategories = Category::factory()->count(2)->create();

    $response = $this
        ->actingAs($user)
        ->from('/master/products')
        ->put("/master/products/{$product->id}", [
            'barcode' => 'CAT-200',
            'name' => 'Updatable product',
            'stock' => 20,
            'price' => 25.0,
            'remove_image' => false,
            'category_ids' => [
                $initialCategories->last()->id,
                $newCategories->first()->id,
            ],
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect('/master/products');

    $product->refresh();

    expect($product->categories()->pluck('categories.id')->all())
        ->toBe([
            $initialCategories->last()->id,
            $newCategories->first()->id,
        ]);
});

test('products import maps categories from the spreadsheet', function () {
    Category::factory()->create(['name' => 'Electronics']);
    $import = new ProductsImport();

    $rows = new Collection([
        new Collection([
            'barcode' => 'IMP-100',
            'name' => 'Imported product',
            'stock' => 3,
            'price' => 9.99,
            'categories' => 'Electronics, Gadgets | Accessories; Gadgets',
        ]),
    ]);

    $import->collection($rows);

    $product = Product::where('barcode', 'IMP-100')->firstOrFail();

    expect($product->categories()->pluck('name')->sort()->values()->all())
        ->toBe([
            'Accessories',
            'Electronics',
            'Gadgets',
        ]);
    expect(Category::where('name', 'Electronics')->count())->toBe(1);
    expect($import->importedCount())->toBe(1);
});

test('products export includes category names', function () {
    $product = Product::create([
        'barcode' => 'EXP-100',
        'name' => 'Exportable product',
        'stock' => 12,
        'price' => 19.5,
    ]);

    $categories = Category::factory()->count(2)->create();

    $product->categories()->sync($categories->pluck('id'));

    $export = new ProductsExport();
    $row = $export->map($product->load('categories'));

    expect($export->headings())
        ->toBe([
            'id',
            'barcode',
            'name',
            'stock',
            'price',
            'cost_price',
            'reorder_point',
            'reorder_quantity',
            'image_path',
            'categories',
        ]);
    expect($row[9])
        ->toBe(
            $categories
                ->pluck('name')
                ->sort()
                ->values()
                ->implode(', '),
        );
});
