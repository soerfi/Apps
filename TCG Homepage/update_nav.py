import os
import re

target_dir = "."
nav_pattern = re.compile(r'<nav\s+id="main-nav">.*?</nav>', re.DOTALL)

def replace_nav():
    count = 0
    # Walk through all directories
    for root, dirs, files in os.walk(target_dir):
        for file in files:
            if file.endswith(".html"):
                path = os.path.join(root, file)
                
                # Calculate depth relative to project root
                rel_path = os.path.relpath(path, target_dir)
                depth = rel_path.count(os.sep)
                
                # Determine prefixes
                if depth == 0:
                    data_root = "./"
                    js_src = "js/navigation.js"
                else:
                    data_root = "../" * depth
                    js_src = f"{data_root}js/navigation.js"
                
                # Read content
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check for nav
                if '<nav id="main-nav">' in content:
                    # Construct replacement
                    # Note: We rely on the pattern matching to capture whitespace
                    replacement = f'\n    <div id="main-nav-placeholder" data-root="{data_root}"></div>\n    <script src="{js_src}"></script>'
                    
                    new_content = nav_pattern.sub(replacement, content)
                    
                    # Write back if changed
                    if new_content != content:
                        print(f"Update: {path} (Depth: {depth}, Root: {data_root})")
                        with open(path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        count += 1
                else:
                    print(f"Skipping: {path} (No standard nav found)")
    print(f"Total files updated: {count}")

if __name__ == "__main__":
    replace_nav()
