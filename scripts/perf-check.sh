#!/usr/bin/env bash
# Laptop ERP speed check (server par chalao). Sirf parhta hai, kuch nahi badalta.
# bash /production/laptop-erp/src/scripts/perf-check.sh
APP=${APP_URL:-https://app.novastackhub.com}
BACK=/production/laptop-erp/src/backend

echo "== 1. Server load"
uptime
free -m | head -2
nproc | sed 's/^/   CPU cores: /'

echo "== 2. PHP"
php -v | head -1
php -r 'echo "   opcache (cli): ", (function_exists("opcache_get_status") ? "available" : "missing"), PHP_EOL;'
php -i 2>/dev/null | grep -E "^opcache.enable =>|^opcache.memory_consumption" | sed 's/^/   /'
ps -eo comm | grep -c php-fpm | sed 's/^/   php-fpm processes: /'

echo "== 3. Frontend files (gzip + cache)"
MAIN=$(curl -s "$APP/" | grep -o 'main-[A-Za-z0-9_-]*\.js' | head -1)
echo "   main file: $MAIN"
for u in "/" "/$MAIN"; do
  echo "   --- $u"
  curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip, br' "$APP$u" | grep -iE '^(content-encoding|cache-control|content-length):' | sed 's/^/     /'
  curl -s -o /dev/null -H 'Accept-Encoding: gzip, br' -w '     time: %{time_total}s  ttfb: %{time_starttransfer}s  bytes: %{size_download}\n' "$APP$u"
done

echo "== 4. API (health)"
curl -s -o /dev/null -w '   /up  http: %{http_code}  ttfb: %{time_starttransfer}s\n' "$APP/up"

echo "== 5. nginx gzip settings"
grep -rhoE '^\s*(gzip|gzip_types|brotli)[^;]*;' /etc/nginx/nginx.conf /etc/nginx/sites-enabled/ /etc/nginx/conf.d/ 2>/dev/null | sort -u | sed 's/^/   /'

echo "== 6. Laravel"
cd "$BACK" && grep -E '^(APP_ENV|APP_DEBUG|CACHE_STORE|SESSION_DRIVER|QUEUE_CONNECTION|LOG_LEVEL)=' .env | sed 's/^/   /'
php artisan perf:probe
