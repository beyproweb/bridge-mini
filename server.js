// Beypro Bridge (network-only, no native deps)
const express = require("express");
const cors = require("cors");
const net = require("net");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 7777;
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function ok(res, data = {}) { res.json({ ok: true, ...data }); }
function bad(res, code, err) { res.status(code).json({ ok: false, error: String(err) }); }

app.get("/ping", (_req, res) => {
  ok(res, {
    version: "1.1.0",
    platform: `${os.platform()}-${os.arch()}`,
    usb: false // no USB in this build (pure network)
  });
});

// POST /print  { host: "192.168.1.50", port: 9100, dataBase64: "<escpos-bytes>" }
app.post("/print", (req, res) => {
  try {
    const { host, port = 9100, dataBase64 } = req.body || {};
    if (!host || !dataBase64) return bad(res, 400, "host and dataBase64 required");
    const payload = Buffer.from(dataBase64, "base64");

    const sock = new net.Socket();
    let replied = false;
    const finish = (status, msg) => {
      if (replied) return;
      replied = true;
      if (status === 200) ok(res);
      else bad(res, status, msg);
    };

    sock.setTimeout(8000);
    sock.once("connect", () => sock.write(payload));
    sock.once("error", (e) => finish(502, e.message || e));
    sock.once("timeout", () => { sock.destroy(); finish(504, "Printer timeout"); });
    sock.once("close", (hadErr) => finish(hadErr ? 502 : 200, hadErr ? "Socket closed with error" : "OK"));
    sock.connect(port, host);
  } catch (e) {
    bad(res, 500, e);
  }
});

app.listen(PORT, () => {
  console.log(`🖨️ Beypro Bridge listening at http://127.0.0.1:${PORT}`);
});
