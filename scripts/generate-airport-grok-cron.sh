#!/usr/bin/env bash
# Cron wrapper for the grok-powered airport guide generator.
# Runs one airport per invocation (--next), guarded by flock so runs
# never overlap even if a research session takes longer than the interval.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/home/m/.grok/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/generate-airport-grok.lock \
  pnpm generate:airport:grok --next
