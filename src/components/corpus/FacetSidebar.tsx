"use client";

import { useState, useMemo } from "react";
import { Facets, CharterType, SelectedFacets, DateRange } from "@/types/corpus";
import DoubleRangeSlider from "./DoubleRangeSlider";

interface FacetSidebarProps {
  facets: Facets;
  charterTypes: CharterType[];
  selectedFacets: SelectedFacets;
  dateRange: DateRange;
  onFacetChange: (facetId: string, values: string[]) => void;
  onDateRangeChange: (range: DateRange) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onToggle: () => void;
  priceFilter: boolean | null;
  onPriceFilterChange: (value: boolean | null) => void;
}

/** Toggle a value in an array (add if missing, remove if present) */
function toggleValue(arr: string[], value: string): string[] {
  if (arr.includes(value)) return arr.filter((v) => v !== value);
  return [...arr, value];
}

/** Sort facet values by count descending, then alphabetically */
function sortFacetValues(values: { value: string; count: number }[]) {
  return [...values].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
}

const PEOPLE_SUBGROUPS = [
  { id: "author_name", label: "Author" },
  { id: "recipient_name", label: "Recipient" },
  { id: "notarius", label: "Notary" },
  { id: "testes_names", label: "Witnesses" },
];

const PLACE_SUBGROUPS = [
  { id: "locus_redactionis", label: "Place of Redaction" },
  { id: "property_location", label: "Property Location" },
  { id: "dating_topical", label: "Dating (Topical)" },
];

/** Collapsible accordion section for facet groups */
function FacetSection({
  title,
  icon,
  selectedCount,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: string;
  selectedCount: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 px-1 py-2 text-left transition-colors hover:bg-muted/50"
        aria-expanded={isOpen}
      >
        <span
          className={`text-xs text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : "rotate-0"}`}
        >
          ▶
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
        </span>
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {!isOpen && selectedCount > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {selectedCount}
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="pb-2">{children}</div>
      </div>
    </div>
  );
}

/** Render a group of clickable facet value rows */
function FacetCheckboxGroup({
  facetId,
  values,
  selectedValues,
  onFacetChange,
  showInfoIcon = false,
}: {
  facetId: string;
  values: { value: string; count: number }[];
  selectedValues: string[];
  onFacetChange: (facetId: string, values: string[]) => void;
  showInfoIcon?: boolean;
}) {
  const sorted = sortFacetValues(values);
  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((item) => {
        const isSelected = selectedValues.includes(item.value);
        return (
          <button
            key={item.value}
            onClick={() =>
              onFacetChange(facetId, toggleValue(selectedValues, item.value))
            }
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted ${
              isSelected ? "bg-primary/5" : ""
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                isSelected
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-background"
              }`}
            >
              {isSelected && "✓"}
            </span>
            <span className="flex-1 truncate text-foreground">{item.value}</span>
            <span className="text-xs text-muted-foreground">{item.count}</span>
            {showInfoIcon && (
              <span
                className="ml-1 text-xs text-muted-foreground/50"
                title="Entity details coming soon"
                aria-hidden="true"
              >
                ⓘ
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function FacetSidebar({
  facets,
  charterTypes,
  selectedFacets,
  dateRange,
  onFacetChange,
  onDateRangeChange,
  onClearAll,
  isOpen,
  onToggle,
  priceFilter,
  onPriceFilterChange,
}: FacetSidebarProps) {
  // Filter text for People section (many entities benefit from inline search)
  const [peopleFilterText, setPeopleFilterText] = useState("");

  // Compute slider bounds from dating_chronological facet values
  // MUST be before any conditional returns (React hooks rule)
  const { sliderMin, sliderMax, hasDates } = useMemo(() => {
    const dateFacet = facets["dating_chronological"] ?? [];
    if (dateFacet.length === 0)
      return { sliderMin: 0, sliderMax: 0, hasDates: false };
    const years = dateFacet
      .map((v) => {
        const match = v.value.match(/\d{4}/);
        return match ? parseInt(match[0], 10) : null;
      })
      .filter((y): y is number => y !== null);
    if (years.length === 0)
      return { sliderMin: 0, sliderMax: 0, hasDates: false };
    return {
      sliderMin: Math.min(...years),
      sliderMax: Math.max(...years),
      hasDates: true,
    };
  }, [facets]);

  /** Count selected values across a list of facet IDs */
  function countSelected(facetIds: string[]): number {
    return facetIds.reduce(
      (sum, id) => sum + (selectedFacets[id]?.length ?? 0),
      0,
    );
  }

  const peopleSelectedCount = countSelected(
    PEOPLE_SUBGROUPS.map((s) => s.id),
  );
  const placesSelectedCount = countSelected(
    PLACE_SUBGROUPS.map((s) => s.id),
  );
  const dateSelectedCount =
    hasDates && (dateRange.min > 0 || dateRange.max > 0) ? 1 : 0;

  // When closed, show only the toggle button
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-r-md border border-l-0 border-border bg-background px-2 py-3 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-muted"
        title="Open filters"
      >
        <span>☰</span>
        <span className="hidden sm:inline">Filters</span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className="rounded p-1 text-foreground transition-colors hover:bg-muted"
            title="Close filters"
          >
            ✕
          </button>
          <span className="text-sm font-semibold text-primary">Filters</span>
        </div>
        <button
          onClick={onClearAll}
          className="rounded px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-muted"
        >
          Clear all
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Charter Type */}
        <FacetSection
          title="Charter Type"
          icon="📋"
          selectedCount={selectedFacets["charterType"]?.length ?? 0}
        >
          <div className="px-2">
            <FacetCheckboxGroup
              facetId="charterType"
              values={charterTypes.map((ct) => ({
                value: ct.label,
                count: ct.count,
              }))}
              selectedValues={selectedFacets["charterType"] ?? []}
              onFacetChange={onFacetChange}
            />
          </div>
        </FacetSection>

        {/* People */}
        <FacetSection
          title="People"
          icon="👤"
          selectedCount={peopleSelectedCount}
        >
          {/* Inline name filter for People — helps when there are many entities */}
          <div className="px-2 pb-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by name…"
                value={peopleFilterText}
                onChange={(e) => setPeopleFilterText(e.target.value)}
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
              />
              {peopleFilterText && (
                <button
                  onClick={() => setPeopleFilterText("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear name filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          {PEOPLE_SUBGROUPS.map((sg) => {
            let values = facets[sg.id];
            if (!values || values.length === 0) return null;

            // Filter by peopleFilterText (case-insensitive substring match)
            if (peopleFilterText.trim()) {
              const q = peopleFilterText.toLowerCase().trim();
              values = values.filter((v) => v.value.toLowerCase().includes(q));
              if (values.length === 0) return null; // hide subgroup if no matches
            }

            return (
              <div key={sg.id}>
                <span className="mt-2 mb-0.5 block px-2 text-xs font-medium text-secondary">
                  {sg.label}{" "}
                  {peopleFilterText.trim() && (
                    <span className="font-normal text-muted-foreground">
                      ({values.length})
                    </span>
                  )}
                </span>
                <div className="px-2">
                  <FacetCheckboxGroup
                    facetId={sg.id}
                    values={values}
                    selectedValues={selectedFacets[sg.id] ?? []}
                    onFacetChange={onFacetChange}
                    showInfoIcon={true}
                  />
                </div>
              </div>
            );
          })}
        </FacetSection>

        {/* Places */}
        <FacetSection
          title="Places"
          icon="📍"
          selectedCount={placesSelectedCount}
        >
          {PLACE_SUBGROUPS.map((sg) => {
            const values = facets[sg.id];
            if (!values || values.length === 0) return null;
            return (
              <div key={sg.id}>
                <span className="mt-2 mb-0.5 block px-2 text-xs font-medium text-secondary">
                  {sg.label}
                </span>
                <div className="px-2">
                  <FacetCheckboxGroup
                    facetId={sg.id}
                    values={values}
                    selectedValues={selectedFacets[sg.id] ?? []}
                    onFacetChange={onFacetChange}
                  />
                </div>
              </div>
            );
          })}
        </FacetSection>

        {/* Date */}
        <FacetSection
          title="Date"
          icon="📅"
          selectedCount={dateSelectedCount}
        >
          {hasDates ? (
            <div className="px-2 pb-2">
              <DoubleRangeSlider
                min={sliderMin}
                max={sliderMax}
                valueMin={dateRange.min || sliderMin}
                valueMax={dateRange.max || sliderMax}
                onChange={(newMin, newMax) =>
                  onDateRangeChange({ min: newMin, max: newMax })
                }
              />
            </div>
          ) : (
            <div className="px-2 pb-2">
              <DoubleRangeSlider
                min={0}
                max={0}
                valueMin={0}
                valueMax={0}
                onChange={() => {}}
                disabled
                placeholder="No date data available in corpus"
              />
            </div>
          )}
        </FacetSection>

        {/* Price */}
        <FacetSection
          title="Price"
          icon="💰"
          selectedCount={priceFilter !== null ? 1 : 0}
        >
          <div className="px-2 pb-1">
            {([
              { label: "Has price", value: true as const },
              { label: "No price", value: false as const },
            ]).map(({ label, value }) => {
              const isSelected = priceFilter === value;
              return (
                <button
                  key={label}
                  onClick={() =>
                    onPriceFilterChange(isSelected ? null : value)
                  }
                  className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-xs transition-colors ${
                      isSelected
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-background"
                    }`}
                  >
                    {isSelected && "✓"}
                  </span>
                  <span className="text-foreground">{label}</span>
                </button>
              );
            })}
          </div>
        </FacetSection>

        {/* Archive */}
        <FacetSection
          title="Archive"
          icon="🏛️"
          selectedCount={selectedFacets["repository"]?.length ?? 0}
        >
          <div className="px-2">
            {facets["repository"] && facets["repository"].length > 0 && (
              <FacetCheckboxGroup
                facetId="repository"
                values={facets["repository"]}
                selectedValues={selectedFacets["repository"] ?? []}
                onFacetChange={onFacetChange}
              />
            )}
          </div>
        </FacetSection>
      </div>
    </div>
  );
}
