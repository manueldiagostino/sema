/**
 * A single corpus item row, keyed by column config IDs.
 * Values are strings (single-valued) or string arrays (multi-valued).
 */
export type CorpusItem = Record<string, string | string[]> & { id: string };
export type CompareLayout = "stacked" | "side-by-side";

export interface ColumnConfig {
  id: string;
  label: string;
  xpath: string;
  attribute?: string;
  sortable: boolean;
  filterable: boolean;
  cardinality: "single" | "multiple";
  join: string;
  truncateWords?: number;
}

export interface FacetValue {
  value: string;
  count: number;
}

/** Map from column/facet ID to its distinct values with counts */
export type Facets = Record<string, FacetValue[]>;

export interface CharterType {
  id: string;
  label: string;
  count: number;
}

export interface CorpusMetadata {
  columns: ColumnConfig[];
  items: CorpusItem[];
  facets: Facets;
  charterTypes: CharterType[];
}

/** Selected values per facet group, keyed by facet/column ID */
export type SelectedFacets = Record<string, string[]>;

export interface DateRange {
  min: number;
  max: number;
}
