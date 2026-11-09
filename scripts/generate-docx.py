# scripts/generate-docx.py - Native Microsoft Word Document Builder for FEETrack TDD
import re
import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def build_docx(md_path='docs/TDD.md', docx_path='docs/TDD.docx'):
    print(f"Building DOCX from {md_path} -> {docx_path}...")
    with open(md_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    doc = Document()

    # Set page layout to A4
    for section in doc.sections:
        section.page_width = Inches(8.27)
        section.page_height = Inches(11.69)
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)

    # Configure styles
    style_normal = doc.styles['Normal']
    style_normal.font.name = 'Segoe UI'
    style_normal.font.size = Pt(10)
    style_normal.font.color.rgb = RGBColor(0x33, 0x41, 0x55) # Slate 700

    # Header / Footer
    header = doc.sections[0].header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hrun = hp.add_run("FEETrack — Technical Design Document v1.0.0")
    hrun.font.size = Pt(8.5)
    hrun.font.color.rgb = RGBColor(0x94, 0xa3, 0xb8)

    footer = doc.sections[0].footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    frun = fp.add_run("Confidential — For Internal & Evaluator Review Only")
    frun.font.size = Pt(8.5)
    frun.font.color.rgb = RGBColor(0x94, 0xa3, 0xb8)

    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_lang = ''
    code_lines = []
    in_table = False
    table_lines = []
    mermaid_index = 0

    while i < len(lines):
        line = lines[i]

        # Check code block fences
        if line.startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lang = line[3:].strip()
                code_lines = []
                i += 1
                continue
            else:
                in_code_block = False
                # Handle code block or mermaid diagram
                if code_lang == 'mermaid':
                    mermaid_index += 1
                    png_path = f'docs/diagram_{mermaid_index}.png'
                    if os.path.exists(png_path):
                        p = doc.add_paragraph()
                        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p.paragraph_format.space_before = Pt(8)
                        p.paragraph_format.space_after = Pt(8)
                        run = p.add_run()
                        run.add_picture(png_path, width=Inches(6.5))
                        cap = doc.add_paragraph()
                        cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        cap_run = cap.add_run(f"Figure {mermaid_index}: Architecture & Workflow Diagram")
                        cap_run.font.size = Pt(8.5)
                        cap_run.font.italic = True
                        cap_run.font.color.rgb = RGBColor(0x64, 0x74, 0x8b)
                    else:
                        # Fallback text representation
                        p = doc.add_paragraph()
                        p.paragraph_format.space_before = Pt(4)
                        p.paragraph_format.space_after = Pt(4)
                        run = p.add_run(f"[Mermaid Diagram {mermaid_index}: {code_lines[0] if code_lines else 'Diagram'}]")
                        run.font.italic = True
                else:
                    # Regular code block
                    code_text = '\n'.join(code_lines)
                    tbl = doc.add_table(rows=1, cols=1)
                    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                    cell = tbl.cell(0, 0)
                    set_cell_background(cell, 'F1F5F9')
                    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
                    cp = cell.paragraphs[0]
                    cp.paragraph_format.space_before = Pt(0)
                    cp.paragraph_format.space_after = Pt(0)
                    crun = cp.add_run(code_text)
                    crun.font.name = 'Consolas'
                    crun.font.size = Pt(8.5)
                    crun.font.color.rgb = RGBColor(0x0f, 0x17, 0x2a)
                    doc.add_paragraph().paragraph_format.space_after = Pt(4)

                i += 1
                continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Check table syntax
        if '|' in line and (line.strip().startswith('|') or line.strip().endswith('|')):
            table_lines.append(line)
            i += 1
            # Check if next line is also table
            if i < len(lines) and '|' in lines[i]:
                continue
            else:
                # Flush table
                if len(table_lines) >= 2:
                    rows_data = []
                    for tline in table_lines:
                        clean_row = [c.strip() for c in tline.strip().strip('|').split('|')]
                        # Ignore separator row like |--|--|
                        if all(re.match(r'^:?-+:?$', c) for c in clean_row if c):
                            continue
                        rows_data.append(clean_row)

                    if rows_data:
                        num_cols = max(len(r) for r in rows_data)
                        tbl = doc.add_table(rows=len(rows_data), cols=num_cols)
                        tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                        for r_idx, row in enumerate(rows_data):
                            is_header = (r_idx == 0)
                            for c_idx in range(num_cols):
                                cell = tbl.cell(r_idx, c_idx)
                                val = row[c_idx] if c_idx < len(row) else ''
                                cell.text = val
                                set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
                                if is_header:
                                    set_cell_background(cell, '1E3A8A')
                                    for p in cell.paragraphs:
                                        p.paragraph_format.space_before = Pt(2)
                                        p.paragraph_format.space_after = Pt(2)
                                        for r in p.runs:
                                            r.font.bold = True
                                            r.font.size = Pt(8.5)
                                            r.font.color.rgb = RGBColor(0xff, 0xff, 0xff)
                                else:
                                    bg = 'F8FAFC' if r_idx % 2 == 0 else 'FFFFFF'
                                    set_cell_background(cell, bg)
                                    for p in cell.paragraphs:
                                        p.paragraph_format.space_before = Pt(2)
                                        p.paragraph_format.space_after = Pt(2)
                                        for r in p.runs:
                                            r.font.size = Pt(8.5)
                        doc.add_paragraph().paragraph_format.space_after = Pt(4)
                table_lines = []
                continue

        # Headings
        if line.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(line[2:].strip())
            run.font.name = 'Segoe UI'
            run.font.size = Pt(22)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x8a) # Navy
            i += 1
            continue
        elif line.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(line[3:].strip())
            run.font.name = 'Segoe UI'
            run.font.size = Pt(15)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x1e, 0x3a, 0x8a)
            i += 1
            continue
        elif line.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(line[4:].strip())
            run.font.name = 'Segoe UI'
            run.font.size = Pt(12)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x25, 0x63, 0xeb) # Blue
            i += 1
            continue
        elif line.startswith('#### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.keep_with_next = True
            run = p.add_run(line[5:].strip())
            run.font.name = 'Segoe UI'
            run.font.size = Pt(10.5)
            run.font.bold = True
            run.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
            i += 1
            continue

        # Horizontal Rule
        if line.strip() in ['---', '***', '___']:
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(4)
            r = p.add_run('_______________________________________________________________________________')
            r.font.size = Pt(6)
            r.font.color.rgb = RGBColor(0xca, 0xd5, 0xe1)
            i += 1
            continue

        # Blockquotes / Alerts
        if line.startswith('> '):
            quote_text = line[2:].strip()
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            cell = tbl.cell(0, 0)
            set_cell_background(cell, 'FEF3C7' if '[!WARNING]' in quote_text else 'F1F5F9')
            set_cell_margins(cell, top=80, bottom=80, left=150, right=150)
            qp = cell.paragraphs[0]
            qp.paragraph_format.space_before = Pt(2)
            qp.paragraph_format.space_after = Pt(2)
            clean_q = quote_text.replace('[!WARNING]', 'WARNING:').replace('[!NOTE]', 'NOTE:').replace('[!IMPORTANT]', 'IMPORTANT:')
            qrun = qp.add_run(clean_q)
            qrun.font.size = Pt(9)
            qrun.font.italic = True
            qrun.font.color.rgb = RGBColor(0x92, 0x40, 0x0e) if '[!WARNING]' in quote_text else RGBColor(0x33, 0x41, 0x55)
            i += 1
            continue

        # Bullet List
        if line.strip().startswith('- ') or line.strip().startswith('* '):
            bullet_text = line.strip()[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            # Parse simple bold/italic
            parts = re.split(r'(\*\*.*?\*\*|\`.*?\`)', bullet_text)
            for part in parts:
                if part.startswith('**') and part.endswith('**'):
                    r = p.add_run(part[2:-2])
                    r.font.bold = True
                elif part.startswith('`') and part.endswith('`'):
                    r = p.add_run(part[1:-1])
                    r.font.name = 'Consolas'
                    r.font.size = Pt(9)
                    r.font.color.rgb = RGBColor(0xbe, 0x18, 0x5d)
                else:
                    p.add_run(part)
            i += 1
            continue

        # Numbered List
        m_num = re.match(r'^\s*(\d+)\.\s+(.*)$', line)
        if m_num:
            num_text = m_num.group(2)
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)
            parts = re.split(r'(\*\*.*?\*\*|\`.*?\`)', num_text)
            for part in parts:
                if part.startswith('**') and part.endswith('**'):
                    r = p.add_run(part[2:-2])
                    r.font.bold = True
                elif part.startswith('`') and part.endswith('`'):
                    r = p.add_run(part[1:-1])
                    r.font.name = 'Consolas'
                    r.font.size = Pt(9)
                    r.font.color.rgb = RGBColor(0xbe, 0x18, 0x5d)
                else:
                    p.add_run(part)
            i += 1
            continue

        # Regular Paragraph
        if line.strip():
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.15
            parts = re.split(r'(\*\*.*?\*\*|\`.*?\`|\*.*?\*)', line)
            for part in parts:
                if part.startswith('**') and part.endswith('**'):
                    r = p.add_run(part[2:-2])
                    r.font.bold = True
                elif part.startswith('`') and part.endswith('`'):
                    r = p.add_run(part[1:-1])
                    r.font.name = 'Consolas'
                    r.font.size = Pt(9)
                    r.font.color.rgb = RGBColor(0xbe, 0x18, 0x5d)
                elif part.startswith('*') and part.endswith('*') and len(part) > 2:
                    r = p.add_run(part[1:-1])
                    r.font.italic = True
                else:
                    p.add_run(part)

        i += 1

    doc.save(docx_path)
    print(f"Successfully generated DOCX! Size: {os.path.getsize(docx_path)} bytes")

if __name__ == '__main__':
    build_docx()
