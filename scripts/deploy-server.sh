#!/usr/bin/env bash
# Laptop ERP backend deploy (server par chalta hai). Istemaal:
#   bash /production/laptop-erp/src/scripts/deploy-server.sh [branch]   (default: develop)
# Har deploy se pehle sirf is ERP ke database ka backup /root/backups/laptop-erp/ mein jata hai.
set -euo pipefail

BRANCH="${1:-develop}"
APP=/production/laptop-erp/src
BACKUPS=/root/backups/laptop-erp
cd "$APP"

echo "== 1/5 Database backup"
mkdir -p "$BACKUPS"
DB=$(grep -E '^DB_DATABASE=' backend/.env | cut -d= -f2-)
USER_=$(grep -E '^DB_USERNAME=' backend/.env | cut -d= -f2-)
PASS=$(grep -E '^DB_PASSWORD=' backend/.env | cut -d= -f2-)
STAMP=$(date +%Y%m%d-%H%M%S)
MYSQL_PWD="$PASS" mysqldump -u "$USER_" --single-transaction --no-tablespaces "$DB" | gzip > "$BACKUPS/$DB-$STAMP.sql.gz"
ls -1t "$BACKUPS"/*.sql.gz | tail -n +31 | xargs -r rm -f   # aakhri 30 backups rakhte hain
echo "   $BACKUPS/$DB-$STAMP.sql.gz ($(du -h "$BACKUPS/$DB-$STAMP.sql.gz" | cut -f1))"

echo "== 2/5 Code ($BRANCH)"
git fetch --prune origin
git checkout -q "$BRANCH"
git reset -q --hard "origin/$BRANCH"
git log --oneline -1

echo "== 3/5 Composer"
cd backend
composer install --no-dev --optimize-autoloader --no-interaction --quiet

echo "== 4/5 Migrate + cache"
php artisan down --retry=15 || true
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan up
chown -R www-data:www-data storage bootstrap/cache

echo "== 5/5 Health"
curl -s -o /dev/null -w "   api/me: %{http_code} (401 = theek)\n" -H "Accept: application/json" https://app.novastackhub.com/api/v1/me
curl -s -w "   health: %{http_code}\n" -o /dev/null https://app.novastackhub.com/api/v1/health
echo "Done."
