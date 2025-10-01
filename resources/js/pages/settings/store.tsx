import InputError from '@/components/input-error';
import SettingsLayout from '@/layouts/settings/layout';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { ChangeEvent, FormEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

interface StoreSettingsPageProps {
    settings: {
        ppn_rate: number;
        store_name: string;
        contact_details?: string | null;
        receipt_footer_text?: string | null;
        logo_url?: string | null;
        updated_at?: string | null;
    };
}

export default function StoreSettings({ settings }: StoreSettingsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const form = useForm<{
        ppn_rate: string;
        store_name: string;
        contact_details: string;
        receipt_footer_text: string;
        logo: File | null;
        remove_logo: boolean;
    }>({
        ppn_rate: settings.ppn_rate.toString(),
        store_name: settings.store_name,
        contact_details: settings.contact_details ?? '',
        receipt_footer_text: settings.receipt_footer_text ?? '',
        logo: null,
        remove_logo: false,
    });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.post('/settings/store', {
            method: 'put',
            forceFormData: true,
        });
    };

    const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
        form.setData('logo', event.target.files?.[0] ?? null);
        if (event.target.files?.[0]) {
            form.setData('remove_logo', false);
        }
    };

    const handleRemoveLogoChange = (checked: boolean | 'indeterminate') => {
        const value = checked === true;
        form.setData('remove_logo', value);
        if (value) {
            form.setData('logo', null);
        }
    };

    return (
        <SettingsLayout>
            <Head title="Store settings" />

            <div className="space-y-6">
                <div className="space-y-1">
                    <h2 className="text-lg font-semibold">Store preferences</h2>
                    <p className="text-sm text-muted-foreground">
                        Configure branding and tax settings that are used across the point of sale
                        experience.
                    </p>
                </div>

                {flash?.success && (
                    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="store_name">Store name</Label>
                            <Input
                                id="store_name"
                                name="store_name"
                                value={form.data.store_name}
                                onChange={(event) => form.setData('store_name', event.target.value)}
                            />
                            <InputError message={form.errors.store_name} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ppn_rate">PPN rate (%)</Label>
                            <Input
                                id="ppn_rate"
                                name="ppn_rate"
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={form.data.ppn_rate}
                                onChange={(event) => form.setData('ppn_rate', event.target.value)}
                            />
                            <InputError message={form.errors.ppn_rate} />
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="contact_details">Contact details</Label>
                            <textarea
                                id="contact_details"
                                name="contact_details"
                                value={form.data.contact_details}
                                onChange={(event) =>
                                    form.setData('contact_details', event.target.value)
                                }
                                className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
                            />
                            <InputError message={form.errors.contact_details} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="receipt_footer_text">Receipt footer</Label>
                            <textarea
                                id="receipt_footer_text"
                                name="receipt_footer_text"
                                value={form.data.receipt_footer_text}
                                onChange={(event) =>
                                    form.setData('receipt_footer_text', event.target.value)
                                }
                                className="min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2"
                            />
                            <InputError message={form.errors.receipt_footer_text} />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="logo">Logo</Label>
                            <Input
                                id="logo"
                                name="logo"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                            />
                            <InputError message={form.errors.logo} />
                        </div>

                        {(settings.logo_url || form.data.remove_logo) && (
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id="remove_logo"
                                    checked={form.data.remove_logo}
                                    onCheckedChange={handleRemoveLogoChange}
                                />
                                <div className="space-y-1 text-sm">
                                    <Label htmlFor="remove_logo" className="font-medium">
                                        Remove existing logo
                                    </Label>
                                    <p className="text-muted-foreground">
                                        Enable this option to clear the current store logo.
                                    </p>
                                </div>
                            </div>
                        )}

                        {settings.logo_url && !form.data.remove_logo && (
                            <div className="rounded-md border border-dashed border-border p-4">
                                <p className="mb-2 text-sm font-medium text-muted-foreground">
                                    Current logo preview
                                </p>
                                <img
                                    src={settings.logo_url}
                                    alt={`${settings.store_name} logo`}
                                    className="h-20 w-auto"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <Button type="submit" disabled={form.processing}>
                            Save changes
                        </Button>
                    </div>
                </form>
            </div>
        </SettingsLayout>
    );
}
