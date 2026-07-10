#!/usr/bin/env bash
# Cron wrapper for the water-options backfill (pi CLI + GPT 5.6).
# Fills one guide per invocation (--next): majors by traffic rank first, then
# the stalest remaining guides. Guarded by its own flock so runs never
# overlap; exits immediately once every guide has water options.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/sync-water-options.lock \
  pnpm sync:water --next
