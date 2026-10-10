#!/bin/sh
# Mirror confirmation (WP-30). This repository does not push to GitHub. The nightly weg-ghpages-mirror CronJob (nebula,
# tools/weg-ghpages-mirror) copies GitLab gh-pages to GitHub gh-pages as a fast-forward with its own short-lived GitHub App token,
# and worldenterprise is on its allowlist. So no GitHub credential exists in this project and nothing here can overwrite GitHub.
# This script only reads: it asks the public GitHub repository for its gh-pages head and succeeds when it is the commit this pipeline
# is for. It exits 1 in every other state (not mirrored yet, GitHub ahead, diverged, unreadable, no branch), so the job never reports
# a release that did not land. Re-run the job after the mirror has run.
#
# Environment: GITHUB_REPO (owner/name), CI_COMMIT_SHA. MIRROR_REMOTE_URL overrides the remote and exists for the unit tests.
# POSIX sh: the mirror image is alpine/git.
set -eu

repo="${GITHUB_REPO:-}"
commit="${CI_COMMIT_SHA:-}"

if [ -z "${repo}" ]; then
  echo "mirror: GITHUB_REPO is not set." >&2
  exit 1
fi
case "${repo}" in
  */*/* | */ | /* | *[!A-Za-z0-9_./-]*)
    echo "mirror: GITHUB_REPO must look like owner/name." >&2
    exit 1
    ;;
  */*) ;;
  *)
    echo "mirror: GITHUB_REPO must look like owner/name." >&2
    exit 1
    ;;
esac
if [ -z "${commit}" ]; then
  echo "mirror: CI_COMMIT_SHA is not set." >&2
  exit 1
fi

url="${MIRROR_REMOTE_URL:-https://github.com/${repo}.git}"

# No credentials are configured and none may be asked for: a private or missing repository fails here instead of waiting for input.
if ! listing="$(GIT_TERMINAL_PROMPT=0 git ls-remote "${url}" refs/heads/gh-pages 2>&1)"; then
  echo "mirror: could not read gh-pages from ${url}." >&2
  echo "mirror: ${listing}" >&2
  echo "mirror: the repository must be readable without credentials for this check." >&2
  exit 1
fi

remote="$(printf '%s\n' "${listing}" | awk '$2 == "refs/heads/gh-pages" { print $1 }')"

if [ -z "${remote}" ]; then
  echo "mirror: GitHub has no gh-pages branch yet. The nightly mirror (03:23 UTC) creates it only as a fast-forward of an existing one." >&2
  exit 1
fi

if [ "${remote}" = "${commit}" ]; then
  echo "mirror: GitHub gh-pages is at ${commit}. The release has been mirrored."
  exit 0
fi

if git cat-file -e "${remote}^{commit}" 2>/dev/null; then
  if git merge-base --is-ancestor "${remote}" "${commit}"; then
    echo "mirror: not mirrored yet. GitHub gh-pages is at ${remote}, behind this pipeline's ${commit}." >&2
    echo "mirror: the weg-ghpages-mirror CronJob runs daily at 03:23 UTC. Run this job again after it has run." >&2
    exit 1
  fi
  if git merge-base --is-ancestor "${commit}" "${remote}"; then
    echo "mirror: GitHub gh-pages (${remote}) is ahead of this pipeline's ${commit}. This pipeline is not the latest gh-pages." >&2
    exit 1
  fi
fi

echo "mirror: DIVERGED. GitHub gh-pages (${remote}) is not an ancestor of ${commit}, so the mirror will refuse to update it." >&2
echo "mirror: resolve it with a forward commit on GitLab gh-pages. Never force-push." >&2
exit 1
