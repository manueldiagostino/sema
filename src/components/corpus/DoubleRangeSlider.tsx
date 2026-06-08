"use client";

import type { ChangeEvent } from "react";

interface DoubleRangeSliderProps {
  min: number;
  max: number;
  valueMin: number;
  valueMax: number;
  onChange: (min: number, max: number) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function DoubleRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  disabled,
  placeholder,
}: DoubleRangeSliderProps) {
  if (disabled) {
    return (
      <div
        role="group"
        aria-label="Date range slider"
        aria-disabled="true"
        className="px-1 py-2"
      >
        <div className="rounded border border-border bg-muted/50 px-3 py-4 text-center text-sm text-muted-foreground">
          {placeholder ?? "No date data available"}
        </div>
      </div>
    );
  }

  const range = max - min || 1;

  function handleMinChange(e: ChangeEvent<HTMLInputElement>) {
    const newValue = Number(e.target.value);
    const clamped = Math.min(newValue, valueMax);
    onChange(clamped, valueMax);
  }

  function handleMaxChange(e: ChangeEvent<HTMLInputElement>) {
    const newValue = Number(e.target.value);
    const clamped = Math.max(newValue, valueMin);
    onChange(valueMin, clamped);
  }

  const leftPercent = ((valueMin - min) / range) * 100;
  const widthPercent = ((valueMax - valueMin) / range) * 100;

  return (
    <div
      role="group"
      aria-label="Date range slider"
      className="relative px-1 pt-6 pb-4"
    >
      {/* Thumb styles — injected via <style> for reliable pseudo-element support */}
      <style>{`
        .ds-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          pointer-events: auto;
          height: 1.25rem;
          width: 1.25rem;
          border-radius: 9999px;
          border: 2px solid var(--accent);
          background: var(--background);
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
          cursor: pointer;
        }
        .ds-input::-moz-range-thumb {
          appearance: none;
          pointer-events: auto;
          height: 1.25rem;
          width: 1.25rem;
          border-radius: 9999px;
          border: 2px solid var(--accent);
          background: var(--background);
          box-shadow: 0 1px 2px rgba(0,0,0,0.15);
          cursor: pointer;
        }
      `}</style>

      {/* Year labels above the slider */}
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>{valueMin}</span>
        <span>{valueMax}</span>
      </div>

      {/* Slider track area */}
      <div className="relative h-6">
        {/* Track background (full width) */}
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded bg-border" />

        {/* Active track fill (between handles) */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-accent"
          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
        />

        {/* Minimum handle (from) */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMin}
          onChange={handleMinChange}
          aria-label="Minimum year"
          className="ds-input pointer-events-none absolute top-0 h-full w-full appearance-none bg-transparent"
          style={{ zIndex: valueMin > max - 1 ? 5 : 3 }}
        />

        {/* Maximum handle (to) */}
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={valueMax}
          onChange={handleMaxChange}
          aria-label="Maximum year"
          className="ds-input pointer-events-none absolute top-0 h-full w-full appearance-none bg-transparent"
          style={{ zIndex: 4 }}
        />
      </div>

      {/* Min/max bounds labels below the slider */}
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
