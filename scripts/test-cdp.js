import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-prof-'));

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--remote-debugging-port=9226',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${tmpProfile}`
]);

await new Promise(r => setTimeout(r, 1500));

try {
  const listRes = await fetch('http://127.0.0.1:9226/json/list');
  const list = await listRes.json();
  console.log('Targets:', list.length);
  const target = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result);
      pending.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const currentId = ++id;
    pending.set(currentId, { resolve, reject });
    ws.send(JSON.stringify({ id: currentId, method, params }));
  });

  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Page.navigate', { url: 'data:text/html,<h1 style="color:green">CDP Success</h1>' });
  await new Promise(r => setTimeout(r, 600));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync('screenshots/test.png', Buffer.from(shot.data, 'base64'));
  console.log('Successfully captured screenshot! File size:', fs.statSync('screenshots/test.png').size);

  ws.close();
} catch (err) {
  console.error('Error during CDP test:', err);
} finally {
  chrome.kill();
  try { fs.rmSync(tmpProfile, { recursive: true, force: true }); } catch(_e) {}
}
