"use client";

import { useMemo } from "react";
import { CorpusItem, SelectedFacets, DateRange, CharterType } from "@/types/corpus";

/** Extract charter type label from a document ID */
export function getCharterTypeLabel(itemId: string, ctList: CharterType[]): string | null {
  const lastUnderscore = itemId.lastIndexOf("_");
  const prefix = lastUnderscore >= 0 ? itemId.slice(0, lastUnderscore) : itemId;
  const ct = ctList.find((c) => c.id === prefix);
  return ct?.label ?? null;
}

/** Extract a 4-digit year from a dating string (e.g. "1136 marzo 15" → 1136) */
function extractYear(dateStr: string): number | null {
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : null;
}

export function useCorpusFiltering(
  data: CorpusItem[] | undefined,
  globalSearch: string,
  selectedFacets: SelectedFacets,
  dateRange: DateRange,
  priceFilter: boolean | null,
  charterTypes: CharterType[],
): CorpusItem[] {
  return useMemo(() => {
    if (!data) return [];
    let result = data;

    // Layer 1: Global search — case-insensitive substring across all string/string[] fields
    if (globalSearch.trim()) {
      const q = globalSearch.toLowerCase().trim();
      result = result.filter((item) => {
        return Object.values(item).some((val) => {
          if (val === null || val === undefined) return false;
          if (Array.isArray(val)) {
            return val.some((v) => typeof v === "string" && v.toLowerCase().includes(q));
          }
          if (typeof val === "string") {
            return val.toLowerCase().includes(q);
          }
          return false;
        });
      });
    }

    // Layer 2: Facet filters — AND across different facet groups, OR within each group
    for (const [facetId, selectedValues] of Object.entries(selectedFacets)) {
      if (selectedValues.length === 0) continue;

      if (facetId === "charterType") {
        // Charter type: filter by label derived from document ID prefix
        result = result.filter((item) => {
          const ctLabel = getCharterTypeLabel(item.id, charterTypes);
          return ctLabel !== null && selectedValues.includes(ctLabel);
        });
      } else {
        // Regular facet: match against item field value(s) — OR logic
        result = result.filter((item) => {
          const fieldValue = item[facetId];
          if (fieldValue === undefined || fieldValue === null) return false;
          if (Array.isArray(fieldValue)) {
            return fieldValue.some((v) => selectedValues.includes(v));
          }
          return selectedValues.includes(fieldValue as string);
        });
      }
    }

    // Layer 3: Date range filter on dating_chronological
    const fromYear = dateRange.min || null;
    const toYear = dateRange.max || null;
    if (fromYear !== null || toYear !== null) {
      result = result.filter((item) => {
        const dateStr = item.dating_chronological;
        if (typeof dateStr !== "string" || !dateStr) return true;
        const year = extractYear(dateStr);
        if (year === null) return true;
        if (fromYear !== null && year < fromYear) return false;
        if (toYear !== null && year > toYear) return false;
        return true;
      });
    }

    // Layer 4: Price filter — show all, only with price, or only without price
    if (priceFilter !== null) {
      result = result.filter((item) => {
        const price = item.pretium;
        const hasPrice = typeof price === "string" && price.trim().length > 0;
        return priceFilter ? hasPrice : !hasPrice;
      });
    }

    return result;
  }, [data, globalSearch, selectedFacets, dateRange, priceFilter, charterTypes]);
}
