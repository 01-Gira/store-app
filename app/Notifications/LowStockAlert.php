<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class LowStockAlert extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param Collection<int, Product> $products
     */
    public function __construct(private readonly Collection $products, private readonly int $defaultReorderPoint)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        $channels = config('store.inventory.notification_channels', ['mail', 'database']);

        return collect($channels)
            ->filter(fn (string $channel) => in_array($channel, ['mail', 'database'], true))
            ->unique()
            ->values()
            ->all();
    }

    public function toMail(object $notifiable): MailMessage
    {
        $productLines = $this->products
            ->map(function (Product $product): string {
                $effectivePoint = $product->effectiveReorderPoint($this->defaultReorderPoint);
                $quantityNote = $product->reorder_quantity ? sprintf(' | reorder qty: %d', $product->reorder_quantity) : '';

                return sprintf(
                    '%s — stock: %d (reorder at %d%s)',
                    $product->name,
                    $product->stock,
                    $effectivePoint,
                    $quantityNote
                );
            })
            ->take(10);

        $message = (new MailMessage())
            ->subject('Low stock alert')
            ->greeting($this->buildGreeting($notifiable))
            ->line('The following products have fallen below their reorder thresholds:');

        foreach ($productLines as $line) {
            $message->line($line);
        }

        if ($this->products->count() > $productLines->count()) {
            $message->line(sprintf('...and %d more.', $this->products->count() - $productLines->count()));
        }

        return $message
            ->action('Review inventory', url('/master/products'))
            ->line('Consider replenishing these items soon to avoid stockouts.');
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Low stock alert',
            'message' => sprintf('%d products are below their reorder thresholds.', $this->products->count()),
            'default_reorder_point' => $this->defaultReorderPoint,
            'products' => $this->products
                ->map(function (Product $product): array {
                    $effectivePoint = $product->effectiveReorderPoint($this->defaultReorderPoint);

                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'stock' => $product->stock,
                        'reorder_point' => $product->reorder_point,
                        'effective_reorder_point' => $effectivePoint,
                        'reorder_quantity' => $product->reorder_quantity,
                    ];
                })
                ->values()
                ->all(),
        ];
    }

    private function buildGreeting(object $notifiable): string
    {
        $name = property_exists($notifiable, 'name') ? (string) $notifiable->name : '';

        return Str::of($name)->trim()->isNotEmpty()
            ? sprintf('Hello %s,', $name)
            : 'Hello,';
    }
}
