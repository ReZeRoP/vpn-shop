import { getSetting, SETTING_KEYS } from "@/lib/settings";
import SettingsForm from "@/components/admin/SettingsForm";

export const metadata = { title: "تنظیمات" };
export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const values = {
    card_number: getSetting(SETTING_KEYS.cardNumber),
    card_holder: getSetting(SETTING_KEYS.cardHolder),
    panel_url: getSetting(SETTING_KEYS.panelUrl),
    panel_user: getSetting(SETTING_KEYS.panelUser),
    panel_pass: getSetting(SETTING_KEYS.panelPass),
    panel_token: getSetting(SETTING_KEYS.panelToken),
    panel_insecure_tls: getSetting(SETTING_KEYS.panelInsecureTls),
    sub_base: getSetting(SETTING_KEYS.subBase),
    public_host: getSetting(SETTING_KEYS.publicHost),
    telegram_support: getSetting(SETTING_KEYS.telegramSupport),
    payment_window_min: getSetting(SETTING_KEYS.paymentWindowMin, "45"),
    max_pending_orders: getSetting(SETTING_KEYS.maxPendingOrders, "2"),
  };
  return (
    <div>
      <h1 className="mb-6 text-xl font-bold">تنظیمات سایت</h1>
      <SettingsForm initial={values} />
    </div>
  );
}
