import { useState } from "preact/hooks";
import { downloadBlob } from "../../lib/util/file";
import { htmlToMarkdown } from "../../lib/document/markdown";

export default function DocHtml() {
  const [html, setHtml] = useState("");
  const [md, setMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file) setHtml(await file.text());
    target.value = "";
  };

  const convert = async () => {
    if (!html.trim()) {
      setError("Paste or load some HTML first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setMd(await htmlToMarkdown(html));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadMd = () =>
    downloadBlob(new Blob([md], { type: "text/markdown" }), "document.md", "text/markdown");

  const printPdf = () => {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>document</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:48rem;margin:1rem auto;padding:0 1rem;line-height:1.5;color:#222}pre{background:#f4f4f4;padding:1rem;overflow:auto;border-radius:6px}code{font-family:ui-monospace,monospace}img{max-width:100%}@media print{body{margin:0}}</style>
</head><body>${html}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200))</script></body></html>`;
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <label
          htmlFor="html-source"
          class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]"
        >
          HTML
        </label>
        <label class="font-mono text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-accent)] cursor-pointer">
          pick an .html file
          <input
            type="file"
            accept=".html,.htm,text/html"
            onChange={onFile}
            class="sr-only"
            aria-label="Pick an HTML file"
          />
        </label>
      </div>
      <textarea
        id="html-source"
        value={html}
        rows={10}
        onInput={(e) => setHtml((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        placeholder="<h1>Hello</h1><p>Paste or drop HTML here.</p>"
        aria-label="HTML source"
        class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
      />

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={convert}
          disabled={busy || !html.trim()}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] transition-colors"
        >
          {busy ? "Converting…" : "Convert to Markdown"}
        </button>
        <button
          type="button"
          onClick={printPdf}
          disabled={!html.trim()}
          class="font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
        >
          Print → Save as PDF
        </button>
      </div>

      {md && (
        <div class="mt-6">
          <label class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            Markdown
          </label>
          <div class="rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
            <textarea
              value={md}
              readOnly
              rows={10}
              aria-label="Markdown output"
              class="block w-full bg-transparent p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none resize-y"
              spellcheck={false}
            />
            <div class="flex items-center justify-between px-3 py-2 border-t border-[var(--color-border)] text-xs font-mono text-[var(--color-fg-dim)]">
              <button
                type="button"
                onClick={downloadMd}
                class="hover:text-[var(--color-accent)]"
              >
                download .md
              </button>
              <span>{md.length.toLocaleString()} chars</span>
            </div>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
