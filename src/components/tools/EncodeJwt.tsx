import { useState } from "preact/hooks";
import { decodeJwt, summariseClaims, type JwtParts } from "../../lib/encode/jwt";

export default function EncodeJwt() {
  const [input, setInput] = useState("");
  const [decoded, setDecoded] = useState<JwtParts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDecode = () => {
    setDecoded(null);
    setError(null);
    if (!input.trim()) {
      setError("Paste a JWT to inspect.");
      return;
    }
    try {
      setDecoded(decodeJwt(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const summary = decoded ? summariseClaims(decoded.payload) : null;

  return (
    <div class="w-full">
      <label
        htmlFor="jwt-input"
        class="block font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2"
      >
        JWT
      </label>
      <textarea
        id="jwt-input"
        value={input}
        rows={5}
        onInput={(e) => setInput((e.currentTarget as HTMLTextAreaElement).value)}
        spellcheck={false}
        autocomplete="off"
        placeholder="eyJhbGciOi…"
        aria-label="JWT to decode"
        class="block w-full rounded-md border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-sm text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] resize-y"
      />

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onDecode}
          disabled={!input.trim()}
          class="font-mono text-sm px-5 py-2.5 rounded-md bg-[var(--color-accent)] text-[var(--color-bg)] font-semibold hover:bg-[var(--color-accent-hover)] disabled:bg-[var(--color-fg-dim)] disabled:cursor-not-allowed transition-colors"
        >
          Decode
        </button>
        <p class="font-mono text-xs text-[var(--color-fg-dim)]">
          The signature is not verified — this is a viewer, not an auth check.
        </p>
      </div>

      {decoded && (
        <div class="mt-6 grid gap-4 lg:grid-cols-2">
          <JsonPanel title="Header" value={decoded.header} />
          <JsonPanel title="Payload" value={decoded.payload} />
          <div class="lg:col-span-2">
            <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
              Signature
            </h3>
            <code class="block p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-xs text-[var(--color-fg)] break-all">
              {decoded.signature || "(empty)"}
            </code>
          </div>
        </div>
      )}

      {summary && Object.keys(summary).length > 0 && (
        <div class="mt-6">
          <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
            Standard claims
          </h3>
          <ul class="space-y-1">
            {summary.iss && (
              <ClaimRow label="iss (issuer)" value={summary.iss} />
            )}
            {summary.sub && (
              <ClaimRow label="sub (subject)" value={summary.sub} />
            )}
            {summary.aud && (
              <ClaimRow
                label="aud (audience)"
                value={Array.isArray(summary.aud) ? summary.aud.join(", ") : summary.aud}
              />
            )}
            {summary.iat && (
              <ClaimRow label="iat (issued at)" value={`${summary.iat.iso} (${summary.iat.ts})`} />
            )}
            {summary.nbf && (
              <ClaimRow label="nbf (not before)" value={`${summary.nbf.iso} (${summary.nbf.ts})`} />
            )}
            {summary.exp && (
              <li
                class={`flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded border ${
                  summary.exp.expired
                    ? "border-[var(--color-danger)] text-[var(--color-danger)]"
                    : "border-[var(--color-border)] text-[var(--color-fg)]"
                } bg-[var(--color-surface)]`}
              >
                <span class="font-mono text-xs uppercase tracking-widest w-32 shrink-0 text-[var(--color-fg-dim)]">
                  exp (expires)
                </span>
                <span class="font-mono text-sm break-all">
                  {summary.exp.iso} ({summary.exp.ts}){" "}
                  {summary.exp.expired ? "— expired" : ""}
                </span>
              </li>
            )}
          </ul>
        </div>
      )}

      <div role="status" aria-live="polite" class="mt-4 min-h-[1.5rem] font-mono text-sm">
        {error && <span class="text-[var(--color-danger)]">Error: {error}</span>}
      </div>
    </div>
  );
}

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  const text = JSON.stringify(value, null, 2);
  return (
    <div>
      <h3 class="font-mono text-sm uppercase tracking-widest text-[var(--color-fg-dim)] mb-2">
        {title}
      </h3>
      <pre class="p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-xs text-[var(--color-fg)] overflow-x-auto whitespace-pre">
{text}
      </pre>
    </div>
  );
}

function ClaimRow({ label, value }: { label: string; value: string }) {
  return (
    <li class="flex flex-col sm:flex-row sm:items-center gap-2 p-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)]">
      <span class="font-mono text-xs uppercase tracking-widest w-32 shrink-0 text-[var(--color-fg-dim)]">
        {label}
      </span>
      <span class="font-mono text-sm text-[var(--color-fg)] break-all">{value}</span>
    </li>
  );
}
