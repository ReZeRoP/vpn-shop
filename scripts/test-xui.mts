// E2E-ish test for the dual-API XuiApi against the mock panel.
// Runs the same client lifecycle against BOTH panel flavors:
//   legacy  → /panel/api/inbounds/addClient et al.
//   clients → /panel/api/clients/*  (newer builds; addClient route removed)
// Usage: tsx scripts/test-xui.mts   (spawns its own mock panel per mode)
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { XuiApi } from "../src/lib/xui/api.ts";

const BASE = "http://127.0.0.1:20530/mock";
let failures = 0;

function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
}

async function run(mode: "legacy" | "clients") {
  console.log(`\n=== mode: ${mode} ===`);
  const env = { ...process.env, MOCK_CLIENTS_API: mode === "clients" ? "1" : "" };
  const mock = spawn(process.execPath, ["scripts/mock-panel.mjs"], { env, stdio: "inherit" });
  await sleep(600);
  try {
    const api = new XuiApi({ baseUrl: BASE, username: "admin", password: "admin" });

    const inbounds = await api.listInbounds();
    assert(inbounds.length === 1 && inbounds[0].id === 1, "listInbounds returns the inbound");

    const email = "ord_TEST01";
    const { uuid, subId } = await api.addClient(1, {
      email,
      totalGB: 10 * 1024 ** 3,
      expiryTime: Date.now() + 86_400_000,
      limitIp: 2,
      comment: "test order",
    });
    assert(!!uuid && uuid.length >= 8, `addClient returned a uuid (${uuid})`);
    assert(!!subId && subId.length === 16, `addClient returned a subId (${subId})`);

    const traffic = await api.getClientTraffic(email);
    assert(traffic?.email === email, "getClientTraffic finds the client by email");

    // revoke (disable) then re-enable — the receipt revocation path
    await api.setClientEnable(1, uuid, false);
    const disabled = await api.getInbound(1);
    const parsed = (typeof disabled.settings === "string"
      ? JSON.parse(disabled.settings)
      : disabled.settings) as { clients: Array<{ email: string; enable: boolean }> };
    const rec = parsed.clients.find((c) => c.email === email);
    assert(rec?.enable === false, "setClientEnable(false) disabled the client");
    await api.setClientEnable(1, uuid, true);

    // vless link building still works with object-shaped streamSettings
    const inbound = await api.getInbound(1);
    const { buildVlessLink } = await import("../src/lib/xui/api.ts");
    const link = buildVlessLink(inbound, uuid, email, "example.com");
    assert(link.startsWith("vless://") && link.includes(uuid), "buildVlessLink produces a vless URI");

    await api.deleteClient(1, uuid);
    const after = await api.getClientTraffic(email);
    assert(after === null, "deleteClient removed the client");
  } catch (e) {
    console.error(`  ✗ threw:`, (e as Error).message);
    failures++;
  } finally {
    mock.kill();
    await sleep(200);
  }
}

await run("legacy");
await run("clients");

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
