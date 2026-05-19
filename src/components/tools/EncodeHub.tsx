import { useState } from "preact/hooks";
import EncodeBase64 from "./EncodeBase64";
import EncodeUrl from "./EncodeUrl";
import EncodeJwt from "./EncodeJwt";
import EncodeHash from "./EncodeHash";

type Mode = "base64" | "url" | "jwt" | "hash";

interface ModeSpec {
  id: Mode;
  label: string;
  blurb: string;
}

const MODES: ModeSpec[] = [
  {
    id: "base64",
    label: "Base64",
    blurb:
      "Encode or decode text (UTF-8) or a file. Optional URL-safe variant strips padding and replaces +/ with -_.",
  },
  {
    id: "url",
    label: "URL",
    blurb:
      "URL-encode (encodeURIComponent) or decode any text. Toggle full encoding for query-string-safe output.",
  },
  {
    id: "jwt",
    label: "JWT",
    blurb:
      "Decode and inspect a JSON Web Token. Header, payload, signature, and standard claims (iss/sub/aud/iat/exp/nbf). No verification.",
  },
  {
    id: "hash",
    label: "Hash",
    blurb:
      "SHA-1, SHA-256, SHA-384, SHA-512 via the platform's WebCrypto SubtleCrypto. Updates as you type.",
  },
];

export default function EncodeHub() {
  const [mode, setMode] = useState<Mode>("base64");
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <div class="w-full">
      <div
        role="tablist"
        aria-label="Choose an encoding operation"
        class="flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-3 mb-4"
      >
        {MODES.map((m) => {
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

      <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`} key={mode}>
        {mode === "base64" && <EncodeBase64 />}
        {mode === "url" && <EncodeUrl />}
        {mode === "jwt" && <EncodeJwt />}
        {mode === "hash" && <EncodeHash />}
      </div>
    </div>
  );
}
