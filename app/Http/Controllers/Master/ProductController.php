<?php

namespace App\Http\Controllers\Master;

use App\Exports\ProductsExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Master\ImportProductsRequest;
use App\Http\Requests\Master\StoreProductRequest;
use App\Http\Requests\Master\UpdateProductRequest;
use App\Imports\ProductsImport;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Maatwebsite\Excel\Excel as ExcelWriter;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): Response
    {
        $defaultReorderPoint = (int) config('store.inventory.low_stock_threshold', 0);

        $products = Product::query()
            ->with('categories')
            ->latest()
            ->get()
            ->map(function (Product $product) use ($defaultReorderPoint): array {
                $imageUrl = null;

                if ($product->image_path && Storage::disk('public')->exists($product->image_path)) {
                    $imageUrl = Storage::disk('public')->url($product->image_path);
                }

                return [
                    'id' => $product->id,
                    'barcode' => $product->barcode,
                    'name' => $product->name,
                    'stock' => $product->stock,
                    'price' => $product->price,
                    'image_path' => $product->image_path,
                    'image_url' => $imageUrl,
                    'reorder_point' => $product->reorder_point,
                    'reorder_quantity' => $product->reorder_quantity,
                    'effective_reorder_point' => $product->effectiveReorderPoint($defaultReorderPoint),
                    'is_low_stock' => $product->isBelowReorderPoint($defaultReorderPoint),
                    'created_at' => $product->created_at?->toISOString(),
                    'updated_at' => $product->updated_at?->toISOString(),
                    'categories' => $product->categories
                        ->sortBy('name')
                        ->map(fn (Category $category): array => [
                            'id' => $category->id,
                            'name' => $category->name,
                        ])
                        ->values()
                        ->all(),
                ];
            });

        $availableCategories = Category::query()
            ->orderBy('name')
            ->get()
            ->map(fn (Category $category): array => [
                'id' => $category->id,
                'name' => $category->name,
            ]);

        return Inertia::render('master/products/index', [
            'products' => $products,
            'availableCategories' => $availableCategories,
            'defaultReorderPoint' => $defaultReorderPoint,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreProductRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $categoryIds = collect($data['category_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('products', 'public');
        }

        $data['reorder_point'] = $data['reorder_point'] ?? null;
        $data['reorder_quantity'] = $data['reorder_quantity'] ?? null;
        unset($data['image'], $data['category_ids']);

        $product = Product::create($data);
        $product->categories()->sync($categoryIds);

        return Redirect::back()->with('success', 'Product created successfully.');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();
        $categoryIds = null;

        if (array_key_exists('category_ids', $data)) {
            $categoryIds = collect($data['category_ids'] ?? [])
                ->map(fn ($id) => (int) $id)
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        if ($request->boolean('remove_image') && $product->image_path) {
            Storage::disk('public')->delete($product->image_path);
            $data['image_path'] = null;
        }

        if ($request->hasFile('image')) {
            if ($product->image_path) {
                Storage::disk('public')->delete($product->image_path);
            }

            $data['image_path'] = $request->file('image')->store('products', 'public');
        }

        $data['reorder_point'] = $data['reorder_point'] ?? null;
        $data['reorder_quantity'] = $data['reorder_quantity'] ?? null;
        unset($data['image'], $data['remove_image'], $data['category_ids']);

        $product->update($data);

        if ($categoryIds !== null) {
            $product->categories()->sync($categoryIds);
        }

        return Redirect::back()->with('success', 'Product updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product): RedirectResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
        }

        $product->delete();

        return Redirect::back()->with('success', 'Product deleted successfully.');
    }

    public function import(ImportProductsRequest $request): RedirectResponse
    {
        $import = new ProductsImport();
        Excel::import($import, $request->file('file'));

        $imported = $import->importedCount();

        return Redirect::back()->with(
            'success',
            $imported > 0
                ? "Imported {$imported} products successfully."
                : 'No products were imported. Ensure the file has a header row with barcode and name columns.',
        );
    }

    public function export(Request $request)
    {
        $format = $request->query('format', 'xlsx');
        $filename = 'products-' . now()->format('Ymd_His');

        return match ($format) {
            'csv' => Excel::download(new ProductsExport(), "{$filename}.csv", ExcelWriter::CSV),
            'xls' => Excel::download(new ProductsExport(), "{$filename}.xls", ExcelWriter::XLS),
            default => Excel::download(new ProductsExport(), "{$filename}.xlsx", ExcelWriter::XLSX),
        };
    }
}
