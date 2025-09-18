#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Ensure python3 is present
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 not found on instance. Ensure python3 is installed."
  exit 1
fi

# Ensure ffmpeg is present for audio processing
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "WARNING: ffmpeg not found. Audio processing may fail."
  echo "Installing ffmpeg..."
  
  # Try to install ffmpeg based on the system
  if command -v yum >/dev/null 2>&1; then
    # Amazon Linux / CentOS / RHEL
    yum install -y epel-release || amazon-linux-extras install epel -y || true
    yum install -y ffmpeg ffmpeg-devel || {
      echo "Installing static ffmpeg build..."
      cd /tmp
      wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
      tar xf ffmpeg-release-amd64-static.tar.xz
      cp ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/
      cp ffmpeg-*-amd64-static/ffprobe /usr/local/bin/
      chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe
      export PATH="/usr/local/bin:$PATH"
      cd "$(dirname "$0")/.."
    }
  elif command -v apt-get >/dev/null 2>&1; then
    # Ubuntu / Debian
    apt-get update && apt-get install -y ffmpeg
  fi
  
  # Verify ffmpeg installation
  if command -v ffmpeg >/dev/null 2>&1; then
    echo "✅ ffmpeg installed successfully"
  else
    echo "❌ Failed to install ffmpeg. Audio processing will fail."
  fi
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

# Optional: ensure venv has up-to-date packages (comment/uncomment as desired)
# pip install --upgrade pip setuptools wheel
# pip install -r requirements.txt

# Export venv bin first so Node subprocesses find the venv python
export PATH="$(pwd)/venv/bin:$PATH"

# Start Node backend (adjust the script name if yours differs)
echo "Starting backend..."
npm --prefix backend/api install --no-audit --no-fund
npm --prefix backend/api run start:prod
