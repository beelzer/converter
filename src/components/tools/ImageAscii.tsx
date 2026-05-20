import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import FileDropZone from "../shared/FileDropZone";
import type { Status } from "../shared/Widgets";
import { downloadBlob, formatSize } from "../../lib/util/file";
import { stripExt } from "../../lib/util/filename";
import { copyText } from "../../lib/util/clipboard";
import { MIME } from "../../lib/util/mime";
import {
  decodedToAsciiGrid,
  defaultOptions,
  gridToAnsi,
  gridToHtml,
  gridToHtmlDocument,
  gridToPng,
  type AsciiCharset,
  type AsciiColor,
  type AsciiOptions,
  type AsciiResult,
} from "../../lib/image/ascii";
import { decodeImage, type DecodedImage } from "../../lib/image/decode";
import { ACCEPT_INPUT } from "../../lib/image/formats";

interface LoadedFile {
  file: File;
  decoded: DecodedImage;
}

const CHARSET_OPTIONS: { id: AsciiCharset; label: string; hint: string }[] = [
  { id: "gradient", label: "Gradient", hint: ".:-=+*#%@" },
  { id: "dense", label: "Dense", hint: "70-char ramp" },
  { id: "blocks", label: "Blocks", hint: "░▒▓█" },
  { id: "braille", label: "Braille", hint: "2×4 sub-pixels per cell — hi-res" },
  { id: "custom", label: "Custom", hint: "your charset, light → dark" },
];

const WIDTH_PRESETS = [60, 80, 100, 140, 200];

export default function ImageAscii() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [options, setOptions] = useState<AsciiOptions>(() => defaultOptions());
  const [result, setResult] = useState<AsciiResult | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState<string | null>(null);
  const previewRef = useRef<HTMLPreElement | null>(null);
  const runId = useRef(0);

  const accept = useCallback(async (incoming: FileList | File[]) => {
    const first = Array.from(incoming)[0];
    if (!first) return;
    setStatus({ kind: "working", label: "Decoding" });
    try {
      const decoded = await decodeImage(first);
      setFile({ file: first, decoded });
      setStatus({ kind: "idle" });
    } catch (err) {
      setFile(null);
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const clear = () => {
    setFile(null);
    setResult(null);
    setStatus({ kind: "idle" });
  };

  // Re-render the grid whenever inputs change. The PNG/HTML/ANSI exports are
  // derived on-demand from the same grid, so we cache only the grid here.
  useEffect(() => {
    if (!file) {
      setResult(null);
      return;
    }
    const id = ++runId.current;
    let cancelled = false;
    (async () => {
      try {
        const grid = await decodedToAsciiGrid(
          file.decoded.source,
          file.decoded.width,
          file.decoded.height,
          options
        );
        if (cancelled || id !== runId.current) return;
        setResult(grid);
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, options]);

  const updateOption = <K extends keyof AsciiOptions>(key: K, value: AsciiOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const flash = (label: string) => {
    setCopied(label);
    setTimeout(() => setCopied(null), 1200);
  };

  const onCopyText = async () => {
    if (!result) return;
    if (await copyText(result.text)) flash("text");
  };
  const onCopyAnsi = async () => {
    if (!result) return;
    if (await copyText(gridToAnsi(result))) flash("ansi");
  };
  const onCopyHtml = async () => {
    if (!result) return;
    if (await copyText(gridToHtml(result, options))) flash("html");
  };

  const baseName = file ? stripExt(file.file.name) || "ascii" : "ascii";

  const onDownloadText = () => {
    if (!result) return;
    downloadBlob(new Blob([result.text], { type: MIME.TEXT_PLAIN }), `${baseName}.txt`, MIME.TEXT_PLAIN);
  };
  const onDownloadHtml = () => {
    if (!result) return;
    const html = gridToHtmlDocument(result, options);
    downloadBlob(new Blob([html], { type: MIME.TEXT_HTML }), `${baseName}.html`, MIME.TEXT_HTML);
  };
  const onDownloadAnsi = () => {
    if (!result) return;
    downloadBlob(
      new Blob([gridToAnsi(result)], { type: MIME.TEXT_PLAIN }),
      `${baseName}.ans`,
      MIME.TEXT_PLAIN
    );
  };
  const onDownloadPng = async () => {
    if (!result) return;
    setStatus({ kind: "working", label: "Rendering PNG" });
    try {
      const blob = await gridToPng(result, options);
      downloadBlob(blob, `${baseName}.png`, "image/png");
      setStatus({ kind: "done" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const busy = status.kind === "working";

  // Preview rendering: paint the grid into the <pre>. For colour mode we build
  // an HTML body of per-cell spans; otherwise the plain text suffices.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || !result) return;
    if (result.colors) {
      el.innerHTML = gridToHtmlBody(result);
    } else {
      el.textContent = result.text;
    }
  }, [result, options.color, options.background, options.foreground]);

  return (
    <div class="w-full">
      <FileDropZone
        label={file ? "Drop a different image to replace" : "Drop an image here"}
        buttonLabel="Choose image"
        accept={ACCEPT_INPUT}
        inputAriaLabel="Choose an image to convert to ASCII art"
        onFiles={accept}
        subtitleHint="JPG · PNG · WebP · AVIF · GIF · BMP · TIFF · HEIC"
      />

      {file && (
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
              Source
            </h3>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              class="font-mono text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] disabled:opacity-50"
            >
              clear
            </button>
          </div>
          <div class="flex items-center gap-3 p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
            <span class="flex-1 truncate text-sm text-[var(--color-fg)]">
              {file.file.name}
            </span>
            <span class="font-mono text-xs text-[var(--color-fg-dim)] hidden sm:inline">
              {file.decoded.width}×{file.decoded.height} · {formatSize(file.file.size)}
            </span>
          </div>

          <fieldset class="mt-6">
            <legend class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Charset
            </legend>
            <div class="flex flex-wrap gap-2">
              {CHARSET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateOption("charset", opt.id)}
                  aria-pressed={options.charset === opt.id}
                  title={opt.hint}
                  class={`font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
                    options.charset === opt.id
                      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          {options.charset === "custom" && (
            <div class="mt-4">
              <label
                htmlFor="ascii-ramp"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Custom ramp (light → dark)
              </label>
              <input
                id="ascii-ramp"
                type="text"
                value={options.customRamp ?? ""}
                onInput={(e) =>
                  updateOption("customRamp", (e.currentTarget as HTMLInputElement).value)
                }
                placeholder=" .:-=+*#%@"
                spellcheck={false}
                autocomplete="off"
                class="w-full font-mono text-base px-3 py-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)]"
              />
            </div>
          )}

          <div class="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ascii-width"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Output width — {options.outputWidth} chars
              </label>
              <input
                id="ascii-width"
                type="range"
                min={20}
                max={300}
                step={1}
                value={options.outputWidth}
                onInput={(e) =>
                  updateOption(
                    "outputWidth",
                    parseInt((e.currentTarget as HTMLInputElement).value, 10)
                  )
                }
                class="w-full accent-[var(--color-accent)]"
              />
              <div class="mt-2 flex flex-wrap gap-2">
                {WIDTH_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => updateOption("outputWidth", w)}
                    class={`font-mono text-xs px-2 py-1 rounded-sm border transition-colors ${
                      options.outputWidth === w
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
                Style
              </span>
              <div class="flex flex-wrap gap-2 mb-2">
                {(["mono", "color"] as AsciiColor[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateOption("color", c)}
                    aria-pressed={options.color === c}
                    class={`font-mono text-sm px-3 py-1.5 rounded-md border transition-colors ${
                      options.color === c
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-fg-muted)]"
                    }`}
                  >
                    {c === "mono" ? "Mono" : "24-bit color"}
                  </button>
                ))}
              </div>
              <label class="inline-flex items-center gap-2 font-mono text-sm text-[var(--color-fg-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={(e) =>
                    updateOption("invert", (e.currentTarget as HTMLInputElement).checked)
                  }
                  class="accent-[var(--color-accent)]"
                />
                Invert (for light backgrounds)
              </label>
            </div>
          </div>

          <div class="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ascii-bg"
                class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
              >
                Background
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="ascii-bg"
                  type="color"
                  value={options.background}
                  onInput={(e) =>
                    updateOption("background", (e.currentTarget as HTMLInputElement).value)
                  }
                  class="h-10 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer"
                />
                <code class="font-mono text-sm text-[var(--color-fg-muted)]">
                  {options.background}
                </code>
              </div>
            </div>
            {options.color === "mono" && (
              <div>
                <label
                  htmlFor="ascii-fg"
                  class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
                >
                  Foreground
                </label>
                <div class="flex items-center gap-2">
                  <input
                    id="ascii-fg"
                    type="color"
                    value={options.foreground}
                    onInput={(e) =>
                      updateOption("foreground", (e.currentTarget as HTMLInputElement).value)
                    }
                    class="h-10 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer"
                  />
                  <code class="font-mono text-sm text-[var(--color-fg-muted)]">
                    {options.foreground}
                  </code>
                </div>
              </div>
            )}
          </div>

          <div class="mt-8">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]">
                Preview
              </h3>
              <span class="font-mono text-xs text-[var(--color-fg-dim)]">
                {result ? `${result.cols} × ${result.rows} chars` : ""}
              </span>
            </div>
            <div
              class="rounded-md border border-[var(--color-border)] overflow-auto max-h-[28rem]"
              style={{ background: options.background }}
            >
              <pre
                ref={previewRef}
                class="font-mono text-[10px] leading-[1] m-0 p-3"
                style={{
                  color: options.color === "mono" ? options.foreground : undefined,
                  whiteSpace: "pre",
                }}
              />
            </div>
          </div>

          <div class="mt-6">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Copy
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCopyText}
                disabled={!result}
                class={btnClass(copied === "text")}
              >
                {copied === "text" ? "copied" : "copy text"}
              </button>
              <button
                type="button"
                onClick={onCopyHtml}
                disabled={!result}
                class={btnClass(copied === "html")}
              >
                {copied === "html" ? "copied" : "copy HTML"}
              </button>
              <button
                type="button"
                onClick={onCopyAnsi}
                disabled={!result}
                class={btnClass(copied === "ansi")}
              >
                {copied === "ansi" ? "copied" : "copy ANSI"}
              </button>
            </div>
          </div>

          <div class="mt-6">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Download
            </h3>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onDownloadText}
                disabled={!result || busy}
                class={btnClass(false)}
              >
                .txt
              </button>
              <button
                type="button"
                onClick={onDownloadHtml}
                disabled={!result || busy}
                class={btnClass(false)}
              >
                .html
              </button>
              <button
                type="button"
                onClick={onDownloadAnsi}
                disabled={!result || busy}
                class={btnClass(false)}
              >
                .ans
              </button>
              <button
                type="button"
                onClick={onDownloadPng}
                disabled={!result || busy}
                class="font-mono text-sm px-4 py-2 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
              >
                .png
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="mt-4 min-h-[1.5rem] font-mono text-sm"
      >
        {status.kind === "working" && (
          <span class="text-[var(--color-accent)]">{status.label}…</span>
        )}
        {status.kind === "error" && (
          <span class="text-[var(--color-danger)]">Error: {status.message}</span>
        )}
      </div>
    </div>
  );
}

function btnClass(active: boolean): string {
  return `font-mono text-sm px-4 py-2 rounded-md border transition-colors ${
    active
      ? "border-[var(--color-accent)] text-[var(--color-accent)]"
      : "border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
  } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[var(--color-border)] disabled:hover:text-[var(--color-fg)]`;
}

// Smaller, preview-only variant of gridToHtml — no <pre> wrapper, no padding.
// We let the outer <pre> in the component own font + scroll so the preview
// stays styled by the surrounding theme.
function gridToHtmlBody(result: AsciiResult): string {
  if (!result.colors) return "";
  const lines = result.text.split("\n");
  let body = "";
  for (let r = 0; r < lines.length; r++) {
    const line = lines[r];
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      const color = result.colors[r * result.cols + c];
      const safe =
        ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
      body += `<span style="color:${color}">${safe}</span>`;
    }
    if (r < lines.length - 1) body += "\n";
  }
  return body;
}
