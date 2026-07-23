#!/usr/bin/env python3
"""Robustly split _full.diff into crash_fix.patch and visual_fix.patch.
Classifies ui.js hunks by signature ('loop frame error' = crash, '画面:' = visual).
"""
import re, pathlib, subprocess, sys

DIFF = pathlib.Path('.workbuddy/_full.diff').read_text(encoding='utf-8', errors='replace')

# Split into file-sections on start-of-line 'diff --git '
sections_raw = re.split(r'(?m)^diff --git ', DIFF)
file_sections = []
for chunk in sections_raw[1:]:
    lines = chunk.splitlines()
    if len(lines) < 4:
        continue
    m = re.match(r'a/(\S+) b/(\S+)', lines[0])
    path = m.group(2) if m else '?'
    header = lines[:4]
    body = lines[4:]
    # Split body into hunks at lines starting with '@@'
    hunks = []
    cur = None
    for ln in body:
        if ln.startswith('@@'):
            if cur is not None:
                hunks.append(cur)
            cur = [ln]
        else:
            if cur is None:
                continue
            cur.append(ln)
    if cur is not None:
        hunks.append(cur)
    file_sections.append({'path': path, 'header': header, 'hunks': hunks})

by_path = {s['path']: s for s in file_sections}
for need in ['js/actions.js', 'js/save.js', 'js/ui.js', 'js/ui_battle.js']:
    assert need in by_path, f'missing {need} in diff; found: {list(by_path)}'

# Classify ui.js hunks by signature
ui_crash_hunks, ui_visual_hunks = [], []
for h in by_path['js/ui.js']['hunks']:
    text = '\n'.join(h)
    crash = 'loop frame error' in text
    visual = '画面:' in text
    if crash and not visual:
        ui_crash_hunks.append(h)
    elif visual and not crash:
        ui_visual_hunks.append(h)
    else:
        sys.exit(f'cannot classify ui.js hunk (crash={crash}, visual={visual}): {h[0]}')
assert ui_crash_hunks and ui_visual_hunks, 'need >=1 of each ui hunk'

def build_patch(parts):
    """parts: list of (file_section, hunks_list)."""
    out = ''
    for i, (sec, hunks) in enumerate(parts):
        if i > 0:
            out += '\n'
        out += '\n'.join(sec['header']) + '\n'
        for h in hunks:
            out += '\n'.join(h) + '\n'
    return out

crash_patch = build_patch([
    (by_path['js/actions.js'], by_path['js/actions.js']['hunks']),
    (by_path['js/ui.js'], ui_crash_hunks),
])
visual_patch = build_patch([
    (by_path['js/ui_battle.js'], by_path['js/ui_battle.js']['hunks']),
    (by_path['js/save.js'], by_path['js/save.js']['hunks']),
    (by_path['js/ui.js'], ui_visual_hunks),
])

pathlib.Path('.workbuddy/crash_fix.patch').write_text(crash_patch, encoding='utf-8')
pathlib.Path('.workbuddy/visual_fix.patch').write_text(visual_patch, encoding='utf-8')

print('=== crash_fix.patch structure ===')
subprocess.run(['grep','-nE','^(diff --git|@@ )','.workbuddy/crash_fix.patch'])
print('=== visual_fix.patch structure ===')
subprocess.run(['grep','-nE','^(diff --git|@@ )','.workbuddy/visual_fix.patch'])

# Verify: patches reverse-apply cleanly against the current working tree
# (which contains crash+visual). Reversing should succeed.
print('=== verify: git apply --check -R crash_fix.patch ===')
r1 = subprocess.run(['git','apply','--check','-R','.workbuddy/crash_fix.patch'])
print('exit:', r1.returncode)
print('=== verify: git apply --check -R visual_fix.patch ===')
r2 = subprocess.run(['git','apply','--check','-R','.workbuddy/visual_fix.patch'])
print('exit:', r2.returncode)

if r1.returncode == 0 and r2.returncode == 0:
    print('ALL CHECKS OK')
else:
    sys.exit('PATCH VERIFICATION FAILED')