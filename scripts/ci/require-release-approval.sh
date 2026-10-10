#!/bin/sh
# Release approval gate (WP-30). The mirror job on a release tag (decision DP-1) is manual and runs this first. It refuses a branch
# pipeline, a tag not named release-* and a tag that is not protected. It then fails unless the operator has set
# RELEASE_APPROVED to the commit being released: the full CI_COMMIT_SHA, or a prefix of at least 12 hex characters. A bare "true"
# is refused on purpose: a project-level variable left at "true" would approve every later release without anyone looking at it,
# and a SHA ties the approval to exactly the content that was reviewed. It prints variable names and SHAs only.
# POSIX sh: the mirror image is alpine/git.
set -eu

approved="${RELEASE_APPROVED:-}"
commit="${CI_COMMIT_SHA:-}"
tag="${CI_COMMIT_TAG:-}"

if [ -z "${commit}" ]; then
  echo "release: CI_COMMIT_SHA is not set, so there is nothing to approve." >&2
  exit 1
fi

# Release N ships from a tag (decision DP-1), never from a branch: a branch moves while the release is being approved.
if [ -n "${CI_COMMIT_BRANCH:-}" ] || [ -z "${tag}" ]; then
  echo "release: refused. A release is approved from a tag named release-*, not from a branch." >&2
  echo "release: this pipeline is at ${commit} on branch \"${CI_COMMIT_BRANCH:-none}\", tag \"${tag:-none}\"." >&2
  exit 1
fi
case "${tag}" in
  release-?*) ;;
  *)
    echo "release: refused. The tag ${tag} is not named release-*." >&2
    exit 1
    ;;
esac
# Only maintainers can create a protected tag, and protected CI variables reach only protected refs.
if [ "${CI_COMMIT_REF_PROTECTED:-}" != "true" ]; then
  echo "release: refused. The tag ${tag} is not protected. Protect release-* (Settings, Repository, Protected tags) and tag again." >&2
  exit 1
fi

if [ -z "${approved}" ]; then
  echo "release: blocked. RELEASE_APPROVED is not set." >&2
  echo "release: the owner approves by running this manual job with RELEASE_APPROVED=<commit sha being released>." >&2
  echo "release: this pipeline is at ${commit}." >&2
  exit 1
fi

case "${approved}" in
  *[!0-9a-f]*)
    echo "release: RELEASE_APPROVED must be a lowercase hex commit SHA (a value such as \"true\" is not accepted)." >&2
    echo "release: this pipeline is at ${commit}." >&2
    exit 1
    ;;
esac

if [ "${#approved}" -lt 12 ]; then
  echo "release: RELEASE_APPROVED must be at least 12 characters of the commit SHA." >&2
  exit 1
fi

case "${commit}" in
  "${approved}"*)
    echo "release: approved for ${commit}."
    ;;
  *)
    echo "release: RELEASE_APPROVED (${approved}) is not this commit. This pipeline is at ${commit}." >&2
    echo "release: an approval for a different commit does not carry over." >&2
    exit 1
    ;;
esac
