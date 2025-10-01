import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TableFilterOption } from '@/hooks/use-table-controls';
import type { TableRange } from '@/hooks/use-table-controls';
import { type SharedData } from '@/types';
import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { usePage } from '@inertiajs/react';

interface TableToolbarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;
    filterOptions?: TableFilterOption<unknown>[];
    filterValue?: string;
    onFilterChange?: (value: string) => void;
    pageSize: number;
    pageSizeOptions: number[];
    onPageSizeChange: (size: number) => void;
    total: number;
    filteredTotal: number;
    className?: string;
}

export function TableToolbar({
    searchTerm,
    onSearchChange,
    searchPlaceholder = 'Cari…',
    filterOptions,
    filterValue,
    onFilterChange,
    pageSize,
    pageSizeOptions,
    onPageSizeChange,
    total,
    filteredTotal,
    className,
}: TableToolbarProps) {
    const { storeSettings } = usePage<SharedData>().props;
    const locale = storeSettings?.language_code ?? 'id-ID';
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const showFilters = (filterOptions?.length ?? 0) > 0;
    const isFiltered = showFilters && filteredTotal !== total;

    return (
        <div className={cn('flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between', className)}>
            <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="table-search" className="text-xs font-medium uppercase text-muted-foreground">
                    Pencarian
                </Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        id="table-search"
                        value={searchTerm}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-9"
                    />
                </div>
                {isFiltered && (
                    <p className="text-xs text-muted-foreground">
                        Menyaring {numberFormatter.format(filteredTotal)} dari {numberFormatter.format(total)} entri.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end">
                {showFilters && filterValue != null && onFilterChange && (
                    <div className="flex flex-col gap-2">
                        <Label className="text-xs font-medium uppercase text-muted-foreground">Filter</Label>
                        <Select value={filterValue} onValueChange={onFilterChange}>
                            <SelectTrigger className="w-56">
                                <SelectValue placeholder="Pilih filter" />
                            </SelectTrigger>
                            <SelectContent>
                                {filterOptions!.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <Label className="text-xs font-medium uppercase text-muted-foreground">Baris per halaman</Label>
                    <Select
                        value={String(pageSize)}
                        onValueChange={(value) => onPageSizeChange(Number.parseInt(value, 10))}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {pageSizeOptions.map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                    {size} baris
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}

interface TablePaginationProps {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    range: TableRange;
    total: number;
    filteredTotal: number;
    className?: string;
}

export function TablePagination({
    page,
    pageCount,
    onPageChange,
    range,
    total,
    filteredTotal,
    className,
}: TablePaginationProps) {
    const { storeSettings } = usePage<SharedData>().props;
    const locale = storeSettings?.language_code ?? 'id-ID';
    const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
    const summary = useMemo(() => {
        if (filteredTotal === 0) {
            return 'Tidak ada data untuk ditampilkan.';
        }

        const visibleRange = `${range.start}-${range.end}`;
        const filteredText = `Menampilkan ${visibleRange} dari ${numberFormatter.format(filteredTotal)} entri`;

        if (filteredTotal === total) {
            return filteredText;
        }

        return `${filteredText} (difilter dari ${numberFormatter.format(total)} entri)`;
    }, [filteredTotal, numberFormatter, range.end, range.start, total]);

    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
            <p className="text-xs text-muted-foreground">{summary}</p>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                >
                    Sebelumnya
                </Button>
                <span className="text-xs text-muted-foreground">
                    Halaman {page} dari {pageCount}
                </span>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= pageCount}
                >
                    Berikutnya
                </Button>
            </div>
        </div>
    );
}
