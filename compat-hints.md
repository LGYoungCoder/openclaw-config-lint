# OpenClaw ConfigGen — Compatibility / Structure Hints

These rules are *hints* about config structure compatibility. They are meant to help users migrate legacy or partial configs into the recommended shape.

## Rules

### OC_CFG_011: cron_only_partial_config
- Trigger: file contains cron jobs (`cron.jobs` / `cronJobs` / `jobs`) but is missing core sections (`gateway/heartbeat/channels/plugins`).
- Meaning: you likely linted a *snippet*, not a full OpenClaw config.
- Fix: merge the snippet into a full config (or generate a baseline config and paste jobs into it).

### OC_CFG_012: top_level_cronJobs_compat
- Trigger: cron jobs detected at top-level `cronJobs` (only used when `cron.jobs` is absent).
- Meaning: legacy/alternate shape.
- Fix: move it under `cron.jobs`.

### OC_CFG_016: top_level_jobs_fallback
- Trigger: cron jobs detected at top-level `jobs` (only used when `cron.jobs` and `cronJobs` are absent).
- Meaning: ambiguous (could be something else).
- Fix: move it under `cron.jobs`.

## Noise reduction behavior
- When a file is clearly a cron-only snippet (OC_CFG_011), the linter suppresses some core-section missing hints (e.g. missing gateway/heartbeat) to keep output focused on the cron issues.
