// bridge-mini/build-archives.js
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const dist = path.join(__dirname, "dist");
const target = "/absolute/path/to/backend/public/bridge"; // <-- CHANGE THIS

if (!fs.existsSync(dist)) fs.mkdirSync(dist);
if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });

process.chdir(dist);

// Clean old archives
[".zip", ".tar.gz"].forEach(ext => {
  fs.readdirSync(".").forEach(f => {
    if (f.endsWith(ext)) fs.unlinkSync(f);
  });
});

// Windows
execSync(`zip -9 beypro-bridge-win-x64-v1.0.6.zip bridge-win-x64.exe`, { stdio: "inherit" });
// macOS universal
execSync(`tar -czf beypro-bridge-mac-universal-v1.0.6.tar.gz bridge-macos-arm64 bridge-macos-x64`, { stdio: "inherit" });
// Linux
execSync(`tar -czf beypro-bridge-linux-x64-v1.0.6.tar.gz bridge-linux-x64`, { stdio: "inherit" });

// Copy to backend/public/bridge
fs.readdirSync(".").forEach(f => {
  if (f.match(/^beypro-bridge-.*\.(zip|tar\.gz)$/)) {
    fs.copyFileSync(f, path.join(target, f));
    console.log("✅ Copied", f, "to", target);
  }
});
