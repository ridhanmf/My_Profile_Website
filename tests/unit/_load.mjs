/* Loads browser engine files into an isolated VM context, the same way the page concatenates them. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");

export function loadEngine(files, expose) {
  const toasts = [];
  const mem = new Map();
  const ctx = vm.createContext({
    console, Math, Date, JSON, Intl,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
    toast: (msg) => toasts.push(msg),
  });
  for (const f of ["lib/utils.js", ...files]) vm.runInContext(readFileSync(join(SRC, f), "utf8"), ctx, { filename: f });
  const out = vm.runInContext(`({ ${expose.join(", ")} })`, ctx);
  return { ...out, toasts, storage: mem };
}
