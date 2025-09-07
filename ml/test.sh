#!/usr/bin/env bash
set -euo pipefail

IMG_PATH="${1:-}"
SERVER="${2:-http://localhost:8000}"
if [ -z "$IMG_PATH" ]; then
  echo "usage: bash test.sh ./data/sample_02.png [http://localhost:8000]" >&2
  exit 1
fi

# Health check
HEALTH=$(curl -s "$SERVER/health" || true)
if ! echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "Server not healthy at $SERVER. Got: $HEALTH" >&2
  exit 1
fi

MIME=$(file -b --mime-type "$IMG_PATH" 2>/dev/null || echo image/png)
B64=$(base64 < "$IMG_PATH" | tr -d '\n')

curl -s -X POST "$SERVER/predict_b64" \
  -H 'Content-Type: application/json' \
  -d "{\"image_b64\":\"data:$MIME;base64,$B64\"}"