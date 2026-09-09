import os
import re

src_dir = r"E:\NexAI\FrontEnd\src"

def clear_mocks():
    for root, _, files in os.walk(src_dir):
        for file in files:
            if "mockData" in file or "MockData" in file:
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace export const NAME: TYPE = [ ... ];
                new_content = re.sub(
                    r'(export\s+const\s+[A-Z_]+(?:\s*:\s*[^=]+)?\s*=\s*)\[[\s\S]*?\];',
                    r'\1[];',
                    content
                )
                
                if content != new_content:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"Cleared arrays in {path}")

if __name__ == "__main__":
    clear_mocks()
