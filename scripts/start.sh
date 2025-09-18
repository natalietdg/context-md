#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# prefer vendored static ffmpeg if present (no sudo required)
export PATH="$(pwd)/vendor:$PATH"

# Ensure python3 is present
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found on instance. Ensure python3 is installed."
  exit 1
fi

# Ensure ffmpeg is present for audio processing
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ffmpeg not found. Audio processing may fail."
fi

# ---- venv selection/activation (prefer build-time venv) ----
if ls /var/app/venv/*/bin/activate >/dev/null 2>&1; then
  echo "Activating build venv from /var/app/venv/"
  source /var/app/venv/*/bin/activate
elif [ -f "./venv/bin/activate" ]; then
  echo "Activating repo venv ./venv"
  source ./venv/bin/activate
else
  echo "No existing venv found — creating ./venv and installing requirements"
  python3 -m venv venv
  source ./venv/bin/activate
  pip install --upgrade pip setuptools wheel
  pip install -r requirements.txt
fi

# Export venv bin first so Node subprocesses find the venv python
export PATH="$(pwd)/venv/bin:$PATH"

# Start Node backend (adjust the script name if yours differs)
echo "Starting backend..."
npm --prefix backend/api install --no-audit --no-fund
npm --prefix backend/api run start:prod
