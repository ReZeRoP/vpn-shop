// Bootstrap: apply migrations + create admin user.
// Usage: npm run db:seed  (reads ADMIN_USER / ADMIN_PASS from env or defaults)
import Database from "better-sqlite3";
import { randomBytes, scryptSync } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataDir = process.env.DATA_DIR || path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "shop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// apply migrations in order (idempotent via drizzle's journal-less simple check)
const migrationsDir = path.join(root, "drizzle");
db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)`);
const applied = new Set(db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));
for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  db.transaction(() => {
    for (const stmt of sql.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) db.exec(s);
    }
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  })();
  console.log("applied migration:", file);
}

// create admin
const username = (process.env.ADMIN_USER || "admin").toLowerCase();
const password = process.env.ADMIN_PASS || "admin123";
const existing = db.prepare("SELECT id, role FROM users WHERE username = ?").get(username);
if (existing) {
  db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id);
  console.log(`user '${username}' already exists — ensured admin role`);
} else {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(
    username,
    `${salt.toString("hex")}:${hash.toString("hex")}`,
  );
  console.log(`admin user created: ${username} / ${password}`);
  if (!process.env.ADMIN_PASS) {
    console.log("⚠ CHANGE THE DEFAULT PASSWORD after first login!");
  }
}

// sample plan if none exist
const planCount = db.prepare("SELECT COUNT(*) AS n FROM plans").get().n;
if (planCount === 0) {
  db.prepare(
    `INSERT INTO plans (name, days, gb, limit_ip, price_toman, inbound_id, description, sort_order, active)
     VALUES ('یک ماهه ۵۰ گیگ', 30, 50, 2, 100000, 1, 'مناسب استفاده روزمره', 0, 1)`,
  ).run();
  console.log("sample plan created (edit it in /admin/plans)");
}

console.log("✓ seed done");
