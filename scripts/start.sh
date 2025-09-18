#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure python3 is present
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found on instance. Ensure python3 is installed."
  exit 1
fi

# Create repo-root venv if missing
if [ ! -d "venv" ]; then
  echo "Creating venv at repo root..."
  python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install/upgrade pip and requirements idempotently
pip install --upgrade pip
pip install -r requirements.txt

# Export venv bin first so Node subprocesses find the venv python
export PATH="$(pwd)/venv/bin:$PATH"

# Start Node backend (adjust the script name if yours differs)
echo "Starting backend..."
npm --prefix backend/api run start:prod
