#!/usr/bin/env node
/**
 * Builds the Hostinger (PHP + MySQL) package in dist/hostinger/:
 *   website-hostinger-install.zip  first install: index.html + api/ + api/config.php (with a new setup token)
 *   website-hostinger-update.zip   later updates: index.html + api/ WITHOUT config.php (your database settings are
 *                                  never overwritten) and without setup.php (only needed once)
 * Both unpack straight into public_html. No dependencies (uses Node's zlib).
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { deflateRawSync, crc32 } from "node:zlib";
import { randomBytes } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "dist/hostinger");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execFileSync(process.execPath, [join(ROOT, "scripts/build.mjs"), "--api", "api/", "--no-auth", "--out", join(OUT, "index.html")], { stdio: "inherit" });

const apiDir = join(ROOT, "server/api");
const apiFiles = readdirSync(apiDir).filter((f) => f !== "config.php" && !f.endsWith(".sqlite"));
const updateFiles = apiFiles.filter((f) => f !== "setup.php"); // setup is only needed once
const token = randomBytes(18).toString("base64url"); // 24 characters
const config = readFileSync(join(apiDir, "config.example.php"), "utf8").replace("GANTI_DENGAN_TOKEN_ACAK_MINIMAL_24_KARAKTER", token);

/* Minimal ZIP writer (deflate), enough for a handful of files. */
function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  const dosTime = (() => { const d = new Date(); return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; })();
  for (const [name, content] of entries) {
    const data = Buffer.from(content), comp = deflateRawSync(data, { level: 9 }), nameBuf = Buffer.from(name, "utf8"), crc = crc32(data) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime.time, 10); lh.writeUInt16LE(dosTime.date, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime.time, 12); ch.writeUInt16LE(dosTime.date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(0, 30); ch.writeUInt32LE(0, 34); ch.writeUInt32LE(0o644 << 16, 38); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const index = ["index.html", readFileSync(join(OUT, "index.html"))];
const files = (list) => list.map((f) => [`api/${f}`, readFileSync(join(apiDir, f))]);
writeFileSync(join(OUT, "website-hostinger-install.zip"), zip([index, ...files(apiFiles), ["api/config.php", config]]));
writeFileSync(join(OUT, "website-hostinger-update.zip"), zip([index, ...files(updateFiles)]));
writeFileSync(join(OUT, "SETUP-TOKEN.txt"), `Setup token untuk api/setup.php (sama dengan yang ada di api/config.php di dalam ZIP install):\n${token}\n`);
console.log(`package: dist/hostinger/website-hostinger-install.zip  (setup token: ${token})`);
console.log("package: dist/hostinger/website-hostinger-update.zip   (no config.php)");
