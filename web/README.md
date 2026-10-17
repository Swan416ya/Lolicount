# Lolicount Web

Nuxt 4 SSG frontend for Lolicount.

## Commands

Run these commands from the repository root. The workspace installs both the development tools and frontend dependencies together.

```bash
pnpm install
pnpm --dir web dev
pnpm --dir web generate
```

`dev` runs Nuxt on port 3721 and expects the Go API on port 9721. `generate` writes the production static site to `web/.output/public`.

## Deployment

The generated site is synchronized into `assets/dist/` and embedded into the Go binary. Run the backend build from the repository root after regenerating the frontend.
