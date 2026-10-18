import http from 'node:http';
import { readFile } from 'node:fs/promises';
const files = new Set(['index.html', 'styles.css', 'app.mjs', 'model.mjs', 'demo.mjs', 'persistence.mjs', 'dom.mjs', 'history.mjs', 'scope.mjs', 'reports.mjs', 'analysis.mjs', 'assistance.mjs', 'character.mjs', 'game-reports.mjs', 'events.mjs', 'navigation.mjs', 'cube.mjs', 'community.mjs', 'telemetry.mjs', 'resources.mjs', 'team.mjs', 'history-tools.mjs', 'latency-history.mjs', 'combat-insights.mjs', 'run-history.mjs', 'runtime-tools.mjs', 'overlay.mjs', 'bosses.mjs', 'target-demo.mjs']);
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', mjs: 'text/javascript; charset=utf-8' };
const port = Number(process.env.LUMA_PREVIEW_PORT || 7335);
http.createServer(async (request, response) => {
  const filename = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(filename)) { response.writeHead(404); response.end('Not found'); return; }
  try { const bytes = await readFile(new URL(filename, import.meta.url)); response.writeHead(200, { 'Content-Type': types[filename.split('.').at(-1)], 'Cache-Control': 'no-store' }); response.end(bytes); }
  catch { response.writeHead(500); response.end('Unable to read local UI'); }
}).listen(port, '127.0.0.1', () => console.log(`Luma preview: http://127.0.0.1:${port}/ (empty) or /?demo=1 (fixed demo)`));
