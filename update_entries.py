import re
from pathlib import Path

INDEX_FILE = Path('index.html')
BENCHMARK_DIR = Path('benchmark_results')

def update_benchmark_files_list():
    try:
        filenames = sorted([
            f.name for f in BENCHMARK_DIR.glob('*.json')
        ])
        js_items = ',\n'.join([f"            '{f}'" for f in filenames])
        if not filenames:
             replacement_content = "const BENCHMARK_FILES = [];"
        else:
            replacement_content = f"""const BENCHMARK_FILES = [ {js_items} ];"""
        pattern = re.compile(
            r'(const BENCHMARK_FILES\s*=\s*)(\[.*?\];)',
            re.DOTALL
        )
        html_content = INDEX_FILE.read_text()
        updated_html_content = pattern.sub(
            lambda m: m.group(1) + replacement_content.split('=', 1)[-1].strip(), 
            html_content
        )
        INDEX_FILE.write_text(updated_html_content)
    except Exception:
        pass

if __name__ == '__main__':
    update_benchmark_files_list()
