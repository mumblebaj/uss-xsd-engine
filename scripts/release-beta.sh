#!/usr/bin/env bash
set -euo pipefail

echo "==> Checking working tree"
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "==> Current branch: ${CURRENT_BRANCH}"

echo "==> Pulling latest changes"
git pull --rebase

echo "==> Bumping beta version"
NEW_VERSION="$(npm version prerelease --preid=beta)"
echo "==> New version: ${NEW_VERSION}"

echo "==> Building package"
npm run build

echo "==> Adding build outputs"
git add .

echo "==> Amending version commit with build artifacts"
git commit --amend --no-edit

echo "==> Pushing commit and tags"
git push
git push --tags

echo "==> Publishing to npm with beta tag"
npm publish --tag beta

echo "==> Done: ${NEW_VERSION} published as beta"