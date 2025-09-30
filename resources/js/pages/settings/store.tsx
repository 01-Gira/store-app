import InputError from '@/components/input-error';
import SettingsLayout from '@/layouts/settings/layout';
import { type SharedData } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface StoreSettingsPageProps {
    settings: {
        ppn_rate: number;
        updated_at?: string | null;
    };
}

export default function StoreSettings({ settings }: StoreSettingsPageProps) {
    const { flash } = usePage<SharedData>().props;
    const form = useForm<{ ppn_rate: string }>({
        ppn_rate: settings.ppn_rate.toString(),
    });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        form.put('/settings/store');
    };

    return (
        <SettingsLayout>
            <Head title="Store settings" />

            <div className="space-y-6">
                <div>
                    <h2 className="text-lg font-semibold">Store preferences</h2>
                    <p className="text-sm text-muted-foreground">
                        Configure tax settings that are used when recording transactions.
                    </p>
                </div>

                {flash?.success && (
                    <Alert className="border-green-200 bg-green-50 text-green-900 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-100">
                        <AlertTitle>Success</AlertTitle>
                        <AlertDescription>{flash.success}</AlertDescription>
                    </Alert>
                )}

                <form className="space-y-4" onSubmit={handleSubmit}>
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
