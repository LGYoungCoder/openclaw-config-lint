# OpenClaw Config Lint（配置体检/静态检查）

这是一个 **CI 友好** 的 `openclaw.json` 静态检查工具。
你可以把它理解成：**OpenClaw 配置的 ESLint**。

它用于在你启动 OpenClaw 之前，提前发现常见配置坑（cron、结构缺失、安全风险等），并支持输出 JSON 方便 CI 阻断。

## 适用场景

- **本地改完配置后**：先跑一遍，避免启动才报错/不生效。
- **在 GitHub Actions 里**：每次 PR 自动跑，防止配置回归。

## 快速开始

```bash
npm install
# 人类可读输出
node bin/openclaw-configgen.js lint /path/to/openclaw.json

# CI 机器可读输出
node bin/openclaw-configgen.js lint /path/to/openclaw.json --format json
```

## 常用命令

```bash
# 看所有规则
node bin/openclaw-configgen.js rules

# 按类别看规则（security/core/cron/compat）
node bin/openclaw-configgen.js rules --category security

# 工具自检（验证 lint 自身没坏）
npm run selftest
```

## 一个最直观的例子

### 错误：cron 的 sessionTarget / payload.kind 不匹配（会被抓出来）

```json
{
  "cron": {
    "jobs": {
      "weekly": {
        "name": "weekly-reminder",
        "schedule": { "kind": "cron", "expr": "0 9 * * 1" },
        "sessionTarget": "main",
        "payload": { "kind": "agentTurn", "message": "提醒我每周一复盘" }
      }
    }
  }
}
```

### 正确：sessionTarget=main 时用 systemEvent（并补 tz）

```json
{
  "cron": {
    "jobs": {
      "weekly": {
        "name": "weekly-reminder",
        "schedule": { "kind": "cron", "expr": "0 9 * * 1", "tz": "Asia/Shanghai" },
        "sessionTarget": "main",
        "payload": { "kind": "systemEvent", "text": "【提醒】每周一复盘" }
      }
    }
  }
}
```

## License
Apache-2.0
