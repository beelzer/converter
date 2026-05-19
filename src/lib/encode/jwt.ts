import { base64ToBytes } from "./base64";

export interface JwtParts {
  header: unknown;
  payload: unknown;
  signature: string;
  raw: { header: string; payload: string; signature: string };
}

export function decodeJwt(token: string): JwtParts {
  const cleaned = token.trim();
  const parts = cleaned.split(".");
  if (parts.length !== 3) {
    throw new Error("A JWT must have exactly three dot-separated parts.");
  }
  const [hRaw, pRaw, sRaw] = parts;
  return {
    header: parseJsonPart(hRaw, "header"),
    payload: parseJsonPart(pRaw, "payload"),
    signature: sRaw,
    raw: { header: hRaw, payload: pRaw, signature: sRaw },
  };
}

function parseJsonPart(part: string, name: string): unknown {
  let text: string;
  try {
    const bytes = base64ToBytes(part);
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`Couldn't base64-decode ${name}.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} isn't valid JSON.`);
  }
}

export interface ClaimSummary {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  iat?: { ts: number; iso: string };
  exp?: { ts: number; iso: string; expired: boolean };
  nbf?: { ts: number; iso: string };
}

export function summariseClaims(payload: unknown): ClaimSummary {
  if (!payload || typeof payload !== "object") return {};
  const p = payload as Record<string, unknown>;
  const out: ClaimSummary = {};
  if (typeof p.iss === "string") out.iss = p.iss;
  if (typeof p.sub === "string") out.sub = p.sub;
  if (typeof p.aud === "string" || Array.isArray(p.aud)) {
    out.aud = p.aud as string | string[];
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof p.iat === "number") {
    out.iat = { ts: p.iat, iso: new Date(p.iat * 1000).toISOString() };
  }
  if (typeof p.exp === "number") {
    out.exp = {
      ts: p.exp,
      iso: new Date(p.exp * 1000).toISOString(),
      expired: p.exp < now,
    };
  }
  if (typeof p.nbf === "number") {
    out.nbf = { ts: p.nbf, iso: new Date(p.nbf * 1000).toISOString() };
  }
  return out;
}
