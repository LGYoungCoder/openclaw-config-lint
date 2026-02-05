# OpenClaw Config Lint

A **CI-friendly static linter** for OpenClaw config files (usually `openclaw.json`).

Think: **ESLint for `openclaw.json`**.

> 中文说明：见 [README.zh-CN.md](./README.zh-CN.md)

## What it does
- Checks common config foot-guns **before** you start OpenClaw
- Outputs either **human-readable text** or **machine-readable JSON** (for CI)

## Typical things it catches
- Cron mistakes: invalid schedule, missing `expr`/`tz`, duplicate job names
- Cron logic mistakes: `sessionTarget` vs `payload.kind` mismatch
- Missing core sections when you expect a full config (`gateway` / `heartbeat`)
- Obvious security risks (e.g. plaintext `token` / `secret`)

## Install
```bash
npm ci
```

## Use
### Local (text)
```bash
node bin/openclaw-configgen.js lint /path/to/openclaw.json
```

### CI (JSON)
```bash
node bin/openclaw-configgen.js lint /path/to/openclaw.json --format json
```

## Useful commands
```bash
# list rules
node bin/openclaw-configgen.js rules
node bin/openclaw-configgen.js rules --category security

# verify the linter itself
npm run selftest
```

## GitHub Actions
Copy `examples/github-action.yml` → `.github/workflows/config-lint.yml`.

## License
Apache-2.0
