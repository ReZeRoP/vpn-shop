import { db } from "@/db";
import { sql } from "drizzle-orm";

// Pure-SQL aggregates for the admin stats page. All time math is epoch-ms
// (createdAt columns store Date.now()-style values).

const DAY_MS = 86_400_000;

export type AdminStats = {
  revenue: { today: number; week: number; month: number };
  ordersByStatus: { status: string; count: number }[];
  newUsers: { today: number; week: number };
  topPlans: { planName: string; sales: number }[];
  pendingReceipts: number;
};

export function getAdminStats(): AdminStats {
  const now = Date.now();
  const dayStart = new Date().setHours(0, 0, 0, 0); // local midnight
  const weekStart = now - 7 * DAY_MS;
  const monthStart = now - 30 * DAY_MS;

  // revenue: paid orders only (approved | verified), bucketed by createdAt
  const revenue = db.get<{ today: number; week: number; month: number }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= ${dayStart} THEN amount_toman END), 0) AS today,
      COALESCE(SUM(CASE WHEN created_at >= ${weekStart} THEN amount_toman END), 0) AS week,
      COALESCE(SUM(CASE WHEN created_at >= ${monthStart} THEN amount_toman END), 0) AS month
    FROM orders
    WHERE status IN ('approved', 'verified')
  `) ?? { today: 0, week: 0, month: 0 };

  const ordersByStatus = db.all<{ status: string; count: number }>(sql`
    SELECT status, COUNT(*) AS count FROM orders GROUP BY status
  `);

  const newUsers = db.get<{ today: number; week: number }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= ${dayStart} THEN 1 END), 0) AS today,
      COALESCE(SUM(CASE WHEN created_at >= ${weekStart} THEN 1 END), 0) AS week
    FROM users
  `) ?? { today: 0, week: 0 };

  const topPlans = db.all<{ planName: string; sales: number }>(sql`
    SELECT plan_name AS planName, COUNT(*) AS sales
    FROM orders
    WHERE status IN ('approved', 'verified')
    GROUP BY plan_name
    ORDER BY sales DESC
    LIMIT 5
  `);

  const pendingReceipts =
    db.get<{ count: number }>(sql`
      SELECT COUNT(*) AS count FROM receipts WHERE review_status = 'pending'
    `)?.count ?? 0;

  return { revenue, ordersByStatus, newUsers, topPlans, pendingReceipts };
}
