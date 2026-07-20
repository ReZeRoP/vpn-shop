import { db, tables } from "@/db";
import { asc } from "drizzle-orm";
import PlanEditor from "@/components/admin/PlanEditor";

export const metadata = { title: "مدیریت پلن‌ها" };
export const dynamic = "force-dynamic";

export default function AdminPlansPage() {
  const plans = db.select().from(tables.plans).orderBy(asc(tables.plans.sortOrder)).all();
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">مدیریت پلن‌ها</h1>
      <PlanEditor initialPlans={plans} />
    </div>
  );
}
