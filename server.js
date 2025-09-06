// bridge-mini/server.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const escpos = require("@node-escpos/core");
const USB = require("@node-escpos/usb-adapter");
const Network = require("@node-escpos/network-adapter");
const Serial = require("@node-escpos/serialport-adapter");
const { SerialPort } = require("serialport");

const app = express();
const PORT = process.env.PORT || 7777;

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));

const toHex = n => (typeof n === "number" ? "0x" + n.toString(16).padStart(4, "0") : null);
const parseHex = h => {
  if (typeof h === "number") return h;
  if (typeof h !== "string") return null;
  const s = h.replace(/^0x/i, "");
  const v = parseInt(s, 16);
  return Number.isFinite(v) ? v : null;
};
const cleanErr = e => (e && (e.message || String(e))) || "unknown";

// Health
app.get("/status", (req, res) => res.json({ ok: true, ts: Date.now() }));

// List printers (USB + Serial)
app.get("/printers", async (req, res) => {
  const out = { usb: [], serial: [], tips: [] };

  // USB
  try {
    const list = USB.findPrinter?.() || [];
    out.usb = list.map(p => ({
      vendorId: toHex(p?.deviceDescriptor?.idVendor),
      productId: toHex(p?.deviceDescriptor?.idProduct),
    }));
    if (out.usb.length === 0) out.tips.push("No USB printers detected.");
  } catch (e) {
    out.tips.push("USB list error: " + cleanErr(e));
  }

  // Serial
  try {
    const ports = await SerialPort.list();
    out.serial = ports.map(p => ({
      path: p.path,
      friendlyName: p.friendlyName || "",
      manufacturer: p.manufacturer || "",
    }));
  } catch (e) {
    out.tips.push("Serial list error: " + cleanErr(e));
  }

  res.json(out);
});

// Print text (usb | serial | network)
app.post("/print", async (req, res) => {
  const {
    interface: iface,
    vendorId,
    productId,
    path,
    baudRate = 9600,
    host,
    port = 9100,
    content = "",
    encoding = "cp857", // Turkish-friendly default
    cut = true,
    cashdraw = false,
    align = "lt",
  } = req.body || {};

  if (!content || typeof content !== "string")
    return res.status(400).json({ ok: false, error: "Missing 'content' string." });

  let device;
  try {
    if (iface === "usb") {
      const vid = parseHex(vendorId);
      const pid = parseHex(productId);
      if (vid == null || pid == null) throw new Error("Provide vendorId/productId like '0x04b8'/'0x0e15'.");
      device = new USB(vid, pid);
    } else if (iface === "serial") {
      if (!path) throw new Error("Provide serial 'path' (e.g., /dev/ttyUSB0 or COM3).");
      device = new Serial(path, { baudRate });
    } else if (iface === "network") {
      if (!host) throw new Error("Provide network 'host' (printer IP).");
      device = new Network(host, port);
    } else {
      throw new Error("Unsupported interface. Use usb | serial | network.");
    }

    device.open(err => {
      if (err) return res.status(500).json({ ok: false, error: "open failed: " + cleanErr(err) });
      try {
        const printer = new escpos.Printer(device, { encoding });
        printer.align(align).style("a").size(1, 1).text(content.endsWith("\n") ? content : content + "\n");
        if (cashdraw) printer.cashdraw(2);
        if (cut) printer.cut();
        printer.close();
        return res.json({ ok: true });
      } catch (e) {
        return res.status(500).json({ ok: false, error: "print error: " + cleanErr(e) });
      }
    });
  } catch (e) {
    return res.status(400).json({ ok: false, error: cleanErr(e) });
  }
});

app.listen(PORT, () => console.log(`🖨️ Beypro Bridge (@node-escpos) on http://127.0.0.1:${PORT}`));
