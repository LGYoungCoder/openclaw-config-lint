# OpenClaw Doctor vs ConfigGen Lint — Quick Comparison (draft)

> Date: 2026-02-05

## What `openclaw doctor` does (observed)
`openclaw doctor --non-interactive` focuses on **system + runtime health**:
- Security posture suggestions (e.g. channel policies / allowlists)
- Plugin load/diagnostics
- Skills status
- Agent/session store/heartbeat interval visibility
- Quick-fix flow via `openclaw doctor --fix`

Example output observed on this machine:
- Warn: duplicate plugin id (feishu)
- Security: Feishu groupPolicy open → recommend allowlist

## What ConfigGen Lint does
ConfigGen Lint focuses on **config-as-data checks that are CI-friendly**:
- Single rules source (`rules.json`) + generated docs + machine-readable JSON output
- Tight checks for cron correctness (sessionTarget/payload mismatch, schedule sanity, expr missing, etc.)
- Structure compatibility hints for partial/legacy config snippets

## Overlap
- Both can surface config foot-guns and recommend safer defaults.

## Differentiator (why keep ConfigGen)
- CI integration + rules library you can extend/track over time.
- Smaller, composable checks (per rule id) with `fix` field for automation.

## Next: avoid reinventing
- Run doctor with more detail (`--deep`) and map its findings to lint rules:
  - If doctor already checks X reliably → don’t duplicate.
  - If doctor outputs advice that can be made into a deterministic rule → add to lint.
