// ==============================
// File: build-archives.js (in bridge-mini repo root)
// Purpose: Produce stable-named archives & optionally copy to backend/public/bridge
// Usage:
//   node build-archives.js
//   BACKEND_BRIDGE_DIR=../hurrypos-backend/public/bridge node build-archives.js
//   node build-archives.js --copy-to ../hurrypos-backend/public/bridge
// ==============================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

(function main() {
  const dist = path.resolve(__dirname, 'dist');
  const out = path.resolve(__dirname, 'out');
  fs.mkdirSync(out, { recursive: true });

  const targets = [
    { type: 'win',   src: 'bridge-win-x64.exe',  outName: 'beypro-bridge-win-x64.zip',    pack: zip },
    { type: 'macA',  src: 'bridge-macos-arm64',  outName: 'beypro-bridge-mac-arm64.tar.gz', pack: tarGz },
    { type: 'macX',  src: 'bridge-macos-x64',    outName: 'beypro-bridge-mac-x64.tar.gz',   pack: tarGz },
    { type: 'linux', src: 'bridge-linux-x64',    outName: 'beypro-bridge-linux-x64.tar.gz', pack: tarGz, optional: true },
  ];

  const made = [];
  for (const t of targets) {
    const srcPath = path.join(dist, t.src);
    if (!fs.existsSync(srcPath)) {
      if (t.optional) { console.log(`[skip] ${t.src} not found`); continue; }
      console.error(`[err ] Missing ${srcPath}`); continue;
    }
    const outPath = path.join(out, t.outName);
    try { t.pack(srcPath, outPath); made.push(outPath); console.log(`[ok  ] ${path.basename(outPath)}`); }
    catch (e) { console.error(`[fail] ${t.outName}:`, e.message); }
  }

  // SHA256SUMS.txt
  try {
    const sums = made.map(p => `${sha256(p)}  ${path.basename(p)}`).join('\n') + '\n';
    fs.writeFileSync(path.join(out, 'SHA256SUMS.txt'), sums);
    console.log('[ok  ] SHA256SUMS.txt');
    made.push(path.join(out, 'SHA256SUMS.txt'));
  } catch (e) {}

  // Optional copy to backend
  const cliIdx = process.argv.indexOf('--copy-to');
  const cliDest = cliIdx > -1 ? process.argv[cliIdx + 1] : null;
  const envDest = process.env.BACKEND_BRIDGE_DIR || null;
  const dest = cliDest || envDest || null;
  if (dest) {
    const absDest = path.resolve(process.cwd(), dest);
    fs.mkdirSync(absDest, { recursive: true });
    for (const p of made) {
      const to = path.join(absDest, path.basename(p));
      fs.copyFileSync(p, to);
      console.log(`[copy] ${path.basename(p)} -> ${to}`);
    }
    console.log(`[done] Copied ${made.length} file(s) to ${absDest}`);
  } else {
    console.log(`[done] Built ${made.length} file(s) in ${out}`);
  }
})();

function zip(srcFile, outZip) {
  // -j: junk paths; works for .exe. Requires system 'zip'.
  execSync(`zip -j ${q(outZip)} ${q(srcFile)}`, { stdio: 'inherit' });
}
function tarGz(srcPath, outTarGz) {
  // srcPath is a file (mac/linux binary). Pack basename under gzip.
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath);
  execSync(`tar -C ${q(dir)} -czf ${q(outTarGz)} ${q(base)}`, { stdio: 'inherit' });
}
function sha256(p) {
  try {
    return execSync(`shasum -a 256 ${q(p)}`).toString().trim().split(' ')[0];
  } catch {
    return 'sha256-unavailable';
  }
}
function q(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}
