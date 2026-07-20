import { XuiApi } from "./api";
import { getSetting, SETTING_KEYS } from "@/lib/settings";

// Singleton panel client, rebuilt if admin changes connection settings.
let instance: XuiApi | null = null;
let instanceKey = "";

export function getXui(): XuiApi {
  const url = getSetting(SETTING_KEYS.panelUrl);
  const user = getSetting(SETTING_KEYS.panelUser);
  const pass = getSetting(SETTING_KEYS.panelPass);
  const insecure = getSetting(SETTING_KEYS.panelInsecureTls) === "1";
  if (!url || !user || !pass) {
    throw new Error("اتصال پنل تنظیم نشده است (XUI_PANEL_URL / USER / PASS)");
  }
  const key = `${url}|${user}|${pass}|${insecure}`;
  if (!instance || key !== instanceKey) {
    instance = new XuiApi({ baseUrl: url, username: user, password: pass, insecureTls: insecure });
    instanceKey = key;
  }
  return instance;
}

export * from "./api";
