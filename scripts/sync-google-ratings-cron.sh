#!/usr/bin/env bash
# Cron wrapper for the Google ratings sync.
# Rates one airport per invocation (--next): never-fetched airports first
# (busiest first), then refreshes ratings older than 30 days. Guarded by its
# own flock so runs never overlap. Cheap (one ScrapingBee call), so hourly is
# fine; it exits immediately when everything is fresh.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/sync-google-ratings.lock \
  pnpm sync:ratings --next
