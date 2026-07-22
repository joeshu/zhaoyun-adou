// 在 macOS 上把 Capacitor 输出的 App.app 打包成无签名 IPA（LiveContainer 兼容）
// 对齐参考项目 ios-no-codesign.yml 的打包步骤：
//   ditto App.app Payload/App.app && zip -Xqr App.ipa Payload
// ditto 保留 .app bundle 元数据/符号链接，-X 排除 macOS 扩展属性（__MACOSX/._*）
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

// 查找 App.app：Capacitor 6 默认输出路径
const candidates = [
  'ios/App/build/Release-iphoneos/App.app',
  'ios/build/Release-iphoneos/App.app',
  'ios/DerivedData/Build/Products/Release-iphoneos/App.app',
];
let appPath = null;
for (const c of candidates) {
  const full = path.join(ROOT, c);
  if (fs.existsSync(full)) { appPath = full; break; }
}
if (!appPath) {
  console.error('App.app not found. 已搜索：', candidates.join('\n  '));
  process.exit(1);
}

const dir = path.dirname(appPath);
const appName = path.basename(appPath, '.app');
console.log('Found .app:', appPath);

// 清理旧产物
fs.rmSync(path.join(dir, 'Payload'), { recursive: true, force: true });
fs.rmSync(path.join(dir, appName + '.ipa'), { force: true });

// ditto 复制（保留 bundle 完整性）
execSync(`ditto "${appPath}" "${path.join(dir, 'Payload', appName + '.app')}"`, {
  cwd: dir, stdio: 'inherit',
  // ditto 不会自动建 Payload 目录，先建
});
// 上一步 ditto 在 Payload 目录不存在时会失败，改用 mkdir + ditto
fs.mkdirSync(path.join(dir, 'Payload'), { recursive: true });
execSync(`ditto "${appPath}" "Payload/${appName}.app"`, { cwd: dir, stdio: 'inherit' });

// zip -Xqr：-X 排除扩展属性，-q 安静，-r 递归
const ipaName = appName + '.ipa';
execSync(`/usr/bin/zip -Xqr ${ipaName} Payload`, { cwd: dir, stdio: 'inherit' });

// 清理 Payload 临时目录
fs.rmSync(path.join(dir, 'Payload'), { recursive: true, force: true });

const ipaPath = path.join(dir, ipaName);
const stat = fs.statSync(ipaPath);
console.log('IPA generated:', ipaPath, '(' + (stat.size / 1024 / 1024).toFixed(2) + ' MB)');

// 顶层结构诊断
try {
  console.log('=== IPA 顶层结构 ===');
  execSync(`/usr/bin/unzip -l ${ipaName} | head -20`, { cwd: dir, stdio: 'inherit' });
} catch (e) { /* 非关键 */ }
