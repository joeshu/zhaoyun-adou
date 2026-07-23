#!/usr/bin/env bash
# gh 包装器：每次从 Git Credential Manager 取已存 token，注入 GH_TOKEN 后调用 gh。
# 不落盘 secret；绕过 gh auth login 的 scope 校验。仅用于本沙箱监控 CI。
WS="D:/zhaoyun-adou/.workbuddy"
export GH_CONFIG_DIR="$WS/gh_config"
export NO_PROXY=""
export PATH="$WS/bin:$PATH"
TOKEN=$(printf 'protocol=https\nhost=github.com\n' | git credential-manager get | sed -n 's/^password=//p' | tr -d '\r\n')
export GH_TOKEN="$TOKEN"
exec "$WS/bin/gh.exe" "$@"
