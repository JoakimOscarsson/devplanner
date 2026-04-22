#!/usr/bin/env sh
set -eu

SERVICES="gateway graph-service planner-service tracker-service recommendation-service mcp-service web"

echo "Building shared workspace packages..."
corepack pnpm build:packages

if docker compose ps --services --status running | grep -q '^web$'; then
  echo "Refreshing running demo services..."
  docker compose restart $SERVICES
else
  echo "Starting demo services..."
  docker compose up -d $SERVICES
fi

echo "Demo refresh complete. Browser refresh should now show the latest version."
