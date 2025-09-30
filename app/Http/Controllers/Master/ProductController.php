<?php

namespace App\Http\Controllers\Master;

use App\Exports\ProductsExport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Master\ImportProductsRequest;
use App\Http\Requests\Master\StoreProductRequest;
use App\Http\Requests\Master\UpdateProductRequest;
use App\Imports\ProductsImport;
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
        $products = Product::query()
            ->latest()
            ->get()
            ->map(function (Product $product): array {
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
                    'created_at' => $product->created_at?->toISOString(),
                    'updated_at' => $product->updated_at?->toISOString(),
                ];
            });

        return Inertia::render('master/products/index', [
            'products' => $products,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreProductRequest $request): RedirectResponse
    {
        $data = $request->validated();

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('products', 'public');
        }

        unset($data['image']);

        Product::create($data);

        return Redirect::back()->with('success', 'Product created successfully.');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateProductRequest $request, Product $product): RedirectResponse
    {
        $data = $request->validated();

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

        unset($data['image'], $data['remove_image']);

        $product->update($data);

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
