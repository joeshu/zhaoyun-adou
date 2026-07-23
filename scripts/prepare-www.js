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

// 若已构建生产 bundle（npm run build:bundle），把多文件 <script> 替换为单个 bundle.js
const bundlePath = path.join(WWW, 'bundle.js');
if (fs.existsSync(bundlePath)) {
  const htmlPath = path.join(WWW, 'index.html');
  const patched = fs.readFileSync(htmlPath, 'utf8')
    .replace(/<script src="js\/[^"]+\.js"><\/script>\s*/g, '')
    .replace('</body>', '<script src="bundle.js"></script></body>');
  fs.writeFileSync(htmlPath, patched);
  console.log('已用生产 bundle.js 替换多文件脚本');
}

// 仅创建空 saves/ 占位目录（存档走 localStorage，不把本机存档打进包）
const savesDst = path.join(WWW, 'saves');
fs.mkdirSync(savesDst, { recursive: true });

// 不复制 server.js / smoke.js / .bak_* / node_modules
console.log('www/ prepared:', fs.readdirSync(WWW).join(', '));
