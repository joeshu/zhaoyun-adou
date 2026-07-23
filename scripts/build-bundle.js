// 把 index.html 中按顺序引入的 js/*.js 合并并压缩为单文件 www/bundle.js，
// 用于生产（Capacitor/iOS）以减少请求数与解析时间。
// 开发期仍用多文件（js/*.js）以便调试与 smoke 测试；只有执行 build:bundle 才会生成 bundle。
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const srcs = [...idx.matchAll(/<script src="(js\/[^"]+\.js)"><\/script>/g)].map(m => m[1]);
if (!srcs.length) { console.error('未在 index.html 找到 js 脚本'); process.exit(1); }

let code = '';
for (const s of srcs) code += '\n;' + fs.readFileSync(path.join(ROOT, s), 'utf8');

const out = path.join(ROOT, 'www', 'bundle.js');
fs.mkdirSync(path.dirname(out), { recursive: true });
esbuild.transform(code, { minify: true, format: 'iife', legalComments: 'none' })
  .then(r => {
    fs.writeFileSync(out, r.code);
    console.log('bundle.js generated: ' + srcs.length + ' files -> ' + (r.code.length / 1024).toFixed(1) + ' KB');
  })
  .catch(e => { console.error(e); process.exit(1); });
