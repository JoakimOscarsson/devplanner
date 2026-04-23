#!/usr/bin/env sh
set -eu

SERVICES="gateway graph-service planner-service tracker-service recommendation-service mcp-service web"
HOST_PNPM_STORE="$(corepack pnpm store path)"

echo "Installing workspace dependencies and building shared packages in the Docker demo volume..."
docker compose run --rm -T \
  -v "$HOST_PNPM_STORE:/pnpm-store/v10" \
  workspace-deps \
  sh -se <<'DOCKER_SH'
corepack enable
pnpm install --prefer-offline --network-concurrency=1 --store-dir /pnpm-store

# Vite 8 uses Rolldown, which has platform-specific optional packages. When
# reusing a host pnpm store for Docker, make sure the Alpine/Linux binding is
# actually populated in the shared Docker node_modules volume.
ROLLDOWN_VERSION="$(node - <<'NODE'
const fs = require("node:fs");
const lockfile = fs.readFileSync("pnpm-lock.yaml", "utf8");
const match = [...lockfile.matchAll(/^\s{2}'?rolldown@([^':]+)'?:/gm)][0];
process.stdout.write(match?.[1] ?? "");
NODE
)"

case "$(node -p 'process.arch')" in
  arm64) ROLLDOWN_ARCH="arm64" ;;
  x64) ROLLDOWN_ARCH="x64" ;;
  *) ROLLDOWN_ARCH="" ;;
esac

if [ -n "$ROLLDOWN_VERSION" ] && [ -n "$ROLLDOWN_ARCH" ]; then
  BINDING_NAME="@rolldown/binding-linux-${ROLLDOWN_ARCH}-musl"
  PACKAGE_DIR="/workspace/node_modules/.pnpm/$(printf '%s' "${BINDING_NAME}@${ROLLDOWN_VERSION}" | sed 's#/#+#')"
  BINDING_FILE="${PACKAGE_DIR}/node_modules/${BINDING_NAME}/rolldown-binding.linux-${ROLLDOWN_ARCH}-musl.node"

  if [ ! -f "$BINDING_FILE" ]; then
    pnpm store add "${BINDING_NAME}@${ROLLDOWN_VERSION}" --store-dir /pnpm-store
    rm -rf "$PACKAGE_DIR"
    pnpm install --offline --store-dir /pnpm-store
  fi
fi

pnpm build:packages
DOCKER_SH

docker compose up -d postgres nats

if docker compose ps --services --status running | grep -q '^web$'; then
  echo "Refreshing running demo services..."
  docker compose restart $SERVICES
else
  echo "Starting demo services..."
  docker compose up -d --no-deps $SERVICES
fi

echo "Demo refresh complete. Browser refresh should now show the latest version."
