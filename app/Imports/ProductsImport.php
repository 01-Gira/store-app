<?php

namespace App\Imports;

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

            $imagePath = $row->get('image_path');
            $imagePath = is_string($imagePath) && Str::of($imagePath)->trim()->isNotEmpty()
                ? Str::of($imagePath)->trim()->value()
                : null;

            Product::updateOrCreate(
                ['barcode' => $barcode],
                [
                    'name' => $name,
                    'stock' => max($stock, 0),
                    'price' => $price >= 0 ? $price : 0,
                    'image_path' => $imagePath,
                ],
            );

            $this->imported++;
        }
    }

    public function importedCount(): int
    {
        return $this->imported;
    }
}
