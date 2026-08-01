import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PRINTER = {
  modelMatch: /L42PRO\s*FULL/i,
  mac: "6C:C1:47:47:6D:4C",
  port: 9100,
  cacheFile: path.join(__dirname, ".printer-cache.json"),
};

function normalizeMac(mac) {
  return String(mac || "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "")
    .replace(/(.{2})(?=.)/g, "$1:");
}

export function getLocalSubnets() {
  const nets = os.networkInterfaces();
  const subnets = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const parts = entry.address.split(".").map(Number);
      if (parts.length !== 4) continue;
      // assume /24 (home LAN)
      const prefix = parts.slice(0, 3).join(".");
      subnets.push({
        address: entry.address,
        prefix,
        cidr: `${prefix}.0/24`,
      });
    }
  }
  return subnets;
}

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(PRINTER.cacheFile, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(data) {
  fs.writeFileSync(PRINTER.cacheFile, JSON.stringify(data, null, 2));
}

export function probePort(host, port = PRINTER.port, timeoutMs = 350) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export function sendAndReceive(host, payload, { port = PRINTER.port, waitMs = 800, timeoutMs = 2500 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const chunks = [];
    let settled = false;

    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(data);
    };

    const timer = setTimeout(() => finish(null, Buffer.concat(chunks)), timeoutMs);

    socket.on("connect", () => {
      socket.write(typeof payload === "string" ? payload : payload);
      setTimeout(() => finish(null, Buffer.concat(chunks)), waitMs);
    });
    socket.on("data", (chunk) => chunks.push(chunk));
    socket.on("error", (err) => finish(err));
  });
}

function cleanText(buf) {
  return Buffer.from(buf)
    .toString("latin1")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .trim();
}

export async function identifyPrinter(host) {
  try {
    const raw = await sendAndReceive(host, "~HI\r\n", { waitMs: 700, timeoutMs: 2000 });
    const text = cleanText(raw);
    if (!PRINTER.modelMatch.test(text)) {
      return null;
    }
    return {
      ip: host,
      port: PRINTER.port,
      hostInfo: text.split(/\r?\n/)[0] || text,
      model: "Elgin L42 PRO FULL",
      identifiedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function lookupMac(ip) {
  try {
    // populate ARP
    await execFileAsync("ping", ["-c", "1", "-W", "200", ip], { timeout: 1500 }).catch(() => null);
    const { stdout } = await execFileAsync("arp", ["-n", ip], { timeout: 1500 });
    const match = stdout.match(/([0-9a-f]{1,2}[:\-]){5}[0-9a-f]{1,2}/i);
    return match ? normalizeMac(match[0]) : null;
  } catch {
    return null;
  }
}

async function scanSubnet(prefix, { concurrency = 64 } = {}) {
  const hosts = Array.from({ length: 254 }, (_, i) => `${prefix}.${i + 1}`);
  const open = [];
  let index = 0;

  async function worker() {
    while (index < hosts.length) {
      const i = index++;
      const host = hosts[i];
      if (await probePort(host)) open.push(host);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return open;
}

/**
 * Descobre a Elgin na LAN (DHCP-friendly).
 * Ordem: cache → varredura 9100 → confirma ~HI → opcionalmente MAC.
 */
export async function discoverElginPrinter({ preferMac = true, useCache = true } = {}) {
  const started = Date.now();
  const cache = useCache ? readCache() : null;

  if (cache?.ip) {
    const hit = await identifyPrinter(cache.ip);
    if (hit) {
      const mac = await lookupMac(hit.ip);
      const result = {
        ...hit,
        mac,
        macMatch: mac ? normalizeMac(mac) === normalizeMac(PRINTER.mac) : null,
        source: "cache",
        elapsedMs: Date.now() - started,
      };
      writeCache(result);
      return result;
    }
  }

  const subnets = getLocalSubnets();
  if (!subnets.length) {
    throw new Error("Nenhuma interface de rede IPv4 encontrada.");
  }

  for (const subnet of subnets) {
    const openHosts = await scanSubnet(subnet.prefix);
    for (const host of openHosts) {
      const hit = await identifyPrinter(host);
      if (!hit) continue;

      const mac = await lookupMac(hit.ip);
      const macMatch = mac ? normalizeMac(mac) === normalizeMac(PRINTER.mac) : null;

      // If MAC known and preferMac, skip non-matching when we can tell
      if (preferMac && mac && macMatch === false) continue;

      const result = {
        ...hit,
        mac,
        macMatch,
        subnet: subnet.cidr,
        source: "scan",
        elapsedMs: Date.now() - started,
      };
      writeCache(result);
      return result;
    }
  }

  throw new Error(
    "Elgin L42 PRO FULL não encontrada na rede. Confira se está ligada e no mesmo Wi-Fi/LAN.",
  );
}

export async function sendZpl(zpl, { host, port = PRINTER.port } = {}) {
  const printer = host ? { ip: host, port } : await discoverElginPrinter();
  // Prefixo: reflexivo/tarja preta (igual ao travado na L42 utility)
  let payload = String(zpl || "").trim();
  payload = payload.replace(/\^MN[YNAW]/gi, "^MNW");
  const withMedia =
    /\^MNW/i.test(payload) || /\^MNN/i.test(payload)
      ? payload
      : `^XA^MNW^MTD^XZ\r\n${payload}`;

  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: printer.ip, port: printer.port || port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Timeout ao enviar ZPL para ${printer.ip}`));
    }, 15000);

    socket.on("connect", () => {
      socket.write(withMedia.endsWith("\n") ? withMedia : `${withMedia}\r\n`);
      socket.end();
    });
    socket.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on("close", () => {
      clearTimeout(timer);
      resolve(printer);
    });
  });
  return printer;
}

// CLI
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  discoverElginPrinter()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      console.error(err.message || err);
      process.exit(1);
    });
}
