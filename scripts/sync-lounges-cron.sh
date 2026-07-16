#!/usr/bin/env bash
# Cron wrapper for the lounge directory enrichment (pi CLI + GPT 5.6).
# Verifies one airport per invocation (--next): unverified airports first
# (majors by traffic rank), then anything past the freshness window — a
# perpetual re-verification loop, so it never exits for good. Guarded by its
# own flock so runs never overlap.
set -euo pipefail

export PATH="/home/m/.nvm/versions/node/v22.20.0/bin:/usr/local/bin:/usr/bin:/bin"

cd /home/m/honestairport
exec flock -n /tmp/sync-lounges.lock \
  pnpm sync:lounges --next
