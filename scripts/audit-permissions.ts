#!/usr/bin/env bun
/**
 * Automated Permission Audit
 * --------------------------
 * Runs at build/CI time. Fails (exit 1) if:
 *  - A permission key string is used in code/SQL but not declared in ALL_PERMISSIONS
 *  - A nav.* key is used in AppSidebar but not declared in NAV_PERMISSIONS
 *
 * Warns (no failure) if:
 *  - An admin page has no obvious permission check
 *
 * Source of truth: src/hooks/usePermissions.ts (ALL_PERMISSIONS, NAV_PERMISSIONS)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const MIGRATIONS = join(ROOT, "supabase", "migrations");

// --- 1. Parse registry --------------------------------------------------
const registrySrc = readFileSync(join(SRC, "hooks/usePermissions.ts"), "utf8");

function extractArray(src: string, name: string): Set<string> {
  const re = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`);
  const m = src.match(re);
  if (!m) throw new Error(`Registry array ${name} not found`);
  const keys = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  return new Set(keys);
}

const ALL_PERMISSIONS = extractArray(registrySrc, "ALL_PERMISSIONS");
const NAV_PERMISSIONS = extractArray(registrySrc, "NAV_PERMISSIONS");

// --- 2. Walk files ------------------------------------------------------
function walk(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((x) => p.endsWith(x))) out.push(p);
  }
  return out;
}

// Known permission-key shapes: foo.bar, foo.bar_baz, nav.foo, nav.foo.bar
const KEY_PREFIXES = "samples|measurements|priorities|locations|projects|reports|sds|orders|raw_materials|consumables|workstations|users|services|absences|admin|costs|calendar|notifications|activity_log|hazard_notifications";
const KEY_RE = new RegExp(`["'\`](nav\\.(?:[a-z_]+)(?:\\.[a-z_]+)?|(?:${KEY_PREFIXES})\\.[a-z_]+)["'\`]`, "g");

const errors: string[] = [];
const warnings: string[] = [];

const tsFiles = walk(SRC, [".ts", ".tsx"]).filter(
  (f) => !f.endsWith("usePermissions.ts"),
);

const usedKeys = new Map<string, string[]>(); // key -> files

for (const file of tsFiles) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(KEY_RE)) {
    const key = m[1];
    const arr = usedKeys.get(key) ?? [];
    arr.push(relative(ROOT, file));
    usedKeys.set(key, arr);
  }
}

// --- 3. Check unknown keys in code -------------------------------------
for (const [key, files] of usedKeys) {
  const isNav = key.startsWith("nav.");
  const known = isNav ? NAV_PERMISSIONS.has(key) : ALL_PERMISSIONS.has(key);
  if (!known) {
    errors.push(
      `Unknown permission key "${key}" used in: ${[...new Set(files)].join(", ")}\n  → Add it to ${isNav ? "NAV_PERMISSIONS" : "ALL_PERMISSIONS"} in src/hooks/usePermissions.ts`,
    );
  }
}

// --- 4. Check migration files ------------------------------------------
try {
  const sqlFiles = walk(MIGRATIONS, [".sql"]);
  // Only catch keys passed to has_permission(uid, 'key') — robust against random strings
  const SQL_KEY_RE = /has_permission\([^,]+,\s*'([^']+)'\s*\)/g;
  for (const file of sqlFiles) {
    const src = readFileSync(file, "utf8");
    const found = new Set<string>();
    for (const m of src.matchAll(SQL_KEY_RE)) found.add(m[1]);
    for (const key of found) {
      if (!ALL_PERMISSIONS.has(key)) {
        errors.push(
          `SQL migration references unknown permission "${key}" in ${relative(ROOT, file)}`,
        );
      }
    }
  }
} catch {
  /* migrations dir may be absent in some environments */
}

// --- 5. Warn on admin pages without a check ----------------------------
const adminPages = walk(join(SRC, "pages"), [".tsx"]).filter((f) =>
  /\/Admin[A-Z]/.test(f),
);
for (const file of adminPages) {
  const src = readFileSync(file, "utf8");
  const hasCheck =
    /usePermissions|hasPermission|useAuth\(\)[^;]*role|"admin\.system"/.test(
      src,
    );
  if (!hasCheck) {
    warnings.push(
      `Admin page without visible permission check: ${relative(ROOT, file)}`,
    );
  }
}

// --- 6. Report ----------------------------------------------------------
console.log("\n🔐 Permission Audit");
console.log("───────────────────");
console.log(`Registry: ${ALL_PERMISSIONS.size} feature keys, ${NAV_PERMISSIONS.size} nav keys`);
console.log(`Scanned:  ${tsFiles.length} TS files, ${usedKeys.size} distinct keys referenced`);

if (warnings.length) {
  console.log(`\n⚠️  ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log("  - " + w));
}

if (errors.length) {
  console.log(`\n❌ ${errors.length} error(s):`);
  errors.forEach((e) => console.log("  - " + e));
  process.exit(1);
}

console.log("\n✅ All permission keys are registered.\n");
