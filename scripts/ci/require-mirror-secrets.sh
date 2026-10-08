#!/bin/sh
# Mirror preflight (code-security P1-3). The Launch Sequence mirror template (jobs/github-mirror.yml) exits 0 with "skipping mirror"
# when GITHUB_REPO or GITHUB_TOKEN is unset, so a pipeline on gh-pages goes green and production is never updated. This guard runs
# first in the mirror job and fails it instead. It prints variable names only, never values.
# POSIX sh: the mirror image is alpine/git.
set -eu

missing=""
for name in GITHUB_REPO GITHUB_TOKEN; do
  eval "value=\${${name}:-}"
  if [ -z "${value}" ]; then
    missing="${missing} ${name}"
  fi
done

if [ -n "${missing}" ]; then
  echo "mirror: refusing to report success without mirroring. Not set:${missing}." >&2
  echo "mirror: set them in GitLab CI/CD variables (GITHUB_TOKEN masked and protected, scoped to gh-pages)." >&2
  exit 1
fi

# The repository name goes into a URL. Accept only owner/name.
case "${GITHUB_REPO}" in
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

# A token with whitespace or a newline would break the remote URL and could print part of itself in an error.
case "${GITHUB_TOKEN}" in
  *[[:space:]]*)
    echo "mirror: GITHUB_TOKEN contains whitespace." >&2
    exit 1
    ;;
esac

echo "mirror: GITHUB_REPO and GITHUB_TOKEN are set."
