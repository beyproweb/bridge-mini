const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.scripts ||= {};

/* Auto-detect darwin prebuild (darwin-x64 or universal darwin-x64+arm64) */
pkg.scripts['pack:mac-usb-x64-agent'] =
  "npm run pkg:mac-x64 && node -e \"const fs=require('fs'),p=require('path');" +
  "fs.rmSync('dist/mac-x64',{recursive:true,force:true});" +
  "const base='node_modules/@serialport/bindings-cpp/prebuilds';" +
  "const dst='dist/mac-x64/prebuilds/darwin-x64';fs.mkdirSync(dst,{recursive:true});" +
  "const cand=[p.join(base,'darwin-x64'),p.join(base,'darwin-x64+arm64')];" +
  "const src=cand.find(d=>fs.existsSync(d));if(!src)throw new Error('No darwin prebuild found under '+base);" +
  "fs.cpSync(src,dst,{recursive:true});" +
  "fs.copyFileSync('dist/beypro-bridge-macos-x64','dist/mac-x64/beypro-bridge-macos-x64');" +
  "fs.cpSync('pack/mac-x64','dist/mac-x64',{recursive:true});" +
  "fs.chmodSync('dist/mac-x64/Install-BeyproBridge.command',0o755);" +
  "fs.chmodSync('dist/mac-x64/Uninstall-BeyproBridge.command',0o755);" +
  "fs.mkdirSync('out',{recursive:true});\" && " +
  "bash -lc \"cd dist/mac-x64 && tar -czf ../../out/beypro-bridge-mac-x64.tar.gz . && echo '✅ out/beypro-bridge-mac-x64.tar.gz ready'\"";

pkg.scripts['pack:mac-usb-arm-agent'] =
  "npm run pkg:mac-arm && node -e \"const fs=require('fs'),p=require('path');" +
  "fs.rmSync('dist/mac-arm',{recursive:true,force:true});" +
  "const base='node_modules/@serialport/bindings-cpp/prebuilds';" +
  "const dst='dist/mac-arm/prebuilds/darwin-arm64';fs.mkdirSync(dst,{recursive:true});" +
  "const cand=[p.join(base,'darwin-arm64'),p.join(base,'darwin-x64+arm64')];" +
  "const src=cand.find(d=>fs.existsSync(d));if(!src)throw new Error('No darwin prebuild found under '+base);" +
  "fs.cpSync(src,dst,{recursive:true});" +
  "fs.copyFileSync('dist/beypro-bridge-macos-arm64','dist/mac-arm/beypro-bridge-macos-arm64');" +
  "fs.cpSync('pack/mac-arm64','dist/mac-arm',{recursive:true});" +
  "fs.chmodSync('dist/mac-arm/Install-BeyproBridge.command',0o755);" +
  "fs.chmodSync('dist/mac-arm/Uninstall-BeyproBridge.command',0o755);" +
  "fs.mkdirSync('out',{recursive:true});\" && " +
  "bash -lc \"cd dist/mac-arm && tar -czf ../../out/beypro-bridge-mac-arm64.tar.gz . && echo '✅ out/beypro-bridge-mac-arm64.tar.gz ready'\"";

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json updated: mac pack scripts set');
