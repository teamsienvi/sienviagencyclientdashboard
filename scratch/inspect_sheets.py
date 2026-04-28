import sys, io, zipfile, xml.etree.ElementTree as ET
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
z = zipfile.ZipFile('C:/Users/Iris/Downloads/BulkSheetExport.xlsx')

# Get sheet names
wb_xml = ET.parse(z.open('xl/workbook.xml'))
sheets = [s.get('name') for s in wb_xml.findall(f'.//{NS}sheet')]
print('Sheets:', sheets)

# Shared strings
try:
    ss_tree = ET.parse(z.open('xl/sharedStrings.xml'))
    shared = [(''.join(t.text or '' for t in si.iter(f'{NS}t')))
              for si in ss_tree.findall(f'.//{NS}si')]
except:
    shared = []

def cell_val(c):
    t = c.get('t', '')
    v_el = c.find(f'{NS}v')
    if v_el is None: return ''
    if t == 's':
        try: return shared[int(v_el.text)]
        except: return v_el.text or ''
    return v_el.text or ''

for i in range(1, 12):
    try:
        ws = ET.parse(z.open(f'xl/worksheets/sheet{i}.xml'))
        all_rows = ws.findall(f'.//{NS}row')
        total = len(all_rows)
        rows = all_rows[:3]
        headers = [cell_val(c) for c in rows[0].findall(f'{NS}c')] if rows else []
        sname = sheets[i-1] if i <= len(sheets) else '?'
        print(f'\nSheet {i} [{sname}] — {total} rows')
        print('  Headers:', [h for h in headers[:18] if h])
    except Exception as e:
        print(f'Sheet {i}: error {e}')
