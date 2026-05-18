// Lighthouse CI config — runs on PRs (see .github/workflows/ci.yml).
//
// Score thresholds:
// - Accessibility is enforced at error level (≥0.95). Accessibility issues are
//   typically deterministic and we hold ourselves to a strict bar there.
// - Performance, best-practices, SEO are warn-level (≥0.9) so flaky runs don't
//   block merges. Per [[differentiation-strategy]], the long-term target is
//   error-level ≥0.95 across all four categories — tighten when stable.
//
// URLs use trailing slashes to match Astro's default build output.

module.exports = {
  ci: {
    collect: {
      staticDistDir: 'dist',
      url: ['/', '/pdf-merger/', '/about/'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
