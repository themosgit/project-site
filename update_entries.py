import re
import argparse
from pathlib import Path

def update_benchmark_files_list(part_name):
    benchmark_dir = Path('benchmark_results') / part_name
    
    target_file = Path('assets/js') / f"{part_name}.js"

    print(f"Scanning directory: {benchmark_dir}")
    print(f"Target file: {target_file}")

    try:
        if not benchmark_dir.exists():
            print(f"Error: Directory '{benchmark_dir}' does not exist.")
            return
        if not target_file.exists():
            print(f"Error: File '{target_file}' does not exist.")
            return

        filenames = sorted([
            f.name for f in benchmark_dir.glob('*.json')
        ])

        js_items = ',\n'.join([f"    '{f}'" for f in filenames])
        
        if not filenames:
             replacement_part = "[]"
        else:
            replacement_part = f"[\n{js_items}\n]"

        pattern = re.compile(
            r'(const BENCHMARK_FILES\s*=\s*)(\[.*?\];)',
            re.DOTALL
        )
        
        js_content = target_file.read_text(encoding='utf-8')
        
        updated_content = pattern.sub(
            lambda m: f"{m.group(1)}{replacement_part};", 
            js_content
        )
        
        target_file.write_text(updated_content, encoding='utf-8')
        print(f"Successfully updated {len(filenames)} entries in {target_file}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    """ Now runs as python update_entries.py --part part1 """
    parser = argparse.ArgumentParser(description="Inject benchmark JSON filenames into JS assets.")
    parser.add_argument(
        '-p', '--part', 
        required=True, 
        help="The part name (e.g., part1, part2). Used for folder and file resolution."
    )
    
    args = parser.parse_args()
    
    update_benchmark_files_list(args.part)