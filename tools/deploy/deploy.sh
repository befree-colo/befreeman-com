#!/usr/bin/env bash
# Deploy befreeman.com from the operator's workstation (design D1 of openspec change deploy-to-cloudflare).
#
#   tools/deploy/deploy.sh <staging|production> [--all]
#
# Deploys the checked-out commit. To deploy a specific commit, check it out first.
# --all releases every part: use it for the first deploy to an environment and after a rollback.
# Needs: a clean tree whose HEAD is on origin/main, `wrangler login`, and that environment's
# PREVIEW_SECRET exported from the password manager. See docs/operations.md.
set -euo pipefail

# Not secrets. Replace the subdomain once the Cloudflare account exists (dashboard → Workers & Pages).
STAGING_URL="https://befreeman-edge-staging.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev"
# Switch to https://befreeman.com once the custom domains are attached (tasks.md 6.4).
PRODUCTION_URL="https://befreeman-edge.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev"

die() {
  echo "deploy: $*" >&2
  exit 1
}
usage() { die "usage: tools/deploy/deploy.sh <staging|production> [--all]"; }

env_name="${1:-}"
[ $# -gt 0 ] && shift
case "$env_name" in
  staging) base_url="$STAGING_URL" ;;
  production) base_url="$PRODUCTION_URL" ;;
  *) usage ;;
esac
release_args=(--remote --env "$env_name" --base-url "$base_url")
while [ $# -gt 0 ]; do
  case "$1" in
    --all) release_args+=(--all) ;;
    *) usage ;;
  esac
  shift
done

root="$(git rev-parse --show-toplevel)"
cd "$root"

# --- Guards: all run before anything is built or published. ---

[ -z "$(git status --porcelain)" ] || die "the working tree has uncommitted changes; commit or stash them first"

git fetch --quiet origin main || die "could not fetch origin/main"
head_sha="$(git rev-parse HEAD)"
git merge-base --is-ancestor "$head_sha" origin/main ||
  die "commit ${head_sha:0:7} is not on origin/main; only reviewed, pushed commits are deployed"

[ -n "${PREVIEW_SECRET:-}" ] || die "PREVIEW_SECRET is not set; export the ${env_name} value from the password manager"

case "$base_url" in
  *REPLACE_WITH_*) die "set the ${env_name} URL at the top of tools/deploy/deploy.sh first" ;;
esac

want_node="$(tr -d '[:space:]v' <.nvmrc)"
have_node="$(node --version | tr -d 'v')"
if [ "${have_node%%.*}" != "${want_node%%.*}" ] ||
  [ "$(printf '%s\n%s\n' "$want_node" "$have_node" | sort -V | head -n1)" != "$want_node" ]; then
  die "node ${have_node} does not match .nvmrc (${want_node}: same major, same or newer)"
fi

want_pnpm="$(node -p "require('./package.json').packageManager.split('@')[1]")"
have_pnpm="$(pnpm --version)"
[ "$have_pnpm" = "$want_pnpm" ] || die "pnpm ${have_pnpm} does not match packageManager (${want_pnpm})"

whoami_out="$(cd apps/edge && pnpm exec wrangler whoami 2>&1)" || die "wrangler whoami failed: ${whoami_out}"
case "$whoami_out" in
  *"not authenticated"*) die "Wrangler is not logged in; run: (cd apps/edge && pnpm exec wrangler login)" ;;
esac

# --- Deploy. ---

echo "deploy: ${env_name} ← ${head_sha:0:7} (${base_url})"
pnpm release deploy "${release_args[@]}"

if [ "$env_name" = "staging" ]; then
  echo "deploy: running the Playwright suite against ${base_url}"
  (cd apps/e2e && E2E_BASE_URL="$base_url" pnpm exec playwright test)
  pnpm release mark-verified --remote --env staging
fi

# --- Audit trail. Tag pushes trigger no pipelines in this repo. ---

tag="deployed/${env_name}/$(date -u +%Y%m%d-%H%M%S)"
git tag "$tag" "$head_sha"
if git push --quiet origin "refs/tags/${tag}"; then
  echo "deploy: done; tagged ${tag}"
else
  echo "deploy: done, but pushing tag ${tag} failed; push it later with: git push origin ${tag}" >&2
fi
