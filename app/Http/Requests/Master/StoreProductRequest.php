<?php

namespace App\Http\Requests\Master;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'barcode' => ['required', 'string', 'max:255', Rule::unique('products', 'barcode')],
            'name' => ['required', 'string', 'max:255'],
            'stock' => ['required', 'integer', 'min:0'],
            'price' => ['required', 'numeric', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', Rule::exists('categories', 'id')],
        ];
    }
}
