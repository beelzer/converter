# Contributing

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Commit messages are validated in CI via commitlint on every PR.

Format:

```text
<type>(<optional-scope>): <short summary>
```

Types: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `ci`, `perf`, `test`, `build`, `revert`

Rules:

- Lowercase everything, no period at the end
- Summary under 70 characters
- Use imperative mood ("add feature" not "added feature")

For new tools (the dominant change here), use the tool slug as the scope:

```text
feat(heic-to-jpg): initial implementation
fix(pdf-merger): handle password-protected PDFs gracefully
ci: bump lighthouse threshold to error-level 0.95
```

You can opt into local validation with a one-liner hook if you want to fail fast before CI:

```sh
echo 'npx --no-install commitlint --edit "$1"' > .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

## Branch Workflow

1. Create a branch from `main` (e.g. `feat/heic-to-jpg`, `fix/merger-mobile`)
2. Make commits following the convention above
3. Push and open a PR — CI runs typecheck, lint, build, Lighthouse, e2e tests
4. Squash merge after CI passes (the PR title becomes the squash commit, so it must also follow Conventional Commits)

## Development

```sh
npm install
npm run dev    # http://localhost:4321
```

## Quality checks

```sh
npm run lint        # ESLint
npm run check       # Astro type checking
npm run build       # Production build → dist/
npm run test:e2e    # Playwright e2e (requires a build first)
```

## Adding a new tool

See the [main README](../README.md#adding-a-new-tool) for the step-by-step pattern. Every new tool must:

- Have its own page at `src/pages/<tool-slug>.astro` with title/description targeting a privacy-qualified mid-tail keyword
- Have its widget at `src/components/tools/<ToolName>.tsx` (Preact, hydrated `client:load`)
- Run heavy logic in a Web Worker (no main-thread blocking)
- Lazy-load WASM on user intent (never on page load)
- Hit Lighthouse ≥95 across Performance, Accessibility, Best Practices, SEO — this is a release blocker
- Include a long-form explainer + FAQ schema + HowTo schema on the tool page
- Add an e2e test under `e2e/<tool-slug>.spec.ts`
