// Beypro Bridge (network + USB via serialport)
const express = require("express");
const cors = require("cors");
const net = require("net");
const os = require("os");
const path = require("path");
const iconv = require("iconv-lite");
// If you ever see missing legacy encodings, uncomment the next line:
const fs = require("fs");


if (process.pkg) {
  const plat = process.platform;  // 'win32' | 'darwin' | 'linux'
  const arch = process.arch;      // 'x64' | 'arm64'

  // default filename for win/mac; linux varies below
  let file = "node.napi.node";
  if (plat === "linux") {
    const r = (process.report?.getReport?.()) || {};
    const hasGlibc = !!r?.header?.glibcVersionRuntime;
    file = hasGlibc ? "node.napi.glibc.node" : "node.napi.musl.node";
  }

  const base = path.join(path.dirname(process.execPath), "prebuilds");

  let candidate;
  if (plat === "darwin") {
    // Try arch-specific folder first (e.g., darwin-x64), else fall back to universal (darwin-x64+arm64)
    const a = path.join(base, `darwin-${arch}`, file);
    const b = path.join(base, "darwin-x64+arm64", file);
    candidate = fs.existsSync(a) ? a : fs.existsSync(b) ? b : null;
  } else {
    candidate = path.join(base, `${plat}-${arch}`, file);
  }

  if (!candidate || !fs.existsSync(candidate)) {
    throw new Error(`SerialPort native binding not found. Looked for: ${candidate}`);
  }
  process.env.SERIALPORT_BINDINGS_PATH = candidate;
}

// 👉 Import serialport ONCE, AFTER setting the env var above
const { SerialPort } = require("serialport");
const listSerial = () => SerialPort.list();

const app = express();
const PORT = process.env.PORT || 7777;

// CORS for browser calls + allow Private Network (Chrome security)
app.use(cors({ origin: true, credentials: false }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

app.use(express.json({ limit: "2mb" }));

const ok  = (res, data = {}) => res.json({ ok: true, ...data });
const bad = (res, code, err) => res.status(code).json({ ok: false, error: String(err) });

// ---------- Helpers ----------
function encToBuffer(text, encoding = "cp857") {
  const enc = (encoding || "").toLowerCase();
  const known = ["cp857", "cp437", "gb18030", "utf8", "utf-8"];
  const use = known.includes(enc) ? enc : "cp857";
  return iconv.encode(text, use === "utf-8" ? "utf8" : use);
}

function addEscposTail(bytes, { cut = false, cashdraw = false } = {}) {
  const tail = [];
  if (cashdraw) {
    // ESC p m t1 t2 — pulse drawer kick (m=0)
    tail.push(0x1B, 0x70, 0x00, 0x32, 0x32);
  }
  tail.push(0x0A, 0x0A, 0x0A);        // feed a few lines
  if (cut) tail.push(0x1D, 0x56, 0x00); // GS V 0 — full cut
  return Buffer.concat([bytes, Buffer.from(tail)]);
}

async function findSerialByVidPid(vendorId, productId) {
  const list = await listSerial();
  const vid = String(vendorId || "").replace(/^0x/i, "").toLowerCase();
  const pid = String(productId || "").replace(/^0x/i, "").toLowerCase();
  return list.find(d =>
    String(d.vendorId || "").toLowerCase() === vid &&
    String(d.productId || "").toLowerCase() === pid
  ) || null;
}

function writeToSerialPath(devicePath, buffer, baudRate = 9600) {
  return new Promise((resolve, reject) => {
    const port = new SerialPort({ path: devicePath, baudRate }, (err) => {
      if (err) return reject(err);
      port.write(buffer, (wErr) => {
        if (wErr) { try { port.close(() => {}); } catch {} return reject(wErr); }
        port.drain((dErr) => {
          try { port.close(() => {}); } catch {}
          if (dErr) return reject(dErr);
          resolve();
        });
      });
    });
  });
}

// ---------- Endpoints ----------
app.get("/ping", async (_req, res) => {
  let usbOK = false;
  try { usbOK = Array.isArray(await listSerial()); } catch {}
  ok(res, {
    version: "1.2.2-usb",
    platform: `${os.platform()}-${os.arch()}`,
    usb: usbOK
  });
});

// List USB devices via serialport (path + vid/pid)
app.get("/usb/list", async (_req, res) => {
  try {
    const list = await listSerial();
    const ports = list.map(p => ({
      path: p.path,
      vendorId: String(p.vendorId || ""),
      productId: String(p.productId || ""),
      manufacturer: p.manufacturer || "",
      friendlyName: p.friendlyName || ""
    }));
    ok(res, { ports });
  } catch (e) {
    bad(res, 500, e);
  }
});

// Raw path print (frontend legacy fallback)
app.post("/usb/print-raw", async (req, res) => {
  try {
    const { path: devicePath, dataBase64, baudRate = 9600 } = req.body || {};
    if (!devicePath || !dataBase64) return bad(res, 400, "path and dataBase64 required");
    await writeToSerialPath(devicePath, Buffer.from(dataBase64, "base64"), baudRate);
    ok(res);
  } catch (e) {
    bad(res, 500, e);
  }
});

// Main print — supports network or USB (interface:"usb")
app.post("/print", async (req, res) => {
  try {
    const body  = req.body || {};
    const iface = String(body.interface || "network").toLowerCase();

    // ---- USB branch ----
    if (iface === "usb") {
      const {
        vendorId, productId,
        content = "", encoding = "cp857",
        cut = false, cashdraw = false,
        baudRate = 9600
      } = body;

      if (!vendorId || !productId) return bad(res, 400, "vendorId and productId required for USB print");

      const found = await findSerialByVidPid(vendorId, productId);
      if (!found?.path) return bad(res, 404, `USB device ${vendorId}:${productId} not found`);

      const init = Buffer.from([0x1B, 0x40]); // ESC @
      const payload = addEscposTail(Buffer.concat([init, encToBuffer(content, encoding)]), { cut, cashdraw });
      await writeToSerialPath(found.path, payload, baudRate);
      return ok(res);
    }

    // ---- Network branch ----
    const { host, port = 9100, dataBase64, content, encoding = "cp857", cut = false, cashdraw = false } = body;
    if (!host) return bad(res, 400, "host required");

    let payload;
    if (dataBase64) {
      payload = Buffer.from(dataBase64, "base64");
    } else {
      const init = Buffer.from([0x1B, 0x40]); // ESC @
      const text = encToBuffer(content || "", encoding);
      payload = addEscposTail(Buffer.concat([init, text]), { cut, cashdraw });
    }

    const sock = new net.Socket();
    let replied = false;
    const finish = (status, msg) => {
      if (replied) return;
      replied = true;
      status === 200 ? ok(res) : bad(res, status, msg);
    };

    sock.setTimeout(8000);
    sock.once("connect", () => sock.write(payload));
    sock.once("error",   (e) => finish(502, e.message || e));
    sock.once("timeout", () => { sock.destroy(); finish(504, "Printer timeout"); });
    sock.once("close",   (hadErr) => finish(hadErr ? 502 : 200, hadErr ? "Socket closed with error" : "OK"));
    sock.connect(port, host);
  } catch (e) {
    bad(res, 500, e);
  }
});

// List Windows printers (friendly names)
app.get("/win/printers", (req, res) => {
  if (process.platform !== "win32") return res.json({ ok: true, printers: [] });
  const ps = 'Get-Printer | Select-Object Name,DriverName,PortName,ComputerName,Default | ConvertTo-Json -Depth 2';
  execFile("powershell.exe", ["-NoProfile", "-Command", ps], { windowsHide: true }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ ok: false, error: stderr || err.message });
    let data;
    try { data = JSON.parse(stdout); } catch {
      return res.json({ ok: true, printers: [], raw: stdout });
    }
    const arr = Array.isArray(data) ? data : [data];
    const printers = arr.map(p => ({
      name: p.Name,
      driver: p.DriverName,
      port: p.PortName,
      computer: p.ComputerName || "",
      isDefault: !!p.Default,
    }));
    res.json({ ok: true, printers });
  });
});

// (Optional) Print RAW via Windows spooler
// npm i printer  (or "npm i @thiagoelg/node-printer") in your bridge project
let printerLib = null;
try { printerLib = require("printer"); } catch {}
app.post("/win/print-raw", (req, res) => {
  if (process.platform !== "win32") return res.status(400).json({ ok:false, error:"Not Windows" });
  if (!printerLib) return res.status(500).json({ ok:false, error:"'printer' module not installed in bridge" });

  const { printerName, dataBase64 } = req.body || {};
  if (!printerName || !dataBase64) return res.status(400).json({ ok:false, error:"Missing printerName/dataBase64" });

  const buf = Buffer.from(dataBase64, "base64");
  printerLib.printDirect({
    data: buf,
    printer: printerName,
    type: "RAW",
    success: () => res.json({ ok: true }),
    error: (err) => res.status(500).json({ ok:false, error: err?.message || String(err) })
  });
});

app.listen(PORT, () => {
  console.log(`🖨️ Beypro Bridge listening at http://127.0.0.1:${PORT}`);
});
