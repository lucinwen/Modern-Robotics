#!/usr/bin/env python3
"""Embed the local interactive components into the dependency-free lesson page."""
from pathlib import Path
import argparse
import re

ROOT = Path(__file__).resolve().parents[1]

def render():
    template = (ROOT / 'src/index.template.html').read_text(encoding='utf-8')
    def component(match):
        name = match.group(1)
        path = ROOT / 'components' / (name + '.html')
        if not path.is_file():
            raise FileNotFoundError(f'Missing component: {path.relative_to(ROOT)}')
        return path.read_text(encoding='utf-8').strip()
    return re.sub(r'\{\{component:([a-z-]+)\}\}', component, template)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    output = render()
    target = ROOT / 'index.html'
    if args.check:
        if not target.is_file() or target.read_text(encoding='utf-8') != output:
            raise SystemExit('index.html is out of date; run python3 scripts/build.py')
        print('Compiled lesson is current.')
    else:
        target.write_text(output, encoding='utf-8')
        print(f'Built index.html ({len(output.encode("utf-8")):,} bytes).')
