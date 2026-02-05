# OpenClaw ConfigGen (WIP)

Generate a safe, working `openclaw.json` from a short questionnaire.

## MVP
- Input: a minimal set of answers (channels, DM policy, model/auth choice, sandboxing preference)
- Output: `openclaw.json` + a short "why" explanation + warnings
- Validate: run a static linter over the generated config and report common foot-guns

## Why
Docs exist, but people still fail at:
- picking the right dmPolicy + allowlists
- mixing OAuth/API keys/fallbacks incorrectly
- exposing dashboard / bind settings unsafely
- channel-specific gotchas

## CLI (current)
- `openclaw-configgen rules` → print rule ids
- `openclaw-configgen explain` → print rule docs (generated)
- `openclaw-configgen lint <config.json> [--format json]` → lint an existing config

## Rules source of truth
- Single source of truth: `rules.json`
- Generated docs: `lint-rules.md`
  - Regenerate: `npm run gen:docs`

## One-liner
- Text output:
  - `npm run lint:config -- path/to/openclaw.json`
- JSON output (CI-friendly):
  - `npm run lint:config:json -- path/to/openclaw.json --format json`

Both run `gen:docs` first.

## Planned CLI
- `openclaw-configgen init` → interactive prompts, writes openclaw.json

## Status
WIP, local-only for now. When it feels usable: publish on GitHub as open source.
