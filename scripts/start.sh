#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# prefer vendored static ffmpeg if present (no sudo required)
export PATH="$(pwd)/vendor:$PATH"

echo "[start.sh] cwd: $(pwd)"
echo "[start.sh] PATH starts with: ${PATH%%:*}..."

# Ensure python3 is present
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found on instance. Ensure python3 is installed."
  exit 1
fi

# Prefer vendored ffmpeg (if built into vendor/)
if command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg found: $(command -v ffmpeg)"
else
  echo "WARNING: ffmpeg not found in PATH. Audio processing may fail."
fi

# ---- venv selection/activation (prefer build-time venv) ----
ACTIVATE_PATH=""
# prefer the build-time venv that EB might create at /var/app/venv/*
for f in /var/app/venv/*/bin/activate; do
  if [ -f "$f" ]; then
    ACTIVATE_PATH="$f"
    break
  fi
done

if [ -n "$ACTIVATE_PATH" ]; then
  echo "Activating build venv from $ACTIVATE_PATH"
  # shellcheck disable=SC1090
  source "$ACTIVATE_PATH"
elif [ -f "./venv/bin/activate" ]; then
  echo "Activating repo venv ./venv"
  # shellcheck disable=SC1090
  source ./venv/bin/activate
else
  echo "No existing venv found — creating ./venv and installing requirements (this may take a while)"
  python3 -m venv venv
  # shellcheck disable=SC1090
  source ./venv/bin/activate
  pip install --upgrade pip setuptools wheel
  pip install -r requirements.txt
fi

# Export venv bin first so Node subprocesses find the venv python
export PATH="$(pwd)/venv/bin:$PATH"
echo "[start.sh] final PATH starts with: ${PATH%%:*}"

# Start Node backend (do NOT run npm install here - build should provide node_modules)
echo "Starting backend..."
# If you packaged backend/api/node_modules during build, just start:
npm --prefix backend/api run start:prod
