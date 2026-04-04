#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
BRANCH="${BRANCH:-main}"
NODE_ENV="${NODE_ENV:-production}"
RUN_SEED="${RUN_SEED:-false}"
DEPLOY_MODE="${DEPLOY_MODE:-pm2}"
PM2_APP_NAME="${PM2_APP_NAME:-personal-assistant-gateway}"
APP_PORT="${APP_PORT:-3000}"
SYSTEMD_SERVICE="${SYSTEMD_SERVICE:-}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command git
require_command npm

cd "$APP_DIR"

log "Syncing branch $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

log "Installing dependencies"
npm ci

log "Running database migrations"
mkdir -p data
npm run db:migrate

if [[ "$RUN_SEED" == "true" ]]; then
  log "Running seed"
  npm run db:seed
fi

log "Building application"
NODE_ENV="$NODE_ENV" npm run build

case "$DEPLOY_MODE" in
  pm2)
    require_command pm2
    if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
      log "Reloading PM2 process $PM2_APP_NAME"
      pm2 restart "$PM2_APP_NAME" --update-env
    else
      log "Starting PM2 process $PM2_APP_NAME"
      pm2 start npm --name "$PM2_APP_NAME" -- run start -- --port "$APP_PORT"
    fi
    pm2 save
    ;;
  systemd)
    if [[ -z "$SYSTEMD_SERVICE" ]]; then
      echo "SYSTEMD_SERVICE must be set when DEPLOY_MODE=systemd" >&2
      exit 1
    fi
    log "Restarting systemd service $SYSTEMD_SERVICE"
    sudo systemctl restart "$SYSTEMD_SERVICE"
    sudo systemctl status "$SYSTEMD_SERVICE" --no-pager
    ;;
  none)
    log "Skipping process restart because DEPLOY_MODE=none"
    ;;
  *)
    echo "Unsupported DEPLOY_MODE: $DEPLOY_MODE" >&2
    exit 1
    ;;
esac

log "Deployment complete"
