import { useEffect, useState } from "preact/hooks";
import { downloadBlob } from "../../lib/util/file";
import { markdownToHtml } from "../../lib/document/markdown";
import {
  buildDownloadHtml,
  buildPreviewSrcDoc,
  openPrintWindow,
} from "../../lib/document/printStylesheet";
import { MIME } from "../../lib/util/mime";

const DEFAULT_MD = `# Hello, Markdown

This is a **live** preview. Edit the textarea on the left.

- It auto-converts to HTML.
- You can download either format.

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

export default function DocMarkdown() {
  const [md, setMd] = useState(DEFAULT_MD);
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const out = await markdownToHtml(md);
        if (!cancelled) {
          setHtml(out);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [md]);

  const onFile = async (e: Event) => {
    const target = e.currentTarget as HTMLInputElement;
    const file = target.files?.[0];
    if (file) setMd(await file.text());
    target.value = "";
  };

  const downloadMd = () =>
    downloadBlob(new Blob([md], { type: MIME.TEXT_MARKDOWN }), "document.md", MIME.TEXT_MARKDOWN);
  const downloadHtml = () =>
    downloadBlob(
      new Blob([buildDownloadHtml(html)], { type: MIME.TEXT_HTML }),
      "document.html",
      MIME.TEXT_HTML
    );
  const printPdf = () => openPrintWindow(html);

  return (
    <div class="w-full">
      <div class="grid gap-4 lg:grid-cols-2">
        <div>
          <div class="flex items-center justify-between mb-2">
            <label
              htmlFor="md-source"
              class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)]"
            >
              Markdown
            </label>
            <label class="font-mono text-xs text-[var(--color-fg-dim)] hover:text-[var(--color-accent)] cursor-pointer">
              pick a .md file
              <input
                type="file"
                accept=".md,text/markdown"
                onChange={onFile}
                class="sr-only"
                aria-label="Pick a Markdown file"
              />
            </label>
          </div>
          <textarea
            id="md-source"
            value={md}
            rows={18}
            onInput={(e) => setMd((e.currentTarget as HTMLTextAreaElement).value)}
            spellcheck={false}
            autocomplete="off"
            aria-label="Markdown source"
            class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
          />
        </div>
        <div>
          <span class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2 block">
            Preview
          </span>
          <iframe
            srcdoc={buildPreviewSrcDoc(html)}
            sandbox=""
            title="Markdown preview"
            class="block w-full h-[28rem] rounded-md border-2 border-[var(--color-border)] bg-white"
          />
        </div>
      </div>

      <div class="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={downloadMd}
          disabled={!md}
          class="font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
        >
          Download .md
        </button>
        <button
          type="button"
          onClick={downloadHtml}
          disabled={!html}
          class="font-mono text-sm px-4 py-2 rounded-md border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-50"
        >
          Download .html
        </button>
        <button
          type="button"
          onClick={printPdf}
          disabled={!html}
          class="font-mono text-sm px-4 py-2 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] transition-colors"
        >
          Print → Save as PDF
        </button>
      </div>

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}
