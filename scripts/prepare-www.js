// 准备 www/ 目录：把根目录静态资源复制到 www/，供 Capacitor 打包 iOS
// iOS WebView 中无 server.js，存档/录像落盘按钮会静默降级，localStorage 仍可用
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

// 清空 www/
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
}
fs.mkdirSync(WWW, { recursive: true });

// 复制 index.html（移除服务端相关提示，注入 iOS 平台标记）
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const patched = idx
  // 在 <head> 注入 iOS 平台标记，前端可据此隐藏"存到目录"等按钮
  .replace('</title>', '</title>\n<meta name="capacitor-platform" content="ios">')
  // iOS WebView 默认不支持 :8384 端口，所有 /api/ 走相对路径会失败，前端已有 catch 兜底
  ;
fs.writeFileSync(path.join(WWW, 'index.html'), patched);

// 复制 js/ 目录
const jsSrc = path.join(ROOT, 'js');
const jsDst = path.join(WWW, 'js');
fs.mkdirSync(jsDst, { recursive: true });
for (const f of fs.readdirSync(jsSrc)) {
  if (f.endsWith('.js')) fs.copyFileSync(path.join(jsSrc, f), path.join(jsDst, f));
}

// 复制 saves/ 目录（仅占位结构，存档槽 localStorage 各自独立）
const savesSrc = path.join(ROOT, 'saves');
const savesDst = path.join(WWW, 'saves');
fs.mkdirSync(savesDst, { recursive: true });
if (fs.existsSync(savesSrc)) {
  for (const f of fs.readdirSync(savesSrc)) {
    try { fs.copyFileSync(path.join(savesSrc, f), path.join(savesDst, f)); } catch (e) { /* 忽略单文件失败 */ }
  }
}

// 不复制 server.js / smoke.js / .bak_* / node_modules
console.log('www/ prepared:', fs.readdirSync(WWW).join(', '));
