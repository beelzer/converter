// JSON-LD schema builders. Each helper returns the schema object AND the
// flat input data, so pages can render both the search-engine JSON-LD and
// the human-visible markup from a single source — no more silent drift
// between the FAQ schema and the rendered <dl>.

import { SITE_URL } from "./site";

// ---------- BreadcrumbList ----------

export interface BreadcrumbCrumb {
  name: string;
  path: string; // relative; "" or "/" for the site root
}

export function breadcrumbSchema(crumbs: BreadcrumbCrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: new URL(c.path || "/", SITE_URL).toString(),
    })),
  };
}

// ---------- FAQPage ----------

export interface FaqItem {
  q: string;
  a: string;
}

export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

// ---------- HowTo ----------

export interface HowToStep {
  name: string;
  text: string;
}

export function howToSchema(opts: { name: string; description?: string; steps: HowToStep[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}
