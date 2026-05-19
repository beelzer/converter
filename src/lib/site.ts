// Site-wide config constants. Anything that mentions the production domain,
// the GitHub repo, or third-party tokens belongs here so a forker only has
// to edit one file (or set an env var).

export const SITE_URL = "https://tools.dcln.me";
export const SITE_NAME = "tools.dcln.me";
export const GITHUB_URL = "https://github.com/beelzer/tools";

// Cloudflare Web Analytics beacon token. Public string (ships in every
// visitor's HTML) but kept overridable via env so forkers don't have to
// touch source. The fallback is the production token.
export const CF_BEACON_TOKEN =
  import.meta.env.PUBLIC_CF_BEACON_TOKEN ?? "71a3ecfaa07f456f8516ad6b2c3e225c";

export const CF_BEACON_SCRIPT_URL =
  "https://static.cloudflareinsights.com/beacon.min.js";
