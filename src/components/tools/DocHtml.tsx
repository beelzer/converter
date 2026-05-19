import { useState } from "preact/hooks";
import OutputPanel from "../shared/OutputPanel";
import FilePickButton from "../shared/FilePickButton";
import { htmlToMarkdown } from "../../lib/document/markdown";
import { openPrintWindow } from "../../lib/document/printStylesheet";
import { MIME } from "../../lib/util/mime";

export default function DocHtml() {
  const [html, setHtml] = useState("");
  const [md, setMd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  const printPdf = () => openPrintWindow(html);

  return (
    <div class="w-full">
      <div class="flex items-center justify-between mb-2">
        <label
          htmlFor="html-source"
          class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]"
        >
          HTML
        </label>
        <FilePickButton
          onFile={async (f) => setHtml(await f.text())}
          accept=".html,.htm,text/html"
          label="pick an .html file"
          ariaLabel="Pick an HTML file"
        />
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
          <OutputPanel
            value={md}
            ariaLabel="Markdown output"
            label="Markdown"
            rows={10}
            filename="document.md"
            mime={MIME.TEXT_MARKDOWN}
          />
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
