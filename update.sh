#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  V2Ray Config Shop — updater
#  Usage on the server:  bash update.sh
#  Pulls latest code, applies DB migrations, rebuilds, restarts.
#  Your data/ (database + receipts) and .env are never touched.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say()  { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
die()  { echo -e "${RED}==>${NC} $1"; exit 1; }

[ -f package.json ] || die "Run this from the project root."
[ -d .git ] || die "Not a git checkout — reinstall by cloning the repo."

# ── 1. Backup DB first (cheap insurance) ──
if [ -f data/shop.db ]; then
  mkdir -p data/backups
  cp data/shop.db "data/backups/shop-$(date +%Y%m%d-%H%M%S).db"
  # keep last 10 backups
  ls -t data/backups/shop-*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
  say "Database backed up to data/backups/"
fi

# ── 2. Pull latest ──
say "Pulling latest code..."
git fetch origin
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/master)
if [ "$LOCAL" = "$REMOTE" ]; then
  warn "Already up to date ($(git rev-parse --short HEAD))."
  read -rp "Rebuild anyway? [y/N]: " REBUILD
  [ "${REBUILD:-N}" = "y" ] || exit 0
else
  git pull --ff-only origin master
  say "Updated to $(git rev-parse --short HEAD)"
fi

# ── 3. Dependencies + migrations + build ──
say "Installing dependencies..."
npm install
say "Applying database migrations..."
set -a; [ -f .env ] && source .env; set +a
npm run db:seed   # idempotent: applies new migrations, keeps existing data
say "Building..."
npm run build

# ── 4. Restart ──
if command -v pm2 >/dev/null 2>&1 && pm2 describe vpn-shop >/dev/null 2>&1; then
  say "Restarting PM2 process..."
  pm2 restart vpn-shop --update-env
else
  warn "PM2 process 'vpn-shop' not found — start it with: pm2 start deploy/ecosystem.config.js"
fi

say "✅ Update complete."
