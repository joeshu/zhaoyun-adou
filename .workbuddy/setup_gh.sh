#!/usr/bin/env bash
set -uo pipefail
WS="D:/zhaoyun-adou/.workbuddy"
TMP="$WS/tmp"; DEST="$WS/bin"; CFG="$WS/gh_config"
mkdir -p "$TMP" "$DEST" "$CFG"

PROXY="http://127.0.0.1:7897"

# 1) token from GCM (strip CR/LF)
TOKEN=$(printf 'protocol=https\nhost=github.com\n' | git credential-manager get | sed -n 's/^password=//p' | tr -d '\r\n')
echo "TOKEN_LEN=${#TOKEN}"

# 2) verify token (direct, skip revocation)
curl -sS --ssl-no-revoke -o "$TMP/api.json" -w "API_HTTP=%{http_code}\n" -H "Authorization: Bearer $TOKEN" https://api.github.com/user
echo "AUTH_AS=$(grep -o '"login": *"[^"]*"' "$TMP/api.json" | head -1)"

# 3) latest gh version + asset (direct, skip revocation)
ASSET_URL=$(curl -sS --ssl-no-revoke https://api.github.com/repos/cli/cli/releases/latest \
  | grep -o 'https://github.com/cli/cli/releases/download/[^"]*gh_[^"]*windows_amd64.zip' | head -1)
VER=$(echo "$ASSET_URL" | grep -o 'v[0-9][0-9.]*' | head -1)
echo "GH_VERSION=$VER"

# 4) download via proxy (CDN handshake fails on direct)
curl -sSL --ssl-no-revoke --proxy "$PROXY" -o "$TMP/gh.zip" -w "DL_HTTP=%{http_code} SIZE=%{size_download}\n" "$ASSET_URL"
echo "DOWNLOADED $(wc -c < "$TMP/gh.zip") bytes"

# 5) unzip
cd "$TMP"; rm -rf gh_unzip; mkdir -p gh_unzip
if command -v unzip >/dev/null 2>&1; then unzip -o -q gh.zip -d gh_unzip; else powershell -NoProfile -Command "Expand-Archive -Force '$TMP/gh.zip' '$TMP/gh_unzip'"; fi
GH_EXE=$(find "$TMP/gh_unzip" -name gh.exe 2>/dev/null | head -1)
echo "GH_EXE=$GH_EXE"
cp "$GH_EXE" "$DEST/gh.exe"
chmod +x "$DEST/gh.exe"

# 6) auth gh — config + proxy forced (NO_PROXY would force direct and break gh's TLS)
export GH_CONFIG_DIR="$CFG"
export PATH="$DEST:$PATH"
export NO_PROXY=""
echo "$TOKEN" | "$DEST/gh.exe" auth login --with-token
"$DEST/gh.exe" auth status
echo "=== CI runs (latest 3) ==="
"$DEST/gh.exe" run list --repo joeshu/zhaoyun-adou --limit 3
