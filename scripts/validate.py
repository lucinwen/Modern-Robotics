#!/usr/bin/env python3
"""Check the built lesson, local navigation, components, and JavaScript syntax."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.refs, self.scripts = [], [], [], []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'id' in a:
            self.ids.append(a['id'])
        for field in ('href', 'src'):
            if field in a:
                self.links.append(a[field])
        for field in ('for', 'aria-labelledby', 'aria-describedby', 'aria-controls'):
            if field in a:
                self.refs.extend(a[field].split())
        if tag == 'script':
            self.scripts.append(a.get('src'))

def main():
    issues = []
    page = Page()
    text = (ROOT / 'index.html').read_text(encoding='utf-8')
    page.feed(text)
    ids = set(page.ids)
    duplicate = [x for x, n in Counter(page.ids).items() if n > 1]
    if duplicate:
        issues.append('Duplicate IDs: ' + ', '.join(duplicate))
    for ref in page.refs:
        if ref not in ids:
            issues.append('Unresolved accessible reference: ' + ref)
    for link in page.links:
        u = urlsplit(link)
        if u.scheme or u.netloc:
            continue
        target = ROOT / unquote(u.path) if u.path else ROOT / 'index.html'
        if not target.exists():
            issues.append('Missing local resource: ' + link)
        if target == ROOT / 'index.html' and u.fragment and unquote(u.fragment) not in ids:
            issues.append('Missing page anchor: ' + link)
    expected = ['dof-rigid-body', 'dof-three-points', 'dof-cspace-explorer', 'mr-workspace', 'mr-frames-rotation', 'mr-active-passive', 'mr-homogeneous-transform', 'day1-point-cloud', 'day1-room-validation']
    for root_id in expected:
        if root_id not in ids:
            issues.append('Missing interactive lesson: ' + root_id)
    if '{{component:' in text:
        issues.append('Unexpanded component placeholder.')
    if not re.search(r'<html\s+lang="zh-CN"', text):
        issues.append('Missing Chinese page language.')
    if any(src is None for src in page.scripts):
        issues.append('Unexpected inline or missing script reference.')
    css = '\n'.join(p.read_text(encoding='utf-8') for p in (ROOT / 'assets').glob('*.css'))
    definitions = set(re.findall(r'(--[\w-]+)\s*:', css))
    uses = set(re.findall(r'var\((--[\w-]+)', css))
    if uses - definitions:
        issues.append('Undefined theme variables: ' + ', '.join(sorted(uses - definitions)))
    node = shutil.which('node')
    for asset in (ROOT / 'assets').glob('*.js'):
        code = asset.read_text(encoding='utf-8')
        if re.search(r'\bfetch\s*\(|XMLHttpRequest|window\.openai|document\.currentScript', code):
            issues.append('Unexpected network or host dependency: ' + asset.name)
        if node:
            run = subprocess.run([node, '--check', str(asset)], capture_output=True, text=True)
            if run.returncode:
                issues.append('JavaScript syntax: ' + asset.name + '\n' + run.stderr)
    built = subprocess.run([sys.executable, str(ROOT / 'scripts/build.py'), '--check'], capture_output=True, text=True)
    if built.returncode:
        issues.append(built.stderr.strip() or built.stdout.strip())
    if issues:
        print('\n'.join(issues))
        return 1
    print(f'PASS: {len(expected)} interactive lessons; {len(ids)} unique IDs; local links, accessibility references, compiled source, theme variables, and JavaScript syntax.')
    if not node:
        print('Node unavailable: JavaScript syntax check was skipped.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
