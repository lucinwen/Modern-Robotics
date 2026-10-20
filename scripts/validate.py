#!/usr/bin/env python3
"""Check both lessons, local links, embedded records, and JavaScript syntax."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import Counter
import re
import json
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    'index.html': ['dof-rigid-body', 'dof-three-points', 'dof-cspace-explorer', 'mr-workspace', 'mr-frames-rotation', 'mr-active-passive', 'mr-homogeneous-transform', 'day1-point-cloud', 'day1-room-validation'],
    'day-02.html': ['day2-domains', 'day2-nonoverlap', 'day2-packing', 'day2-contact', 'day2-pipeline', 'day2-incremental', 'day2-core', 'day2-preferences', 'day2-results'],
}

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.refs, self.scripts = [], [], [], []
        self.json_blocks, self._json_buffer = [], None
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
            self.scripts.append((a.get('src'), a.get('type', '')))
            if a.get('type') == 'application/json':
                self._json_buffer = []
    def handle_data(self, data):
        if self._json_buffer is not None:
            self._json_buffer.append(data)
    def handle_endtag(self, tag):
        if tag == 'script' and self._json_buffer is not None:
            self.json_blocks.append(''.join(self._json_buffer))
            self._json_buffer = None

def main():
    issues = []
    pages = {}
    for filename in EXPECTED:
        path = ROOT / filename
        if not path.is_file():
            issues.append('Missing page: ' + filename)
            continue
        page = Page()
        page_text = path.read_text(encoding='utf-8')
        page.feed(page_text)
        pages[path] = page
        ids = set(page.ids)
        duplicate = [x for x, n in Counter(page.ids).items() if n > 1]
        if duplicate:
            issues.append(filename + ': duplicate IDs: ' + ', '.join(duplicate))
        for ref in page.refs:
            if ref not in ids:
                issues.append(filename + ': unresolved accessible reference: ' + ref)
        for root_id in EXPECTED[filename]:
            if root_id not in ids:
                issues.append(filename + ': missing interactive lesson: ' + root_id)
        if re.search(r'\{\{(?:component|data):', page_text):
            issues.append(filename + ': unexpanded placeholder.')
        if not re.search(r'<html\s+lang="zh-CN"', page_text):
            issues.append(filename + ': missing Chinese page language.')
        for src, kind in page.scripts:
            if src is None and kind != 'application/json':
                issues.append(filename + ': unexpected executable inline script.')
        for block in page.json_blocks:
            try:
                parsed = json.loads(block)
                if filename == 'day-02.html':
                    original = json.loads((ROOT / 'data/day-02-z3-results.json').read_text(encoding='utf-8'))
                    if parsed != original:
                        issues.append('Day 2 embedded records differ from their source JSON.')
            except (ValueError, OSError) as error:
                issues.append(filename + ': invalid embedded record data: ' + str(error))
        if filename == 'day-02.html' and len(page.json_blocks) != 1:
            issues.append('Day 2 must embed exactly one recorded-data block.')

    def check_link(link, source):
        u = urlsplit(link)
        if u.scheme or u.netloc:
            return
        target = (source.parent / unquote(u.path)).resolve() if u.path else source
        if not target.exists():
            issues.append(str(source.relative_to(ROOT)) + ': missing local resource: ' + link)
        elif target in pages and u.fragment and unquote(u.fragment) not in pages[target].ids:
            issues.append(str(source.relative_to(ROOT)) + ': missing page anchor: ' + link)
    for source, page in pages.items():
        for link in page.links:
            check_link(link, source)
    markdown_paths = [ROOT / 'README.md', *(ROOT / 'notes').glob('*.md'), *(ROOT / 'examples').glob('**/README.md')]
    for path in markdown_paths:
        markdown = path.read_text(encoding='utf-8')
        for link in re.findall(r'\[[^\]]*\]\(([^)\s]+)\)', markdown):
            check_link(link, path)
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
    count = sum(len(roots) for roots in EXPECTED.values())
    print(f'PASS: {len(pages)} lesson pages; {count} interactive lessons; local links, per-page IDs, accessibility references, embedded records, compiled source, theme variables, and JavaScript syntax.')
    if not node:
        print('Node unavailable: JavaScript syntax check was skipped.')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
