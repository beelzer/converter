// Generic product-hub tab bar. Every *Hub.tsx file used to repeat the same
// ~70-line `<div role="tablist">` markup; they now render this and pass in
// their MODES + panels.

import { useState } from "preact/hooks";
import type { ComponentChildren, VNode } from "preact";

export interface ModeSpec<TMode extends string> {
  id: TMode;
  label: string;
  blurb: string;
}

interface HubProps<TMode extends string> {
  modes: readonly ModeSpec<TMode>[];
  initial: TMode;
  ariaLabel: string;
  panels: Record<TMode, VNode | (() => ComponentChildren)>;
}

export function Hub<TMode extends string>({
  modes,
  initial,
  ariaLabel,
  panels,
}: HubProps<TMode>) {
  const [mode, setMode] = useState<TMode>(initial);
  const active = modes.find((m) => m.id === mode) ?? modes[0];
  const panel = panels[mode];
  const rendered = typeof panel === "function" ? panel() : panel;

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label={ariaLabel}
        class="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3 mb-4"
      >
        {modes.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${m.id}`}
              id={`tab-${m.id}`}
              onClick={() => setMode(m.id)}
              class={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors ${
                isActive
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-surface)]"
                  : "border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border)]"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p class="font-mono text-xs text-[var(--color-fg-dim)] mb-6">{active.blurb}</p>

      {/* `key={mode}` ensures each panel's state resets cleanly on tab change.*/}
      <div
        role="tabpanel"
        id={`panel-${mode}`}
        aria-labelledby={`tab-${mode}`}
        key={mode}
      >
        {rendered}
      </div>
    </div>
  );
}
