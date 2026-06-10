#!/usr/bin/env bash
# Package the extension into dist/nomoretabs-<version>.zip
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(jq -r .version manifest.json)
mkdir -p dist
rm -f "dist/nomoretabs-$VERSION.zip"

zip -r "dist/nomoretabs-$VERSION.zip" \
  manifest.json \
  background.js \
  tabops.js \
  popup.html popup.js popup.css \
  options.html options.js options.css \
  icons

echo "Built dist/nomoretabs-$VERSION.zip"
