#!/usr/bin/env bash
# Cron wrapper for the airport image sync pipeline.
# Fills one airport per invocation (--next), guarded by its own flock so
# image runs never overlap each other. Runs offset from the guide generator
# cron; grok curation here is short, so overlapping with a guide research
# session is fine.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/home/m/.grok/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/sync-airport-images.lock \
  pnpm sync:images --next
