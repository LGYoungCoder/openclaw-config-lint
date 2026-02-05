# Release / Publish Checklist (OpenClaw ConfigGen - Lint MVP)

This repo is currently developed inside the OpenClaw workspace under:
- `products/openclaw-configgen/`

## Goal (MVP)
Publish an OSS repo that people can:
1) clone
2) run `npm ci`
3) run `npm run selftest`
4) run `node bin/openclaw-configgen.js lint ./openclaw.json`
5) copy a ready-to-use GitHub Actions workflow

## Minimum repo layout (recommended)
If you publish **only this project**, make it the repo root:
- `bin/openclaw-configgen.js`
- `package.json`
- `rules.json`
- `lint-rules.md`
- `scripts/`
- `examples/`
- `.github/workflows/` (optional; you can start with `examples/github-action.yml`)

If you publish from the monorepo workspace, at least document:
- `products/openclaw-configgen/` is the package root

## One-time steps (owner)
1) Create GitHub repo (public)
2) Add remote and push
3) Post release message (Discord / X / GitHub Discussions)

## Suggested first workflow
Copy `examples/github-action.yml` into `.github/workflows/configgen-lint.yml`.

## External signal to track
- stars, issues, PRs, and “does it catch a real bug in your config?” feedback
