# ⚡ V2Ray Config Shop

A complete, self-hosted online store for selling v2ray/xray configs — fully automated on top of a **[3x-ui (Sanaei)](https://github.com/MHSanaei/3x-ui) panel**, with card-to-card payment, instant delivery, an admin receipt-review queue, and a live public chat room.

Modern, minimal, fully **RTL Persian** UI. Built for running on a single VPS with many concurrent users.

> 🇮🇷 مستندات فارسی: [README.fa.md](./README.fa.md)

## Features

- 🛒 **Storefront** — plans managed from the admin panel: duration, data volume, device limit, price (Toman)
- ⚡ **Instant delivery** — the moment a payment receipt is submitted, a client is created on your 3x-ui panel via its API and the subscription link + QR code are delivered on the spot
- 🧾 **Receipt review queue** — every receipt goes to the admin queue; a fake receipt is revoked with one click (the client is disabled on the panel — reversible if you change your mind)
- 🛡️ **Anti-fraud built in**
  - unique payable amount per order (random few-toman suffix identifies each transfer)
  - duplicate-receipt detection (image hash) and tracking-code reuse detection
  - open-order cap per user; users with a fake-receipt history are auto-flagged
  - flagged orders are **held** for manual review instead of instant delivery
- 💬 **Public chat** — Socket.IO live chat: history, rate limiting, duplicate-message block, admin delete/mute, online counter. Guests read, logged-in users post. Long-polling fallback for restrictive ISPs.
- 📊 **User dashboard** — live usage pulled from the panel, traffic bars, Jalali (Shamsi) expiry dates
- 🎨 Dark minimal design, self-hosted Vazirmatn font, Persian digits everywhere — no foreign CDN dependencies

## Screenshots

| Storefront | Payment | Admin queue |
|---|---|---|
| plan cards + hero | bank card + unique amount + receipt upload | receipt image + flags + approve/revoke |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + custom `server.js` |
| Realtime | Socket.IO (same process) |
| Database | SQLite (better-sqlite3, WAL) + Drizzle ORM |
| Styling | Tailwind CSS v4 (RTL logical properties) |
| Images | sharp — receipts re-encoded (EXIF stripped), stored privately |
| Auth | username/password (scrypt) + DB-backed sessions |

No Redis, no Postgres, no external services — everything runs in one Node process on one VPS. `data/` holds the whole state (DB + receipt images), so backup = copy one folder.

## Quick install (Ubuntu/Debian VPS)

```bash
git clone https://github.com/ReZeRoP/vpn-shop.git
cd vpn-shop
bash install.sh
```

The installer:
1. installs Node.js 22 + PM2 if missing
2. asks a few questions (admin password, 3x-ui panel URL/credentials, subscription URL)
3. creates the database + admin user + a sample plan
4. builds the site and starts it with PM2 (with boot autostart)
5. optionally configures nginx for your domain

Then open the site, log in as admin, go to **Admin → Settings**, click **"Test panel connection"** (it lists your inbounds), and create your plans with the right inbound ID.

<details>
<summary>Manual installation</summary>

```bash
npm install
cp .env.example .env   # fill in panel credentials + admin password
npm run db:seed        # database + admin user + sample plan
npm run build
pm2 start deploy/ecosystem.config.js && pm2 save

# nginx + SSL
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vpn-shop
sudo nano /etc/nginx/sites-available/vpn-shop     # replace YOUR_DOMAIN
sudo ln -s /etc/nginx/sites-available/vpn-shop /etc/nginx/sites-enabled/
sudo certbot --nginx -d YOUR_DOMAIN
```
</details>

## 3x-ui panel requirements

- A running 3x-ui panel (v2.x API — also works on v3) with at least one inbound (e.g. VLESS + REALITY)
- **Subscription enabled** in panel settings (default port 2096) — the shop delivers sub URLs
- The panel URL you configure must **include the random base path**, e.g. `https://1.2.3.4:2053/AbCdEf`
- Self-signed panel certificate? Set `XUI_INSECURE_TLS=1` (or toggle it in admin settings)

## How the purchase flow works

```
user picks plan
   └─▶ payment page: your card number + UNIQUE amount (price + id-suffix) + 45-min window
        └─▶ user uploads transfer receipt
             ├─ clean receipt  ──▶ client created on panel ──▶ sub link + QR delivered instantly
             │                       └─▶ receipt joins admin review queue
             └─ flagged receipt ──▶ HELD, no delivery until admin approves
admin queue:
   ✓ approve        → order finalized (verified)
   ✕ fake receipt   → client disabled on panel, order revoked (reason shown to user, reversible)
   ✕ unclear photo  → user may re-upload a new receipt
```

Order states: `pending_payment → approved → verified | revoked`, plus `held / rejected / expired`.

## Local development

```bash
npm install
npm run db:seed
npm run dev            # http://localhost:3000  (admin / admin123 unless overridden)
```

Test the full purchase flow without a real panel using the bundled mock:

```bash
node scripts/mock-panel.mjs   # fake 3x-ui at http://127.0.0.1:20530/mock (admin/admin)
```

```bash
XUI_PANEL_URL=http://127.0.0.1:20530/mock XUI_PANEL_USER=admin XUI_PANEL_PASS=admin \
XUI_SUB_BASE=http://127.0.0.1:2096/sub XUI_PUBLIC_HOST=example.com npm run dev
```

## Backup

Everything is in `data/`:

```bash
0 4 * * * tar czf /root/backup-$(date +\%F).tar.gz -C /opt/vpn-shop data
```

## License

MIT
