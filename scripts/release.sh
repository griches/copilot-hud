#!/bin/bash
#
# release.sh — bump version, build, commit, tag, push, and publish a GitHub release
# in one shot, keeping package.json, plugin.json, and both marketplace manifests in
# sync so the Releases page never lags behind main.
#
# Usage:
#   scripts/release.sh <version>        e.g. scripts/release.sh 1.3.3
#   scripts/release.sh patch|minor|major
#   scripts/release.sh patch -n "Custom release notes here"
#
# Without -n, release notes are auto-generated from commits since the last tag.

set -euo pipefail

# --- locate repo root (script lives in scripts/) ---
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- files that carry the plugin version ---
VERSION_FILES=(
  "package.json"
  "plugin.json"
  ".github/plugin/marketplace.json"
  ".claude-plugin/marketplace.json"
)

# --- parse args ---
BUMP="${1:-}"
NOTES=""
if [ "${2:-}" = "-n" ]; then NOTES="${3:-}"; fi
if [ -z "$BUMP" ]; then
  echo "usage: scripts/release.sh <version|patch|minor|major> [-n \"notes\"]" >&2
  exit 1
fi

# --- preflight ---
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit or stash first." >&2
  exit 1
fi
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "✗ not on main (on '$BRANCH'). Releases are cut from main." >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo "✗ gh is not authenticated — run 'gh auth login'." >&2
  exit 1
fi

# --- current version (source of truth: package.json) ---
CUR="$(grep -m1 '"version"' package.json | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
IFS=. read -r MA MI PA <<< "$CUR"

case "$BUMP" in
  major) NEW="$((MA + 1)).0.0" ;;
  minor) NEW="${MA}.$((MI + 1)).0" ;;
  patch) NEW="${MA}.${MI}.$((PA + 1))" ;;
  [0-9]*.[0-9]*.[0-9]*) NEW="$BUMP" ;;
  *) echo "✗ invalid version/bump: '$BUMP'" >&2; exit 1 ;;
esac

TAG="v${NEW}"
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "✗ tag $TAG already exists." >&2
  exit 1
fi

echo "▸ Releasing $CUR → $NEW"

# --- bump version in each file (match the OLD plugin version exactly so the
#     separate marketplace-metadata versions are left untouched) ---
for f in "${VERSION_FILES[@]}"; do
  if grep -q "\"version\": \"$CUR\"" "$f"; then
    sed -i '' "s/\"version\": \"$CUR\"/\"version\": \"$NEW\"/" "$f"
    echo "  updated $f"
  else
    echo "  ⚠ $f has no \"version\": \"$CUR\" — left unchanged" >&2
  fi
done

# --- build so the committed dist/ matches the release ---
echo "▸ Building"
npm run build >/dev/null

# --- commit, tag, push ---
echo "▸ Committing + tagging"
git add -A
git commit -q -m "Release $TAG"
git tag -a "$TAG" -m "$TAG"
git push -q origin main
git push -q origin "$TAG"

# --- publish GitHub release ---
echo "▸ Publishing GitHub release"
if [ -n "$NOTES" ]; then
  gh release create "$TAG" --verify-tag --title "$TAG" --notes "$NOTES"
else
  gh release create "$TAG" --verify-tag --title "$TAG" --generate-notes
fi

echo "✓ Released $TAG"
