#!/usr/bin/env bash
# Weekly cron wrapper for the lounge photo sweeps: Wikimedia Commons first
# (grok/pi assignment -> Vercel Blob), then the press-kit pass, which only
# touches lounges still photo-less afterwards. Airports and lounges without
# findable photos are skipped, not retried in a loop, so a weekly cadence
# keeps new lounges covered without churn.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/sync-lounge-images.lock \
  bash -c 'pnpm sync:lounge-images --all; pnpm sync:lounge-press --all'
