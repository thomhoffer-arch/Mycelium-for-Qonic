#!/usr/bin/env bash
# Mycelium-for-Qonic — one-click installer
# Usage: bash install.sh
#   or:  curl -fsSL https://raw.githubusercontent.com/thomhoffer-arch/Mycelium-for-Qonic/main/install.sh | bash
set -euo pipefail

REPO="https://github.com/thomhoffer-arch/Mycelium-for-Qonic.git"
DIR="Mycelium-for-Qonic"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Mycelium-for-Qonic  installer      ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ── prereq: Node >= 18 ────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "✗ Node.js not found. Install Node 18+ from https://nodejs.org and re-run." >&2
  exit 1
fi
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node 18+ required (found v$NODE_MAJOR). Upgrade at https://nodejs.org and re-run." >&2
  exit 1
fi
echo "✓ Node $(node --version)"

# ── prereq: npm ──────────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "✗ npm not found. It ships with Node — reinstall Node from https://nodejs.org." >&2
  exit 1
fi
echo "✓ npm $(npm --version)"

# ── clone or update ──────────────────────────────────────────────────────────
if [ -d "$DIR/.git" ]; then
  echo "→ Updating existing clone in ./$DIR ..."
  git -C "$DIR" pull --ff-only
else
  echo "→ Cloning into ./$DIR ..."
  git clone "$REPO" "$DIR"
fi

cd "$DIR"

# ── install deps ──────────────────────────────────────────────────────────────
echo "→ Installing dependencies (npm install)..."
npm install

# ── interactive setup wizard ─────────────────────────────────────────────────
echo ""
node setup.mjs

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  Done!  Run:  node connector.mjs     ║"
echo "╚══════════════════════════════════════╝"
echo ""
