import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users & Auth ────────────────────────────────────────────────────────────
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
    telegramId: text("telegram_id"), // optional support contact
    // trust: has at least one verified card-to-card payment
    verifiedBuyer: integer("verified_buyer", { mode: "boolean" }).notNull().default(false),
    banned: integer("banned", { mode: "boolean" }).notNull().default(false),
    chatMutedUntil: integer("chat_muted_until"), // epoch ms, null = not muted
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("users_username_idx").on(t.username)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // random 32-byte hex token
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(), // epoch ms
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Plans (admin-managed products) ──────────────────────────────────────────
export const plans = sqliteTable("plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(), // e.g. «یک ماهه ۵۰ گیگ»
  days: integer("days").notNull(), // duration in days
  gb: integer("gb").notNull(), // data volume in GB, 0 = unlimited
  limitIp: integer("limit_ip").notNull().default(0), // device limit, 0 = unlimited
  priceToman: integer("price_toman").notNull(),
  inboundId: integer("inbound_id").notNull(), // 3x-ui inbound to provision on
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
});

// ─── Orders ──────────────────────────────────────────────────────────────────
// Status flow:
//   pending_payment → (receipt upload) → approved (instant, clean receipt)
//                                      → held (flagged receipt, awaits admin)
//   approved → verified (admin OK) | revoked (admin: fake receipt)
//   held → approved/verified (admin OK → provision now) | rejected
//   pending_payment → expired (payment window passed)
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: text("public_id").notNull().unique(), // short random id shown to user
    userId: integer("user_id").notNull().references(() => users.id),
    planId: integer("plan_id").notNull().references(() => plans.id),
    // denormalized plan snapshot (plans are editable)
    planName: text("plan_name").notNull(),
    days: integer("days").notNull(),
    gb: integer("gb").notNull(),
    limitIp: integer("limit_ip").notNull(),
    basePriceToman: integer("base_price_toman").notNull(),
    // unique payable amount = base + suffix (1..999), unique among open orders
    amountToman: integer("amount_toman").notNull(),
    status: text("status", {
      enum: ["pending_payment", "held", "approved", "verified", "revoked", "rejected", "expired"],
    })
      .notNull()
      .default("pending_payment"),
    // 3x-ui provisioning data (set when client is created on the panel)
    inboundId: integer("inbound_id"),
    xuiEmail: text("xui_email"), // ord_<publicId> — panel-globally unique
    xuiUuid: text("xui_uuid"),
    subId: text("sub_id"),
    provisionedAt: integer("provisioned_at"),
    expiresAt: integer("expires_at"), // config expiry, epoch ms
    revokeReason: text("revoke_reason"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_amount_idx").on(t.amountToman),
  ],
);

// ─── Receipts ────────────────────────────────────────────────────────────────
export const receipts = sqliteTable(
  "receipts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderId: integer("order_id").notNull().references(() => orders.id),
    userId: integer("user_id").notNull().references(() => users.id),
    imagePath: text("image_path").notNull(), // relative to private data dir
    imageHash: text("image_hash").notNull(), // sha256 of original upload
    trackingCode: text("tracking_code"), // optional شماره پیگیری
    payerCardLast4: text("payer_card_last4"), // optional
    flags: text("flags"), // JSON array of auto-flag reasons, null = clean
    reviewStatus: text("review_status", { enum: ["pending", "ok", "fake", "resubmit"] })
      .notNull()
      .default("pending"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewNote: text("review_note"),
    reviewedAt: integer("reviewed_at"),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    index("receipts_order_idx").on(t.orderId),
    index("receipts_review_idx").on(t.reviewStatus),
    index("receipts_hash_idx").on(t.imageHash),
  ],
);

// ─── Chat ────────────────────────────────────────────────────────────────────
export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id),
    username: text("username").notNull(), // denormalized for cheap reads
    body: text("body").notNull(),
    deleted: integer("deleted", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("chat_created_idx").on(t.createdAt)],
);

// ─── Site settings (admin-editable key/value) ────────────────────────────────
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Audit log ───────────────────────────────────────────────────────────────
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: integer("actor_id").references(() => users.id),
    action: text("action").notNull(), // e.g. receipt.approve, receipt.revoke, plan.update
    target: text("target"), // e.g. order:12
    detail: text("detail"), // JSON
    createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);
