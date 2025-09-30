<?php

namespace App\Exports;

use App\Models\Product;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ProductsExport implements FromCollection, WithHeadings, WithMapping
{
    /**
     * @return Collection<int, Product>
     */
    public function collection(): Collection
    {
        return Product::query()
            ->with('categories')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @param Product $product
     * @return array<int, mixed>
     */
    public function map($product): array
    {
        return [
            $product->id,
            $product->barcode,
            $product->name,
            $product->stock,
            $product->price,
            $product->image_path,
            $product->categories
                ->sortBy('name')
                ->pluck('name')
                ->implode(', '),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function headings(): array
    {
        return ['id', 'barcode', 'name', 'stock', 'price', 'image_path', 'categories'];
    }
}
