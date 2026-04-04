# rianma.dev

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![GitHub License](https://img.shields.io/github/license/rianma/rianma.github.io?color=%232F3741&style=for-the-badge)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white&style=for-the-badge)](https://conventionalcommits.org)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg?style=for-the-badge)](http://commitizen.github.io/cz-cli/)

Personal blog at [rianma.dev](https://rianma.dev) — built with Astro and the [AstroPaper](https://github.com/satnaing/astro-paper) theme. Posts are primarily written in Chinese (zh-CN).

## Features

- [x] Type-safe markdown
- [x] Super fast performance
- [x] Accessible (Keyboard/VoiceOver)
- [x] Responsive (mobile ~ desktops)
- [x] SEO-friendly
- [x] Light & dark mode
- [x] Fuzzy search (Pagefind)
- [x] Draft posts & pagination
- [x] Sitemap & RSS feed
- [x] Dynamic OG image generation per post
- [x] Syntax highlighting with Shiki (light: min-light, dark: night-owl)

## Lighthouse Score

<p align="center">
  <a href="https://pagespeed.web.dev/report?url=https%3A%2F%2Frianma.dev%2F&form_factor=desktop">
    <img width="710" alt="Lighthouse Score" src="AstroPaper-lighthouse-score.svg">
  </a>
</p>

## Project Structure

```
/
├── public/
│   ├── pagefind/          # auto-generated at build time
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   ├── components/
│   ├── data/
│   │   └── blog/          # blog posts (.md / .mdx)
│   ├── layouts/
│   ├── pages/
│   ├── scripts/
│   ├── styles/
│   ├── utils/
│   ├── config.ts          # site-wide config (title, author, etc.)
│   ├── constants.ts
│   ├── content.config.ts
│   └── env.d.ts
└── astro.config.ts
```

All blog posts live in `src/data/blog/`. Static assets go in `public/`.

## Tech Stack

**Framework** — [Astro](https://astro.build/)  
**Type Checking** — [TypeScript](https://www.typescriptlang.org/)  
**Styling** — [TailwindCSS](https://tailwindcss.com/)  
**Search** — [Pagefind](https://pagefind.app/)  
**Syntax Highlighting** — [Shiki](https://shiki.style/) + [@shikijs/transformers](https://shiki.style/packages/transformers)  
**Icons** — [Tabler Icons](https://tabler-icons.io/)  
**Formatting** — [Prettier](https://prettier.io/)  
**Linting** — [ESLint](https://eslint.org)  
**Deployment** — [Cloudflare Pages](https://pages.cloudflare.com/)

## Running Locally

```bash
# Install dependencies
pnpm install

# Start dev server at localhost:4321
pnpm run dev
```

Alternatively, using Docker:

```bash
# Build and serve via nginx
docker build -t rianma-blog .
docker run -p 4321:80 rianma-blog
```

Or with Docker Compose:

```bash
docker compose up -d
```

## Commands

All commands run from the repo root:

| Command                 | Action                                          |
| :---------------------- | :---------------------------------------------- |
| `pnpm install`          | Install dependencies                            |
| `pnpm run dev`          | Start dev server at `localhost:4321`            |
| `pnpm run build`        | Build to `./dist/` (includes Pagefind indexing) |
| `pnpm run preview`      | Preview production build locally                |
| `pnpm run format:check` | Check formatting with Prettier                  |
| `pnpm run format`       | Format with Prettier                            |
| `pnpm run lint`         | Lint with ESLint                                |
| `pnpm run sync`         | Generate TypeScript types for Astro modules     |
| `docker compose up -d`  | Run site in Docker (same host/port as `dev`)    |

## Google Site Verification (optional)

Set this environment variable to inject the verification tag into `<head>`:

```bash
# .env
PUBLIC_GOOGLE_SITE_VERIFICATION=your-google-site-verification-value
```

## DevOps & CI/CD

### Pipeline Overview

```
Pull Request → CI workflow (lint → format check → build)
Push to main → Deploy workflow (install → build → Cloudflare Pages)
```

### CI (`ci.yml`)

Triggers on PR open/edit/sync/reopen. Also callable via `workflow_call`.

Steps: checkout → install pnpm → install deps → lint → format:check → build

Node version: 24, pnpm version: 10.11.1

### Deploy (`deploy.yml`)

Triggers on push to `main`. Uses `cloudflare/wrangler-action@v3`.

Steps: checkout → install pnpm → install deps → build → `wrangler pages deploy dist --project-name=rianma-blog --branch=main`

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### Build script

`pnpm run build` does three things in sequence:

1. `astro check` — TypeScript type checking
2. `astro build` — generate static output to `dist/`
3. `pagefind --site dist` + copy index to `public/` — build search index

### Docker

The `Dockerfile` is a two-stage build (Node → nginx) for local preview only. It is **not** used in the CI/CD pipeline. Cloudflare Pages handles production serving.

## Known Gaps / TODOs

- ~~**No PR preview deployments**~~ — Fixed: `deploy-preview.yml` builds via `ci.yml` and deploys with `--branch=<head-ref>`, then posts/updates the preview URL as a PR comment.
- ~~**Duplicated install+build in CI vs deploy**~~ — Fixed: `deploy.yml` now calls `ci.yml` via `workflow_call` and downloads the built `dist/` artifact instead of rebuilding.
- **Branch naming inconsistency** — `master` is set as the repository's default branch in some git config contexts, but `main` is the branch that actually triggers deploys and is tracked by origin. Can cause confusion.

## License

MIT License, Copyright © 2025

---

Built on [AstroPaper](https://github.com/satnaing/astro-paper) by [Sat Naing](https://satnaing.dev).
