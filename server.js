'use strict';
// 本地服务：静态托管 + 存档落盘 API（存档保存到项目目录 saves/）
// 安全：仅绑定 127.0.0.1（只有本机可访问）；Origin 白名单 + 文件名白名单防目录穿越。
// 注：去掉了原一次性 token 机制——写盘仅本机可信，token 经 /api/token 公开返回本就是伪安全。
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SAVES = path.join(ROOT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const GHOSTS = path.join(SAVES, 'ghosts');
fs.mkdirSync(GHOSTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

// 仅允许本机发起的请求（同源直访 http://localhost 不发 Origin；file:// 为 'null'）
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8384', 'http://127.0.0.1:8384',
  'http://localhost:8385', 'http://127.0.0.1:8385', 'null',
]);
function isOriginAllowed(req) {
  const o = req.headers.origin || '';
  if (!o) return true;            // 同源直访
  return ALLOWED_ORIGINS.has(o);
}

// 静态文件内存缓存（按 mtime 命中），降低每请求同步读盘开销
const _cache = new Map();
function sendFile(fp, res) {
  fs.stat(fp, (err, st) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(fp);
    const key = fp + ':' + st.mtimeMs;
    const hit = _cache.get(fp);
    if (hit && hit.key === key) {
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
      res.end(hit.buf);
      return;
    }
    fs.readFile(fp, (e, buf) => {
      if (e) { res.writeHead(404); res.end('not found'); return; }
      if (buf.length < 512 * 1024) _cache.set(fp, { key, buf });   // 仅缓存 <512KB 的小文件
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // 写盘类 API：仅本机可信（已绑定 127.0.0.1），再叠加 Origin 白名单
  if ((u.pathname === '/api/save' && req.method === 'POST') ||
      (u.pathname === '/api/ghost' && req.method === 'POST')) {
    if (!isOriginAllowed(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'forbidden origin' }));
      return;
    }
  }

  // —— 存档落盘 API ——
  if (u.pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const slot = u.searchParams.get('slot') || '0';
        if (!/^[0-2]$/.test(slot)) throw new Error('bad slot');
        const parsed = JSON.parse(body);
        if (!(parsed && typeof parsed === 'object' && typeof parsed.gold === 'number' && typeof parsed.stage === 'number'))
          throw new Error('bad payload');
        const file = path.join(SAVES, 'slot' + slot + '.json');   // 防目录穿越：固定文件名
        fs.writeFile(file, body, () => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: 'saves/slot' + slot + '.json' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }

  // —— 读取存档 API（GET 限 Origin） ——
  if (u.pathname === '/api/load' && req.method === 'GET') {
    if (!isOriginAllowed(req)) { res.writeHead(403); res.end('forbidden origin'); return; }
    const slot = u.searchParams.get('slot') || '0';
    if (!/^[0-2]$/.test(slot)) { res.writeHead(400); res.end('bad slot'); return; }
    const file = path.join(SAVES, 'slot' + slot + '.json');
    fs.readFile(file, (e, d) => {
      if (e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ empty: true })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(d);
    });
    return;
  }

  // —— 录像 API：POST 上传 / GET 列表与读取 ——
  if (u.pathname === '/api/ghost' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e5) req.destroy(); });
    req.on('end', () => {
      try {
        const rec = JSON.parse(body);
        if (!(rec && typeof rec === 'object' && typeof rec.stage === 'number' && Array.isArray(rec.ops)))
          throw new Error('bad ghost payload');
        const name = 'ghost_' + Date.now() + '_' + Math.random().toString(16).slice(2, 8) + '.json';
        fs.writeFile(path.join(GHOSTS, name), body, () => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: 'saves/ghosts/' + name }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  if (u.pathname === '/api/ghost' && req.method === 'GET') {
    if (!isOriginAllowed(req)) { res.writeHead(403); res.end('forbidden origin'); return; }
    const id = u.searchParams.get('id');
    if (id) {
      if (!/^ghost_[a-f0-9_]+\.json$/.test(id)) { res.writeHead(400); res.end('bad id'); return; }
      const file = path.join(GHOSTS, id);
      fs.readFile(file, (e, d) => {
        if (e) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(d);
      });
      return;
    }
    fs.readdir(GHOSTS, (e, files) => {
      if (e) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ list: [] })); return; }
      const list = [];
      let pending = 0;
      files.filter(f => /^ghost_[a-f0-9_]+\.json$/.test(f)).forEach(f => {
        pending++;
        fs.readFile(path.join(GHOSTS, f), (e2, d2) => {
          if (!e2) {
            try {
              const r = JSON.parse(d2);
              list.push({ id: f, stage: r.stage, diff: r.diff, ai: r.ai, ops: (r.ops || []).length, result: r.result });
            } catch (_) { /* 坏文件跳过 */ }
          }
          if (--pending === 0) finish();
        });
      });
      if (!pending) finish();
      function finish() { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ list })); }
    });
    return;
  }

  // —— 静态文件 ——
  let fp = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname.split('?')[0]);
  fp = path.normalize(fp);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  sendFile(fp, res);
});

server.listen(8384, '127.0.0.1', () => console.log('UP_8384 saves-api (127.0.0.1 only)'));
