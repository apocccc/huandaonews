/**
 * 翻訳キーの追加漏れ検知(CI用)。
 * - 公開サイト: zh-Hant / en の site.json のキー集合が一致すること
 * - 管理画面: zh-Hant / en / ja の admin.json のキー集合が一致すること
 */
import { readFileSync } from "fs";
import path from "path";

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

function load(locale: string, file: string): Set<string> {
  const p = path.join(process.cwd(), "messages", locale, file);
  return new Set(flattenKeys(JSON.parse(readFileSync(p, "utf8"))));
}

function compare(file: string, locales: string[]): boolean {
  const sets = locales.map((l) => ({ locale: l, keys: load(l, file) }));
  const all = new Set(sets.flatMap((s) => [...s.keys]));
  let ok = true;
  for (const { locale, keys } of sets) {
    const missing = [...all].filter((k) => !keys.has(k));
    if (missing.length > 0) {
      ok = false;
      console.error(`✗ ${locale}/${file} is missing keys:`);
      for (const k of missing) console.error(`    ${k}`);
    }
  }
  if (ok) console.log(`✓ ${file}: ${locales.join(", ")} are in sync (${all.size} keys)`);
  return ok;
}

const siteOk = compare("site.json", ["zh-Hant", "en"]);
const adminOk = compare("admin.json", ["zh-Hant", "en", "ja"]);

if (!siteOk || !adminOk) process.exit(1);
