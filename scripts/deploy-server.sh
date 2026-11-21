#!/usr/bin/env bash
# Laptop ERP deploy: backend + frontend (server par chalta hai). Istemaal:
#   bash /production/laptop-erp/src/scripts/deploy-server.sh [branch]   (default: develop)
#   SKIP_FRONTEND=1 bash ...   sirf backend
# - Har deploy se pehle sirf is ERP ke database ka backup /root/backups/laptop-erp/ mein jata hai.
# - Frontend ki build server par hoti hai, ERP ke apne Node 22 se (/production/laptop-erp/.node).
#   Server ka system Node aur doosri sites ko nahi chhedta.
# - PrimeUI license: /production/laptop-erp/primeui-license.ts (GitHub par nahi jati).
set -euo pipefail

BRANCH="${1:-develop}"
APP=/production/laptop-erp/src
BACKUPS=/root/backups/laptop-erp
cd "$APP"

echo "== 1/6 Database backup"
mkdir -p "$BACKUPS"
DB=$(grep -E '^DB_DATABASE=' backend/.env | cut -d= -f2-)
USER_=$(grep -E '^DB_USERNAME=' backend/.env | cut -d= -f2-)
PASS=$(grep -E '^DB_PASSWORD=' backend/.env | cut -d= -f2-)
STAMP=$(date +%Y%m%d-%H%M%S)
MYSQL_PWD="$PASS" mysqldump -u "$USER_" --single-transaction --no-tablespaces "$DB" | gzip > "$BACKUPS/$DB-$STAMP.sql.gz"
ls -1t "$BACKUPS"/*.sql.gz | tail -n +31 | xargs -r rm -f   # aakhri 30 backups rakhte hain
echo "   $BACKUPS/$DB-$STAMP.sql.gz ($(du -h "$BACKUPS/$DB-$STAMP.sql.gz" | cut -f1))"

echo "== 2/6 Code ($BRANCH)"
git fetch --prune origin
git checkout -q "$BRANCH"
git reset -q --hard "origin/$BRANCH"
git log --oneline -1

echo "== 3/6 Composer"
cd backend
composer install --no-dev --optimize-autoloader --no-interaction --quiet

echo "== 4/6 Migrate + cache"
php artisan down --retry=15 || true
php artisan migrate --force
php artisan db:seed --class=RoleSeeder --force   # system roles ki permissions naye keys ke saath
php artisan config:cache
php artisan route:cache
php artisan up
chown -R www-data:www-data storage bootstrap/cache

echo "== 5/6 Frontend"
if [ "${SKIP_FRONTEND:-0}" = "1" ]; then
  echo "   skipped"
else
  ROOT=/production/laptop-erp
  NODE_DIR=$ROOT/.node
  if [ ! -x "$NODE_DIR/bin/node" ] || ! "$NODE_DIR/bin/node" -v | grep -q '^v22\.'; then
    echo "   Node 22 install ho raha hai ($NODE_DIR)"
    FILE=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | awk '/linux-x64.tar.xz$/ {print $2}')
    SUM=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt | awk '/linux-x64.tar.xz$/ {print $1}')
    curl -fsSL -o /tmp/node22.tar.xz "https://nodejs.org/dist/latest-v22.x/$FILE"
    echo "$SUM  /tmp/node22.tar.xz" | sha256sum -c --quiet
    rm -rf "$NODE_DIR" && mkdir -p "$NODE_DIR"
    tar -xJf /tmp/node22.tar.xz -C "$NODE_DIR" --strip-components=1 && rm -f /tmp/node22.tar.xz
  fi
  export PATH="$NODE_DIR/bin:$PATH"
  echo "   node $(node -v), npm $(npm -v)"
  cd "$APP"
  if [ -f "$ROOT/primeui-license.ts" ]; then
    cp "$ROOT/primeui-license.ts" src/app/core/config/primeui-license.ts
  else
    echo "   NOTE: $ROOT/primeui-license.ts nahi mili (PrimeUI license warning aayegi)"
  fi
  npm ci --no-audit --no-fund --loglevel=error
  npx ng build --no-progress | tail -4
  git checkout -q -- src/app/core/config/primeui-license.ts
  OUT="$APP/dist/erp-web/browser"
  [ -f "$OUT/index.html" ] || { echo "   Build output nahi mila"; exit 1; }
  rm -rf "$ROOT/frontend/browser.next" "$ROOT/frontend/browser.prev"
  cp -r "$OUT" "$ROOT/frontend/browser.next"
  chown -R www-data:www-data "$ROOT/frontend/browser.next"
  mv "$ROOT/frontend/browser" "$ROOT/frontend/browser.prev"
  mv "$ROOT/frontend/browser.next" "$ROOT/frontend/browser"
  echo "   frontend live ($(ls "$ROOT/frontend/browser" | wc -l) files; pichla: frontend/browser.prev)"
  cd "$APP/backend"
fi

echo "== 6/6 Health"
curl -s -o /dev/null -w "   api/me: %{http_code} (401 = theek)\n" -H "Accept: application/json" https://app.novastackhub.com/api/v1/me
curl -s -w "   health: %{http_code}\n" -o /dev/null https://app.novastackhub.com/api/v1/health
curl -s https://app.novastackhub.com/ | grep -o '<title>[^<]*</title>' | sed 's/^/   app: /'
echo "Done."
