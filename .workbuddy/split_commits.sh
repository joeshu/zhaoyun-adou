#!/bin/bash
set -e
cd /d/zhaoyun-adou

# Save real full diff BEFORE reset
git diff > .workbuddy/_full.diff

# === Build crash_fix.patch: actions.js (full) + ui.js (header + loop hunk only) ===
{
  git diff -- js/actions.js
  echo
  # ui.js: file header (4 lines) + from the @@ -851 hunk to EOF
  { git diff -- js/ui.js | head -4; git diff -- js/ui.js | awk '/^@@ -851/{f=1} f'; }
} > .workbuddy/crash_fix.patch

# === Build visual_fix.patch: ui_battle.js + save.js + ui.js (header + drawMenu hunk) ===
{
  git diff -- js/ui_battle.js
  echo
  git diff -- js/save.js
  echo
  # ui.js: header (4 lines) + drawMenu hunk (the @@ -217 one, before @@ -851)
  { git diff -- js/ui.js | head -4; git diff -- js/ui.js | awk '/^@@ -217/{f=1} /^@@ -851/{exit} f'; }
} > .workbuddy/visual_fix.patch

echo "=== crash_fix.patch hunks ==="
grep -nE '^(diff --git|@@ )' .workbuddy/crash_fix.patch
echo "=== visual_fix.patch hunks ==="
grep -nE '^(diff --git|@@ )' .workbuddy/visual_fix.patch

# Reset working tree (tracked) to clean
git checkout -- .
echo "=== status (tracked) after reset ==="
test -z "$(git status --porcelain | grep -v '^??')" && echo "CLEAN OK" || (echo "NOT CLEAN"; exit 1)

# === Commit 1: crash fix ===
echo "=== Apply crash patch ==="
git apply .workbuddy/crash_fix.patch
git add js/actions.js js/ui.js
git commit -F .workbuddy/crash_commit_msg.txt
echo ">>> Commit 1 done"

# === Commit 2: visual ===
echo "=== Apply visual patch ==="
git apply .workbuddy/visual_fix.patch
git add js/ui_battle.js js/save.js js/ui.js
git commit -F .workbuddy/visual_commit_msg.txt
echo ">>> Commit 2 done"

echo "=== Final log ==="
git log --oneline -6
echo "=== Final status (tracked) ==="
test -z "$(git status --porcelain | grep -v '^??')" && echo "CLEAN OK" || echo "DIRTY"
