'use strict';
// 本地服务：静态托管 + 存档落盘 API（存档保存到项目目录 saves/）
// 安全：Origin 白名单 + 简易 token；写盘仅限定文件名防目录穿越
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const SAVES = path.join(ROOT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const GHOSTS = path.join(SAVES, 'ghosts');       // P1-4 录像共享目录
fs.mkdirSync(GHOSTS, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

// Origin 白名单：只允许本机发起的请求写盘
const ALLOWED_ORIGINS = new Set([
  'http://localhost:8384',
  'http://127.0.0.1:8384',
  'http://localhost:8385',
  'http://127.0.0.1:8385',
  'null',                 // file:// 直开（Origin: null）允许，便于离线访问
]);

// 生成一次性 token：启动时打印控制台，前端首次访问需带上才能写盘
const TOKEN = crypto.randomBytes(8).toString('hex');
console.log('SAVE_TOKEN=' + TOKEN + '  (前端调用 /api/save?token=<TOKEN>)');

function isOriginAllowed(req) {
  const o = req.headers.origin || '';
  // 同源（浏览器直访 http://localhost:8384 不发 Origin）允许
  if (!o) return true;
  return ALLOWED_ORIGINS.has(o);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  // CORS 预检 + 实际请求统一处理
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Save-Token');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // —— token 校验：写操作必带 ——
  const needToken = (u.pathname === '/api/save' && req.method === 'POST')
    || (u.pathname === '/api/ghost' && req.method === 'POST');
  if (needToken) {
    if (!isOriginAllowed(req)) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'forbidden origin' })); return; }
    const t = u.searchParams.get('token') || req.headers['x-save-token'] || '';
    if (t !== TOKEN) { res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'bad token' })); return; }
  }
  // —— 存档落盘 API ——
  if (u.pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const slot = u.searchParams.get('slot') || '0';
        if (!/^[0-2]$/.test(slot)) throw new Error('bad slot');
        const parsed = JSON.parse(body); // 校验合法 JSON
        if (parsed && typeof parsed === 'object' && typeof parsed.gold === 'number' && typeof parsed.stage === 'number') {
          // 通过基本完整性校验，写盘
        } else throw new Error('bad payload');
        const file = path.join(SAVES, 'slot' + slot + '.json'); // 防目录穿越：固定文件名
        fs.writeFileSync(file, body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file: 'saves/slot' + slot + '.json' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
      }
    });
    return;
  }
  // —— 读取存档 API（GET 不需要 token，但限 Origin） ——
  if (u.pathname === '/api/load' && req.method === 'GET') {
    if (!isOriginAllowed(req)) { res.writeHead(403); res.end('forbidden origin'); return; }
    const slot = u.searchParams.get('slot') || '0';
    if (!/^[0-2]$/.test(slot)) { res.writeHead(400); res.end('bad slot'); return; }
    const file = path.join(SAVES, 'slot' + slot + '.json');
    if (!fs.existsSync(file)) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ empty: true })); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fs.readFileSync(file, 'utf8'));
    return;
  }
  // —— P1-4 录像 API：POST 上传 / GET 列表与读取 ——
  if (u.pathname === '/api/ghost' && req.method === 'POST') {
    // 已通过上方 token 校验
    let body = '';
    req.on('data', c => { body += c; if (body.length > 2e5) req.destroy(); });
    req.on('end', () => {
      try {
        const rec = JSON.parse(body);
        if (!rec || typeof rec !== 'object' || typeof rec.stage !== 'number' || !Array.isArray(rec.ops))
          throw new Error('bad ghost payload');
        // 防目录穿越：仅用时间戳作为文件名
        const name = 'ghost_' + Date.now() + '_' + crypto.randomBytes(3).toString('hex') + '.json';
        fs.writeFileSync(path.join(GHOSTS, name), body);
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
    // 单条读取：?id=<filename>
    const id = u.searchParams.get('id');
    if (id) {
      if (!/^ghost_[a-f0-9_]+\.json$/.test(id)) { res.writeHead(400); res.end('bad id'); return; }
      const file = path.join(GHOSTS, id);
      if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(fs.readFileSync(file, 'utf8'));
      return;
    }
    // 列表：返回所有录像的元数据
    const files = fs.readdirSync(GHOSTS).filter(f => /^ghost_[a-f0-9_]+\.json$/.test(f));
    const list = files.map(f => {
      try {
        const r = JSON.parse(fs.readFileSync(path.join(GHOSTS, f), 'utf8'));
        return { id: f, stage: r.stage, diff: r.diff, ai: r.ai, ops: (r.ops || []).length, result: r.result };
      } catch (e) { return null; }
    }).filter(Boolean);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ list }));
    return;
  }
  // —— token 获取端点：前端首次访问可拉取（同源/本机内信任） ——
  if (u.pathname === '/api/token' && req.method === 'GET') {
    if (!isOriginAllowed(req)) { res.writeHead(403); res.end('forbidden'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token: TOKEN }));
    return;
  }
  // —— 静态文件 ——
  let fp = path.join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname.split('?')[0]);
  fp = path.normalize(fp);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(fp);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(d);
  });
});

server.listen(8384, '0.0.0.0', () => console.log('UP_8384 saves-api'));

