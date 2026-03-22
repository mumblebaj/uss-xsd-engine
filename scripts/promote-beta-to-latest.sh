#!/usr/bin/env bash
set -euo pipefail

PACKAGE_NAME="${1:-uss-xsd-engine}"

VERSION="$(node -p "require('./package.json').version")"

echo "==> Promoting ${PACKAGE_NAME}@${VERSION} to latest"
npm dist-tag add "${PACKAGE_NAME}@${VERSION}" latest

echo "==> Current dist-tags"
npm dist-tag ls "${PACKAGE_NAME}"