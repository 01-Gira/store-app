<?php

namespace App\Http\Controllers\Transactions;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\StoreCustomerRequest;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));

        $customers = Customer::query()
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('loyalty_number', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(15)
            ->get([
                'id',
                'name',
                'email',
                'phone',
                'loyalty_number',
                'loyalty_points',
                'enrolled_at',
            ])
            ->map(fn (Customer $customer) => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'loyalty_number' => $customer->loyalty_number,
                'loyalty_points' => $customer->loyalty_points,
                'enrolled_at' => $customer->enrolled_at?->toIso8601String(),
            ])
            ->values();

        return response()->json(['data' => $customers]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $customer = Customer::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'loyalty_number' => $validated['loyalty_number'] ?? null,
            'loyalty_points' => 0,
            'enrolled_at' => ($validated['loyalty_number'] ?? null) !== null ? now() : null,
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'loyalty_number' => $customer->loyalty_number,
                'loyalty_points' => $customer->loyalty_points,
                'enrolled_at' => $customer->enrolled_at?->toIso8601String(),
                'notes' => $customer->notes,
            ],
        ], 201);
    }
}
