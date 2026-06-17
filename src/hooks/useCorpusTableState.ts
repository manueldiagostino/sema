"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SortingState, RowSelectionState } from "@tanstack/react-table";
import { SelectedFacets, DateRange } from "@/types/corpus";

export interface CorpusTableState {
  pagination: { pageIndex: number; pageSize: number };
  sorting: SortingState;
  rowSelection: RowSelectionState;
  selectedFacets: SelectedFacets;
  dateRange: DateRange;
  globalSearch: string;
  priceFilter: boolean | null;
  compareOpen: boolean;
  compareFullscreen: boolean;
  resetKey: number;
  setPagination: React.Dispatch<React.SetStateAction<{ pageIndex: number; pageSize: number }>>;
  setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
  setRowSelection: React.Dispatch<React.SetStateAction<RowSelectionState>>;
  setSelectedFacets: React.Dispatch<React.SetStateAction<SelectedFacets>>;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  setGlobalSearch: React.Dispatch<React.SetStateAction<string>>;
  setPriceFilter: React.Dispatch<React.SetStateAction<boolean | null>>;
  setCompareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCompareFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  setResetKey: React.Dispatch<React.SetStateAction<number>>;
  clearFilters: () => void;
  clearSelection: () => void;
}

export function useCorpusTableState(): CorpusTableState {
  const searchParams = useSearchParams();

  // Parse initial state from URL
  const initialPageIndex = searchParams.get("page")
    ? parseInt(searchParams.get("page")!, 10)
    : 0;
  const initialPageSize = searchParams.get("pageSize")
    ? parseInt(searchParams.get("pageSize")!, 10)
    : 25;
  const initialSortField = searchParams.get("sortField");
  const initialSortOrder = searchParams.get("sortOrder");
  const initialSorting: SortingState =
    initialSortField
      ? [{ id: initialSortField, desc: initialSortOrder === "desc" }]
      : [];

  const initialGlobalSearch = searchParams.get("search") ?? "";
  const initialDateRange: DateRange = {
    min: searchParams.get("dateFrom") ? parseInt(searchParams.get("dateFrom")!, 10) : 0,
    max: searchParams.get("dateTo") ? parseInt(searchParams.get("dateTo")!, 10) : 0,
  };
  const initialSelectedFacets: SelectedFacets = {};
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith("facet_")) {
      initialSelectedFacets[key.replace("facet_", "")] = value.split(",").filter(Boolean);
    }
  }

  const initialRowSelection: RowSelectionState = {};
  const compareIds = searchParams.get("compare");
  if (compareIds) {
    const ids = compareIds.split(",").filter(Boolean);
    for (const id of ids) {
      initialRowSelection[id] = true;
    }
  }

  const initialView = searchParams.get("view");
  const initialCompareOpen = initialView === "compare";
  const initialCompareFullscreen = initialView === "compare";

  const [pagination, setPagination] = useState({
    pageIndex: isNaN(initialPageIndex) ? 0 : initialPageIndex,
    pageSize: isNaN(initialPageSize) ? 25 : initialPageSize,
  });
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [selectedFacets, setSelectedFacets] = useState<SelectedFacets>(initialSelectedFacets);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  const [globalSearch, setGlobalSearch] = useState(initialGlobalSearch);
  const [priceFilter, setPriceFilter] = useState<boolean | null>(() => {
    const param = searchParams.get("price");
    if (param === "1") return true;
    if (param === "0") return false;
    return null;
  });
  const [resetKey, setResetKey] = useState(0);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(initialRowSelection);
  const [compareOpen, setCompareOpen] = useState(initialCompareOpen);
  const [compareFullscreen, setCompareFullscreen] = useState(initialCompareFullscreen);

  // Sync URL with state changes
  useEffect(() => {
    const params = new URLSearchParams();

    if (pagination.pageIndex !== 0) {
      params.set("page", String(pagination.pageIndex));
    }
    if (pagination.pageSize !== 25) {
      params.set("pageSize", String(pagination.pageSize));
    }

    if (sorting.length > 0) {
      params.set("sortField", sorting[0].id);
      params.set("sortOrder", sorting[0].desc ? "desc" : "asc");
    }

    for (const [facetId, values] of Object.entries(selectedFacets)) {
      if (values.length > 0) {
        params.set(`facet_${facetId}`, values.join(","));
      }
    }

    if (dateRange.min) {
      params.set("dateFrom", String(dateRange.min));
    }
    if (dateRange.max) {
      params.set("dateTo", String(dateRange.max));
    }

    if (globalSearch) {
      params.set("search", globalSearch);
    }

    if (priceFilter !== null) {
      params.set("price", priceFilter ? "1" : "0");
    }

    const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    if (selectedIds.length > 0) {
      params.set("compare", selectedIds.join(","));
    }

    if (compareOpen && compareFullscreen) {
      params.set("view", "compare");
    }

    const queryString = params.toString();
    const currentUrl = window.location.pathname + window.location.search;
    const newUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;

    if (currentUrl !== newUrl) {
      window.history.replaceState({}, "", newUrl);
    }
  }, [pagination, sorting, selectedFacets, dateRange, globalSearch, priceFilter, rowSelection, compareOpen, compareFullscreen]);

  // Auto-close drawer when selection drops below 2
  useEffect(() => {
    if (compareOpen && Object.keys(rowSelection).filter((k) => rowSelection[k]).length < 2) {
      setCompareOpen(false);
    }
  }, [compareOpen, rowSelection]);

  const clearFilters = useCallback(() => {
    setSelectedFacets({});
    setDateRange({ min: 0, max: 0 });
    setGlobalSearch("");
    setPriceFilter(null);
    setSorting([]);
    setPagination((prev) => ({ pageIndex: 0, pageSize: prev.pageSize }));
    setResetKey((k) => k + 1);
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const clearSelection = useCallback(() => {
    setRowSelection({});
    setCompareOpen(false);
  }, []);

  return {
    pagination,
    sorting,
    rowSelection,
    selectedFacets,
    dateRange,
    globalSearch,
    priceFilter,
    compareOpen,
    compareFullscreen,
    resetKey,
    setPagination,
    setSorting,
    setRowSelection,
    setSelectedFacets,
    setDateRange,
    setGlobalSearch,
    setPriceFilter,
    setCompareOpen,
    setCompareFullscreen,
    setResetKey,
    clearFilters,
    clearSelection,
  };
}
