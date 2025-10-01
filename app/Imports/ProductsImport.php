<?php

namespace App\Imports;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ProductsImport implements ToCollection, WithHeadingRow, SkipsEmptyRows
{
    use Importable;

    private int $imported = 0;

    /**
     * @param Collection<int, Collection<string, mixed>> $rows
     */
    public function collection(Collection $rows): void
    {
        foreach ($rows as $row) {
            $barcode = (string) ($row->get('barcode') ?? '');
            $name = (string) ($row->get('name') ?? '');

            if ($barcode === '' || $name === '') {
                continue;
            }

            $stock = (int) ($row->get('stock') ?? 0);
            $price = is_numeric($row->get('price'))
                ? (float) $row->get('price')
                : 0.0;

            $reorderPoint = $this->normalizeNullableInteger($row->get('reorder_point'));
            $reorderQuantity = $this->normalizeNullableInteger($row->get('reorder_quantity'));
            $costPrice = $this->normalizeNullableDecimal($row->get('cost_price'));

            $imagePath = $row->get('image_path');
            $imagePath = is_string($imagePath) && Str::of($imagePath)->trim()->isNotEmpty()
                ? Str::of($imagePath)->trim()->value()
                : null;

            $product = Product::updateOrCreate(
                ['barcode' => $barcode],
                [
                    'name' => $name,
                    'stock' => max($stock, 0),
                    'price' => $price >= 0 ? $price : 0,
                    'cost_price' => $costPrice,
                    'reorder_point' => $reorderPoint,
                    'reorder_quantity' => $reorderQuantity,
                    'image_path' => $imagePath,
                ],
            );

            if ($row->has('categories')) {
                $categoryIds = $this->syncCategories($row->get('categories'));
                $product->categories()->sync($categoryIds);
            }

            $this->imported++;
        }
    }

    public function importedCount(): int
    {
        return $this->imported;
    }

    /**
     * @return array<int, int>
     */
    private function syncCategories(mixed $rawCategories): array
    {
        if (!is_string($rawCategories)) {
            return [];
        }

        $segments = preg_split('/[|,;]+/', $rawCategories);

        return collect($segments ?: [])
            ->map(fn (mixed $segment) => is_string($segment) ? trim($segment) : null)
            ->filter()
            ->unique()
            ->map(function (string $name): int {
                $category = Category::firstOrCreate(['name' => $name]);

                return $category->id;
            })
            ->values()
            ->all();
    }

    private function normalizeNullableInteger(mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            return max(0, (int) $value);
        }

        return null;
    }

    private function normalizeNullableDecimal(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_numeric($value)) {
            $number = (float) $value;

            return $number >= 0 ? round($number, 2) : null;
        }

        return null;
    }
}
