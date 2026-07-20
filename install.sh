#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  V2Ray Config Shop — one-command installer for Ubuntu/Debian
#  Usage:  bash install.sh
#  Re-run safe: skips finished steps, keeps existing data/.env
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
die()  { echo -e "${RED}==>${NC} $1"; exit 1; }

[ -f package.json ] || die "Run this from the project root (where package.json is)."

# ── 1. Node.js 20+ ──
if ! command -v node >/dev/null 2>&1 || [ "$(node -e 'console.log(process.versions.node.split(".")[0])')" -lt 20 ]; then
  say "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  say "Node.js $(node -v) found"
fi

# ── 2. PM2 ──
if ! command -v pm2 >/dev/null 2>&1; then
  say "Installing PM2..."
  sudo npm i -g pm2
else
  say "PM2 found"
fi

# ── 3. Dependencies ──
say "Installing npm dependencies..."
npm install

# ── 4. .env wizard ──
if [ ! -f .env ]; then
  say "Configuring .env — answer a few questions (you can change everything later in the admin settings page):"
  read -rp "  Admin username [admin]: " ADMIN_USER; ADMIN_USER=${ADMIN_USER:-admin}
  while true; do
    read -rsp "  Admin password (min 8 chars): " ADMIN_PASS; echo
    [ ${#ADMIN_PASS} -ge 8 ] && break || warn "  Too short, try again."
  done
  read -rp "  3x-ui panel URL incl. base path (e.g. https://1.2.3.4:2053/AbCdEf): " XUI_PANEL_URL
  read -rp "  3x-ui panel username: " XUI_PANEL_USER
  read -rsp "  3x-ui panel password: " XUI_PANEL_PASS; echo
  read -rp "  Panel uses self-signed TLS? [Y/n]: " INSECURE; INSECURE=${INSECURE:-Y}
  read -rp "  Subscription base URL (e.g. https://1.2.3.4:2096/sub): " XUI_SUB_BASE
  read -rp "  Public server address for vless links (IP or domain): " XUI_PUBLIC_HOST
  read -rp "  Site port [3000]: " PORT; PORT=${PORT:-3000}

  cat > .env <<EOF
PORT=$PORT
ADMIN_USER=$ADMIN_USER
ADMIN_PASS=$ADMIN_PASS
XUI_PANEL_URL=$XUI_PANEL_URL
XUI_PANEL_USER=$XUI_PANEL_USER
XUI_PANEL_PASS=$XUI_PANEL_PASS
XUI_INSECURE_TLS=$([ "${INSECURE^^}" = "Y" ] && echo 1 || echo 0)
XUI_SUB_BASE=$XUI_SUB_BASE
XUI_PUBLIC_HOST=$XUI_PUBLIC_HOST
EOF
  say ".env written"
else
  say ".env already exists — keeping it"
fi

# ── 5. Database + admin user ──
say "Setting up database..."
set -a; source .env; set +a
npm run db:seed

# ── 6. Build ──
say "Building the site (this takes a minute)..."
npm run build

# ── 7. PM2 start ──
say "Starting with PM2..."
pm2 delete vpn-shop >/dev/null 2>&1 || true
pm2 start deploy/ecosystem.config.js
pm2 save
sudo env PATH=$PATH pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null 2>&1 || warn "pm2 startup needs manual run: sudo pm2 startup"

# ── 8. Optional nginx ──
read -rp "Configure nginx as reverse proxy? [y/N]: " NGX
if [ "${NGX:-N}" = "y" ] || [ "${NGX:-N}" = "Y" ]; then
  command -v nginx >/dev/null 2>&1 || sudo apt-get install -y nginx
  read -rp "  Your domain: " DOMAIN
  if [ -n "${DOMAIN:-}" ]; then
    sudo sed "s/YOUR_DOMAIN/$DOMAIN/g; s/127.0.0.1:3000/127.0.0.1:${PORT:-3000}/g" deploy/nginx.conf | sudo tee /etc/nginx/sites-available/vpn-shop >/dev/null
    sudo ln -sf /etc/nginx/sites-available/vpn-shop /etc/nginx/sites-enabled/vpn-shop
    warn "For SSL run:  sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d $DOMAIN"
    sudo nginx -t && sudo systemctl reload nginx || warn "nginx config test failed — fix and reload manually"
  fi
fi

echo
say "✅ Done! Site is running on port ${PORT:-3000}"
say "   1. Open the site and log in as '$ADMIN_USER'"
say "   2. Go to Admin → Settings and click 'Test panel connection'"
say "   3. Create your plans in Admin → Plans (set the inbound ID from the test output)"
