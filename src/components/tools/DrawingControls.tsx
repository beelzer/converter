// Shared plot-dialog controls used by the three "Convert to X" panels. Page
// size + orientation are PDF-only; the rest (color mode, layer toggles,
// layout picker) are universal across PDF / SVG / PNG outputs.

import { Fieldset, Pills } from "../shared/Widgets";
import {
  COLOR_MODES,
  COLOR_MODE_LABEL,
  ORIENTATIONS,
  ORIENTATION_LABEL,
  PAGE_SIZES,
  PAGE_SIZE_LABEL,
  type ColorMode,
  type Orientation,
  type PageSize,
} from "../../lib/drawing/formats";
import type { LayerInfo, LayoutInfo } from "../../lib/drawing/analyze";

interface ControlsProps {
  // PDF-specific knobs — hidden for raster / passthrough outputs.
  showPageOptions: boolean;
  pageSize: PageSize;
  onPageSize: (v: PageSize) => void;
  orientation: Orientation;
  onOrientation: (v: Orientation) => void;
  // Universal.
  colorMode: ColorMode;
  onColorMode: (v: ColorMode) => void;
  layers: LayerInfo[];
  frozenLayers: ReadonlySet<string>;
  onLayerToggle: (name: string, frozen: boolean) => void;
  layouts: LayoutInfo[];
  selectedLayout: string | null;
  onSelectLayout: (blockName: string | null) => void;
  disabled?: boolean;
}

export default function DrawingControls(props: ControlsProps) {
  const usableLayers = props.layers.filter((l) => l.used);

  return (
    <div>
      {props.showPageOptions && (
        <>
          <Fieldset legend="Page size">
            <Pills
              options={PAGE_SIZES}
              value={props.pageSize}
              onChange={props.onPageSize}
              label={(p) => PAGE_SIZE_LABEL[p]}
              disabled={props.disabled}
            />
          </Fieldset>

          <Fieldset legend="Orientation">
            <Pills
              options={ORIENTATIONS}
              value={props.orientation}
              onChange={props.onOrientation}
              label={(o) => ORIENTATION_LABEL[o]}
              disabled={props.disabled}
            />
          </Fieldset>
        </>
      )}

      <Fieldset legend="Color mode">
        <Pills
          options={COLOR_MODES}
          value={props.colorMode}
          onChange={props.onColorMode}
          label={(c) => COLOR_MODE_LABEL[c]}
          disabled={props.disabled}
        />
      </Fieldset>

      {props.layouts.length > 1 && (
        <Fieldset legend="Layout">
          <div class="flex flex-wrap gap-2">
            {props.layouts.map((layout) => {
              const isActive = layout.isModelSpace
                ? props.selectedLayout === null
                : props.selectedLayout === layout.blockName;
              return (
                <button
                  key={layout.blockName}
                  type="button"
                  aria-pressed={isActive}
                  disabled={props.disabled}
                  onClick={() =>
                    props.onSelectLayout(layout.isModelSpace ? null : layout.blockName)
                  }
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    isActive
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {layout.name}
                </button>
              );
            })}
          </div>
        </Fieldset>
      )}

      {usableLayers.length > 0 && (
        <Fieldset legend={`Layers (${usableLayers.length})`}>
          <div class="grid gap-1 sm:grid-cols-2 max-h-56 overflow-y-auto pr-2">
            {usableLayers.map((layer) => {
              const checked = !props.frozenLayers.has(layer.name);
              return (
                <label
                  key={layer.name}
                  class="flex items-center gap-2 font-mono text-xs text-[var(--color-fg)] py-1 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={props.disabled}
                    onChange={(e) =>
                      props.onLayerToggle(
                        layer.name,
                        !(e.currentTarget as HTMLInputElement).checked
                      )
                    }
                    aria-label={`Toggle visibility of layer ${layer.name}`}
                    class="accent-[var(--color-accent)]"
                  />
                  <span
                    aria-hidden="true"
                    class="inline-block w-3 h-3 rounded-sm border border-[var(--color-border)]"
                    style={`background-color: ${layerSwatch(layer.colorIndex)}`}
                  />
                  <span class="truncate">{layer.name}</span>
                </label>
              );
            })}
          </div>
        </Fieldset>
      )}
    </div>
  );
}

// Minimal AutoCAD Color Index → CSS swatch mapping. Just enough so the UI
// looks distinct per layer; the actual rendering uses the renderer's own
// color logic so we don't need full ACI fidelity here.
function layerSwatch(colorIndex: number): string {
  switch (colorIndex) {
    case 1:
      return "#ff0000";
    case 2:
      return "#ffff00";
    case 3:
      return "#00ff00";
    case 4:
      return "#00ffff";
    case 5:
      return "#0000ff";
    case 6:
      return "#ff00ff";
    case 7:
    case 256:
      return "#ffffff";
    case 8:
      return "#808080";
    case 9:
      return "#c0c0c0";
    default:
      return "#aaaaaa";
  }
}
