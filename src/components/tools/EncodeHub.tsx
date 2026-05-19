import { Hub, type ModeSpec } from "../shared/Hub";
import EncodeBase64 from "./EncodeBase64";
import EncodeUrl from "./EncodeUrl";
import EncodeJwt from "./EncodeJwt";
import EncodeHash from "./EncodeHash";

type Mode = "base64" | "url" | "jwt" | "hash";

const MODES: ModeSpec<Mode>[] = [
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
    blurb: "SHA-1, SHA-256, SHA-384, SHA-512 via the platform's WebCrypto SubtleCrypto. Updates as you type.",
  },
];

export default function EncodeHub() {
  return (
    <Hub<Mode>
      modes={MODES}
      initial="base64"
      ariaLabel="Choose an encoding operation"
      panels={{
        base64: <EncodeBase64 />,
        url: <EncodeUrl />,
        jwt: <EncodeJwt />,
        hash: <EncodeHash />,
      }}
    />
  );
}
