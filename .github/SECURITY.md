# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly via email:

**<gh@dcln.me>**

Do not open a public issue for security vulnerabilities.

You can expect an initial response within 72 hours.

## Scope

This site (tools.dcln.me) is a collection of free file tools that run entirely in the user's browser. Files are not uploaded to any server.

### In scope

- Cross-site scripting (XSS)
- Content injection
- Security header misconfigurations
- Bypass of the "no upload" guarantee — e.g. any tool inadvertently sending file contents over the network
- Vulnerabilities in the in-browser processing pipeline (`src/lib/`, Web Workers, file handling) that could read files the user did not explicitly choose
- Exposed secrets or credentials (the Cloudflare Web Analytics beacon token is public by design and not a finding)

### Out of scope

- Denial of service (DoS/DDoS)
- Social engineering
- Issues in third-party dependencies with no demonstrated exploit in the context of this site
- Findings against the `cdn.dcln.me` R2 bucket that require valid pre-signed URLs or account access

## Security Architecture

- **Hosting**: Cloudflare Workers Static Assets — pure static, no Worker handler runs on requests
- **Asset CDN**: Cloudflare R2 bucket exposed at `cdn.dcln.me`, CORS scoped to `https://tools.dcln.me`
- **Security headers**: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` enforced via `public/_headers`
- **Processing isolation**: All file processing runs in Web Workers in the user's browser — no server-side code path touches user files
- **Dependencies**: Monitored weekly via Dependabot; `dependency-review` action fails PRs that introduce high-severity vulnerabilities; GitHub CodeQL scans run weekly + on every push
