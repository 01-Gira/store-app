import { useCallback, useEffect, useMemo, useState } from 'react';

export interface TableFilterOption<T> {
    label: string;
    value: string;
    predicate?: (item: T) => boolean;
}

export interface UseTableControlsOptions<T> {
    searchFields?: Array<(item: T) => string | number | null | undefined>;
    filters?: TableFilterOption<T>[];
    initialFilter?: string;
    initialPageSize?: number;
    pageSizeOptions?: number[];
}

export interface TableRange {
    start: number;
    end: number;
}

export interface TableControlsResult<T> {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    filterValue: string;
    setFilterValue: (value: string) => void;
    filterOptions: TableFilterOption<T>[];
    page: number;
    pageCount: number;
    pageSize: number;
    pageSizeOptions: number[];
    setPageSize: (value: number) => void;
    goToPage: (page: number) => void;
    items: T[];
    total: number;
    filteredTotal: number;
    range: TableRange;
}

const DEFAULT_PAGE_SIZES = [5, 10, 20, 50];

export function useTableControls<T>(
    data: T[],
    {
        searchFields = [],
        filters = [],
        initialFilter,
        initialPageSize = 10,
        pageSizeOptions = DEFAULT_PAGE_SIZES,
    }: UseTableControlsOptions<T> = {},
): TableControlsResult<T> {
    const [searchTerm, setSearchTerm] = useState('');

    const resolvedInitialFilter = useMemo(() => {
        if (filters.length === 0) {
            return 'all';
        }

        if (initialFilter && filters.some((option) => option.value === initialFilter)) {
            return initialFilter;
        }

        return filters[0]?.value ?? 'all';
    }, [filters, initialFilter]);

    const [filterValue, setFilterValue] = useState(resolvedInitialFilter);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(initialPageSize);

    useEffect(() => {
        setPage(1);
    }, [searchTerm, filterValue, pageSize]);

    const filtered = useMemo(() => {
        const normalizedTerm = searchTerm.trim().toLowerCase();

        let next = data;

        if (normalizedTerm.length > 0) {
            next = next.filter((item) =>
                searchFields.some((selector) => {
                    const value = selector(item);

                    if (value == null) {
                        return false;
                    }

                    return String(value).toLowerCase().includes(normalizedTerm);
                }),
            );
        }

        if (filters.length > 0) {
            const activeFilter = filters.find((option) => option.value === filterValue);

            if (activeFilter?.predicate) {
                next = next.filter((item) => activeFilter.predicate?.(item));
            }
        }

        return next;
    }, [data, filterValue, filters, searchFields, searchTerm]);

    const total = data.length;
    const filteredTotal = filtered.length;

    const pageCount = Math.max(1, Math.ceil(filteredTotal / pageSize));

    useEffect(() => {
        setPage((current) => {
            if (current < 1) {
                return 1;
            }

            if (current > pageCount) {
                return pageCount;
            }

            return current;
        });
    }, [pageCount]);

    const safePage = Math.min(Math.max(page, 1), pageCount);

    const startIndex = filteredTotal === 0 ? 0 : (safePage - 1) * pageSize;
    const endIndex = filteredTotal === 0 ? 0 : Math.min(startIndex + pageSize, filteredTotal);

    const items = useMemo(() => {
        if (filteredTotal === 0) {
            return [];
        }

        return filtered.slice(startIndex, endIndex);
    }, [filtered, endIndex, filteredTotal, startIndex]);

    const goToPage = useCallback((nextPage: number) => {
        setPage((current) => {
            if (Number.isNaN(nextPage)) {
                return current;
            }

            const target = Math.max(1, Math.floor(nextPage));

            if (target > pageCount) {
                return pageCount;
            }

            return target;
        });
    }, [pageCount]);

    const handlePageSizeChange = useCallback((value: number) => {
        setPageSize(value);
    }, []);

    return {
        searchTerm,
        setSearchTerm,
        filterValue,
        setFilterValue,
        filterOptions: filters,
        page: safePage,
        pageCount,
        pageSize,
        pageSizeOptions,
        setPageSize: handlePageSizeChange,
        goToPage,
        items,
        total,
        filteredTotal,
        range: {
            start: filteredTotal === 0 ? 0 : startIndex + 1,
            end: filteredTotal === 0 ? 0 : endIndex,
        },
    };
}
