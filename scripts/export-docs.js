// scripts/export-docs.js - Complete PDF and DOCX Export Pipeline for FEETrack TDD
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { diagrams } from './diagrams.js';

const TDD_MD_PATH = path.resolve('docs/TDD.md');
const TDD_PDF_PATH = path.resolve('docs/TDD.pdf');
const TDD_DOCX_PATH = path.resolve('docs/TDD.docx');
const HTML_OUTPUT_PATH = path.resolve('docs/TDD_print.html');

/**
 * 1. Convert Markdown to Print-Optimized HTML with embedded vector SVGs
 */
function markdownToPrintHtml(mdText) {
  let mermaidCount = 0;
  const mermaidSvgMap = [
    diagrams.systemArchitecture,
    diagrams.erd,
    diagrams.rbac,
    diagrams.paymentWorkflow,
    diagrams.refundWorkflow
  ];

  // Replace Mermaid fences with styled SVG containers
  let html = mdText.replace(/```mermaid([\s\S]*?)```/g, () => {
    const svg = mermaidSvgMap[mermaidCount] || '';
    mermaidCount++;
    return `<div class="diagram-wrapper" id="diagram-${mermaidCount}">
      <div class="diagram-title">Figure ${mermaidCount}: Architecture &amp; Workflow Diagram</div>
      <div class="diagram-content">${svg}</div>
    </div>`;
  });

  // Convert code blocks
  html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`;
  });

  // Convert blockquotes / alerts
  html = html.replace(/^> \[\!WARNING\]\s*\n> (.*)$/gm, '<div class="alert alert-warning"><strong>WARNING:</strong> $1</div>');
  html = html.replace(/^> \[\!NOTE\]\s*\n> (.*)$/gm, '<div class="alert alert-note"><strong>NOTE:</strong> $1</div>');
  html = html.replace(/^> \[\!IMPORTANT\]\s*\n> (.*)$/gm, '<div class="alert alert-important"><strong>IMPORTANT:</strong> $1</div>');

  // Convert Headings
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>');

  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr/>');

  // Convert tables
  const lines = html.split('\n');
  const processedLines = [];
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      inTable = true;
      tableRows.push(line);
    } else {
      if (inTable) {
        processedLines.push(convertTableRowsToHtml(tableRows));
        inTable = false;
        tableRows = [];
      }
      processedLines.push(line);
    }
  }
  if (inTable) {
    processedLines.push(convertTableRowsToHtml(tableRows));
  }
  html = processedLines.join('\n');

  // Convert bold, code, math
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\$\$(.*?)\$\$/g, '<div class="math-block"><em>$1</em></div>');
  html = html.replace(/\$(.*?)\$/g, '<span class="math-inline"><em>$1</em></span>');

  // Convert lists
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Convert paragraphs
  html = html.split('\n\n').map(block => {
    block = block.trim();
    if (!block) return '';
    if (block.startsWith('<h') || block.startsWith('<pre') || block.startsWith('<div') || 
        block.startsWith('<table') || block.startsWith('<hr') || block.startsWith('<ul')) {
      return block;
    }
    return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
  }).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FEETrack — Technical Design Document</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    @page :first {
      margin-top: 10mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 9.5pt;
      line-height: 1.5;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 20pt;
      color: #1e3a8a;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 6px;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      color: #1e3a8a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin-top: 18pt;
      margin-bottom: 8pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      color: #2563eb;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10pt;
      color: #475569;
      margin-top: 10pt;
      margin-bottom: 4pt;
      page-break-after: avoid;
    }
    p, li {
      color: #334155;
    }
    code {
      font-family: "Consolas", "Courier New", monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #be185d;
      padding: 2px 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    pre {
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 3px solid #2563eb;
      border-radius: 6px;
      padding: 8px 12px;
      font-family: "Consolas", monospace;
      font-size: 8pt;
      overflow-x: auto;
      page-break-inside: avoid;
      white-space: pre-wrap;
    }
    pre code {
      background: transparent;
      border: none;
      padding: 0;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 12pt 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }
    th {
      background-color: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #1e3a8a;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      color: #334155;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    .alert {
      border-radius: 6px;
      padding: 8px 12px;
      margin: 10pt 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    .alert-warning {
      background-color: #fefce8;
      border-left: 4px solid #eab308;
      color: #854d0e;
    }
    .alert-note {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }
    .alert-important {
      background-color: #fdf2f8;
      border-left: 4px solid #ec4899;
      color: #9d174d;
    }
    .diagram-wrapper {
      margin: 16pt 0;
      padding: 10pt;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      page-break-inside: avoid;
      text-align: center;
    }
    .diagram-title {
      font-size: 9pt;
      font-weight: 700;
      color: #475569;
      margin-bottom: 8pt;
    }
    .diagram-content svg {
      max-width: 100%;
      height: auto;
    }
    .math-block {
      background: #f8fafc;
      border-left: 3px solid #10b981;
      padding: 6px 12px;
      margin: 8pt 0;
      font-family: Georgia, serif;
      font-size: 9pt;
      color: #065f46;
    }
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 16pt 0;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
}

function convertTableRowsToHtml(rows) {
  const cleanRows = [];
  for (const r of rows) {
    const cells = r.trim().split('|').map(c => c.trim()).filter((_c, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length && !cells.every(c => /^:?-+:?$/.test(c))) {
      cleanRows.push(cells);
    }
  }
  if (!cleanRows.length) return '';
  const [header, ...body] = cleanRows;
  let out = '<table>\n<thead><tr>';
  for (const h of header) out += `<th>${h}</th>`;
  out += '</tr></thead>\n<tbody>';
  for (const row of body) {
    out += '<tr>';
    for (const cell of row) out += `<td>${cell}</td>`;
    out += '</tr>';
  }
  out += '</tbody></table>';
  return out;
}

/**
 * 2. Launch Headless Chrome via CDP to:
 *    A) Capture high-res PNGs of diagrams for Word DOCX embedding
 *    B) Print styled HTML to high-resolution A4 PDF
 */
async function generatePdfAndDiagramPngs() {
  console.log('[1/4] Preparing styled print HTML...');
  const mdText = fs.readFileSync(TDD_MD_PATH, 'utf-8');
  const printHtml = markdownToPrintHtml(mdText);
  fs.writeFileSync(HTML_OUTPUT_PATH, printHtml, 'utf-8');
  console.log(`[PASS] Written print HTML: ${HTML_OUTPUT_PATH}`);

  console.log('[2/4] Launching Headless Chrome via CDP...');
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-tdd-'));
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${tmpProfile}`
  ]);

  let targets;
  for (let i = 0; i < 20; i++) {
    try {
      const listRes = await fetch('http://127.0.0.1:9227/json/list');
      targets = await listRes.json();
      if (targets && targets.length > 0) break;
    } catch (_e) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!targets || targets.length === 0) {
    chromeProcess.kill();
    throw new Error('Failed to connect to Chrome CDP at port 9227');
  }

  try {
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id).resolve(msg.result);
        pending.delete(msg.id);
      }
    };

    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(r => { ws.onopen = r; });
    await send('Page.enable');
    await send('DOM.enable');

    // Capture Diagram PNGs for DOCX embedding
    console.log('[3/4] Capturing diagram PNGs for DOCX embedding...');
    const diagramEntries = [
      { id: 1, name: 'systemArchitecture', svg: diagrams.systemArchitecture },
      { id: 2, name: 'erd', svg: diagrams.erd },
      { id: 3, name: 'rbac', svg: diagrams.rbac },
      { id: 4, name: 'paymentWorkflow', svg: diagrams.paymentWorkflow },
      { id: 5, name: 'refundWorkflow', svg: diagrams.refundWorkflow }
    ];

    for (const d of diagramEntries) {
      const dataUrl = 'data:text/html,' + encodeURIComponent(`<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#f8fafc;display:flex;justify-content:center;">${d.svg}</body></html>`);
      await send('Page.navigate', { url: dataUrl });
      await new Promise(r => setTimeout(r, 400));
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
      const pngPath = path.resolve(`docs/diagram_${d.id}.png`);
      fs.writeFileSync(pngPath, Buffer.from(shot.data, 'base64'));
      console.log(`       Rendered docs/diagram_${d.id}.png (${fs.statSync(pngPath).size} bytes)`);
    }

    // Now load full print HTML and generate PDF via Page.printToPDF
    console.log('[4/4] Printing to PDF via Page.printToPDF...');
    const fileUrl = 'file:///' + HTML_OUTPUT_PATH.replace(/\\/g, '/');
    await send('Page.navigate', { url: fileUrl });
    await new Promise(r => setTimeout(r, 2000));

    const pdfResult = await send('Page.printToPDF', {
      landscape: false,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:7pt; font-family:system-ui,sans-serif; width:100%; text-align:right; color:#94a3b8; padding-right:15mm;">FEETrack — Technical Design Document v1.0.0</div>',
      footerTemplate: '<div style="font-size:7pt; font-family:system-ui,sans-serif; width:100%; text-align:center; color:#94a3b8;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
      printBackground: true,
      marginTop: 0.6,
      marginBottom: 0.6,
      marginLeft: 0.6,
      marginRight: 0.6,
      paperWidth: 8.27, // A4 inches
      paperHeight: 11.69 // A4 inches
    });

    fs.writeFileSync(TDD_PDF_PATH, Buffer.from(pdfResult.data, 'base64'));
    console.log(`[PASS] Successfully generated PDF: ${TDD_PDF_PATH} (${fs.statSync(TDD_PDF_PATH).size} bytes)`);

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

/**
 * 3. Generate DOCX with embedded diagram PNGs using python-docx
 */
function generateDocx() {
  console.log('[DOCX] Invoking python scripts/generate-docx.py...');
  const out = execSync('python scripts/generate-docx.py', { encoding: 'utf-8' });
  console.log(out.trim());
  console.log(`[PASS] Successfully generated DOCX: ${TDD_DOCX_PATH} (${fs.statSync(TDD_DOCX_PATH).size} bytes)`);
}

/**
 * 4. Master Pipeline Runner & Inspector
 */
async function main() {
  console.log('=====================================================');
  console.log('  FEETrack Phase 7.4 — TDD PDF and DOCX Export Pipeline');
  console.log('=====================================================');

  await generatePdfAndDiagramPngs();
  generateDocx();

  console.log('\n--- Export Validation Results ---');
  console.log('PDF File:', TDD_PDF_PATH, `(${fs.statSync(TDD_PDF_PATH).size} bytes)`);
  console.log('DOCX File:', TDD_DOCX_PATH, `(${fs.statSync(TDD_DOCX_PATH).size} bytes)`);

  // Verify non-zero sizes
  if (fs.statSync(TDD_PDF_PATH).size < 10000) throw new Error('PDF file size is suspiciously small');
  if (fs.statSync(TDD_DOCX_PATH).size < 10000) throw new Error('DOCX file size is suspiciously small');

  // Verify PDF page count via Python pypdf
  try {
    const pdfPages = execSync(`python -c "import pypdf; reader = pypdf.PdfReader('${TDD_PDF_PATH.replace(/\\/g, '/')}'); print(len(reader.pages))"`, { encoding: 'utf-8' });
    console.log('PDF Page Count:', pdfPages.trim(), 'pages');
  } catch (err) {
    console.warn('Could not inspect PDF pages:', err.message);
  }

  console.log('All exports completed cleanly!');
}

main().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
