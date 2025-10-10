import re

def update_cell(match, idx):
    row = idx // 4 + 1
    col = idx % 4 + 1
    return f'''              <div
                id='word-{idx}'
                class='Gridcell word'
                role='gridcell'
                tabindex='0'
                aria-colindex='{col}'
                aria-rowindex='{row}'
              ></div>'''

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'<div\s+id=\'word-\d+\'\s+class=\'Gridcell word\'\s+role=\'listitem\'\s+tabindex=\'0\'\s*></div>'
cells = re.finditer(pattern, content)
new_content = content

for idx, match in enumerate(cells):
    new_content = new_content.replace(match.group(0), update_cell(match, idx))

new_content = new_content.replace('class=\'Gridrow\'', 'class=\'Gridrow\' role=\'row\'')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
