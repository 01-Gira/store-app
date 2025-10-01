<?php

namespace App\Http\Controllers\Inventory;

use App\Http\Controllers\Controller;
use App\Http\Requests\Inventory\StoreSupplierRequest;
use App\Http\Requests\Inventory\UpdateSupplierRequest;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class SupplierController extends Controller
{
    public function index(): Response
    {
        $suppliers = Supplier::query()
            ->withCount('products')
            ->orderBy('name')
            ->get()
            ->map(fn (Supplier $supplier): array => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'contact_name' => $supplier->contact_name,
                'email' => $supplier->email,
                'phone' => $supplier->phone,
                'lead_time_days' => $supplier->lead_time_days,
                'notes' => $supplier->notes,
                'product_count' => $supplier->products_count,
                'created_at' => $supplier->created_at?->toISOString(),
                'updated_at' => $supplier->updated_at?->toISOString(),
            ]);

        $unassignedProducts = Product::query()
            ->select(['id', 'name', 'barcode'])
            ->whereNull('supplier_id')
            ->orderBy('name')
            ->get()
            ->map(fn (Product $product): array => [
                'id' => $product->id,
                'name' => $product->name,
                'barcode' => $product->barcode,
            ]);

        return Inertia::render('inventory/suppliers/index', [
            'suppliers' => $suppliers,
            'unassignedProducts' => $unassignedProducts,
        ]);
    }

    public function store(StoreSupplierRequest $request): RedirectResponse
    {
        Supplier::create($request->validated());

        return Redirect::back()->with('success', 'Supplier created successfully.');
    }

    public function update(UpdateSupplierRequest $request, Supplier $supplier): RedirectResponse
    {
        $supplier->update($request->validated());

        return Redirect::back()->with('success', 'Supplier updated successfully.');
    }

    public function destroy(Supplier $supplier): RedirectResponse
    {
        $supplier->products()->update(['supplier_id' => null]);
        $supplier->delete();

        return Redirect::back()->with('success', 'Supplier deleted successfully.');
    }
}
