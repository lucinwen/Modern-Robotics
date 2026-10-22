#!/usr/bin/env python3
"""Embed local components and recorded data into the offline lesson pages."""
from pathlib import Path
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    'index.html': 'index.template.html',
    'day-02.html': 'day-02.template.html',
    'day-03.html': 'day-03.template.html',
    'day-06.html': 'day-06.template.html',
}

def render(template_name='index.template.html'):
    template = (ROOT / 'src' / template_name).read_text(encoding='utf-8')
    def component(match):
        name = match.group(1)
        path = ROOT / 'components' / (name + '.html')
        if not path.is_file():
            raise FileNotFoundError(f'Missing component: {path.relative_to(ROOT)}')
        return path.read_text(encoding='utf-8').strip()
    def recorded_data(match):
        path = ROOT / 'data' / (match.group(1) + '.json')
        data = json.loads(path.read_text(encoding='utf-8'))
        return json.dumps(data, ensure_ascii=False, indent=2).replace('<', r'\u003c')
    output = re.sub(r'\{\{component:([a-z0-9-]+)\}\}', component, template)
    return re.sub(r'\{\{data:([a-z0-9-]+)\}\}', recorded_data, output)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    outdated = []
    for filename, template_name in PAGES.items():
        output = render(template_name)
        target = ROOT / filename
        if args.check:
            if not target.is_file() or target.read_text(encoding='utf-8') != output:
                outdated.append(filename)
        else:
            target.write_text(output, encoding='utf-8')
            print(f'Built {filename} ({len(output.encode("utf-8")):,} bytes).')
    if outdated:
        raise SystemExit(', '.join(outdated) + ' is out of date; run python3 scripts/build.py')
    if args.check:
        print('All compiled lessons are current.')
