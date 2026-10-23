#!/bin/bash
# Recapture documentation screenshots from a git worktree of this
# repository, for agents that must not use the main checkout's dev server:
#
#   /usr/local/bin/magickli-docs-capture <worktree> <shot>...
#
# Installed root-owned with the main checkout's path written in (see
# README.md, "Capturing from a worktree"), so that the standing permission to
# run it covers exactly this script and only worktrees of that checkout.
#
# What it guards, and what it does not. It runs the worktree's own seed, dev
# server and capture, as you, with your files: that code could read the main
# checkout's .env.local, or anything else in your home directory, itself. So
# this is not a sandbox; allowing it is the same trust as letting an agent
# run `pnpm test` in its own worktree. What it does is keep everything but
# the local development settings out of that code's environment, so they
# cannot leak by accident (an environment dump, an error report, the dev
# overlay in a screenshot), and refuse to point the run at anything but a
# registered worktree, a local database and local storage.
set -euo pipefail

# Written in at install time; never taken from the arguments or the worktree.
main='@MAIN_CHECKOUT@'

fail() {
  echo "magickli-docs-capture: $*" >&2
  exit 2
}
[[ $main == /* ]] ||
  fail "install it with the main checkout's path written in (README.md)"
[ $# -ge 2 ] || fail "usage: magickli-docs-capture <worktree> <shot>..."

# The worktree must be one the main checkout registered, and not the main
# checkout itself. Only the main checkout's git runs here, never git with a
# worktree's own configuration.
worktree=$(realpath -e -- "$1") || fail "no such directory: $1"
shift
[ "$worktree" != "$main" ] || fail "give a worktree, not the main checkout"
registered=false
while IFS= read -r line; do
  [ "$line" = "worktree $worktree" ] && registered=true
done < <(git -C "$main" worktree list --porcelain)
$registered || fail "not a worktree of $main: $worktree"

# Next and the seed would load a worktree's own .env files, past the
# settings below. The repository commits none.
shopt -s nullglob dotglob
envfiles=("$worktree"/.env*)
shopt -u nullglob dotglob
[ ${#envfiles[@]} -eq 0 ] ||
  fail "remove the worktree's own ${envfiles[*]##*/} first"

# Shots are plain names the worktree's capture list defines.
capture="$worktree/scripts/docs-screenshots/capture.mts"
shots=()
for shot in "$@"; do
  [[ $shot =~ ^[a-z0-9][a-z0-9-]*$ ]] || fail "not a shot name: $shot"
  grep -qF "name: \"$shot\"" "$capture" || fail "no shot named $shot"
  shots+=("$shot")
done

# Node 24, as the repository requires (the one on PATH, or nvm's), and pnpm,
# by absolute path; the run gets a PATH of these and the system directories.
node=$(command -v node || true)
if [ -z "$node" ] || ! "$node" --version | grep -q '^v24\.'; then
  node=$(ls -d "${NVM_DIR:-$HOME/.nvm}"/versions/node/v24.*/bin/node 2>/dev/null |
    sort -V | tail -1 || true)
fi
[ -n "$node" ] || fail "Node 24 is needed (nvm install 24)"
pnpm=$(command -v pnpm || true)
[[ $pnpm == /* ]] || fail "pnpm is needed on PATH"
run_path="$(dirname -- "$node"):$(dirname -- "$pnpm"):/usr/local/bin:/usr/bin:/bin"

# The local development settings, read from the main checkout's .env.local
# as KEY=VALUE lines (never sourced, so nothing in it runs), and nothing
# else from it.
allowed='DATABASE_URL|DATABASE_URL_UNPOOLED|FILES_STORAGE_PROVIDER|FILES_S3_BUCKET|FILES_S3_ENDPOINT|FILES_S3_ACCESS_KEY_ID|FILES_S3_SECRET_ACCESS_KEY|FILES_S3_REGION|FILES_S3_FORCE_PATH_STYLE|LOOM_LOCAL_TEST_LOGIN|MAGICKLI_RITUAL_BUNDLE_PUBLICATION_POLICY_IDS'
declare -A setting=()
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  [[ $line =~ ^(export[[:space:]]+)?($allowed)=(.*)$ ]] || continue
  key=${BASH_REMATCH[2]}
  value=${BASH_REMATCH[3]}
  if [[ $value =~ ^\"(.*)\"$ || $value =~ ^\'(.*)\'$ ]]; then
    value=${BASH_REMATCH[1]}
  fi
  setting[$key]=$value
done <"$main/.env.local"
for key in DATABASE_URL DATABASE_URL_UNPOOLED FILES_STORAGE_PROVIDER \
  FILES_S3_BUCKET FILES_S3_ENDPOINT LOOM_LOCAL_TEST_LOGIN; do
  [ -n "${setting[$key]:-}" ] || fail "$key is not set in $main/.env.local"
done

# Checked here, not only by the seed, which is the worktree's own code: the
# database and the storage must be on this machine.
local_host() {
  [[ $1 =~ ^[a-z][a-z0-9+.-]*://([^@/]*@)?(\[[^]]*\]|[^:/?#]*) ]] || return 1
  case ${BASH_REMATCH[2]} in
  localhost | 127.0.0.1 | '[::1]' | db.localtest.me) return 0 ;;
  *) return 1 ;;
  esac
}
for key in DATABASE_URL DATABASE_URL_UNPOOLED FILES_S3_ENDPOINT; do
  local_host "${setting[$key]}" || fail "$key is not on this machine"
done

port=$("$node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
origin="http://127.0.0.1:$port"
secret=$(head -c 32 /dev/urandom | base64)
log=$(mktemp -t magickli-docs-capture.XXXXXX.log)

# Replaces the calling (sub)shell with a command that has only the run's
# environment: call it in a subshell or a background job. Values are
# exported, not passed as `env KEY=VALUE` arguments, which any user could
# read in the process list.
clean() {
  {
    while IFS= read -r name; do unset "$name" 2>/dev/null || true; done < <(compgen -e)
    export HOME PATH="$run_path" TERM="${TERM:-dumb}" \
      NODE_ENV=development NEXT_TELEMETRY_DISABLED=1 \
      BETTER_AUTH_SECRET="$secret" \
      GOOGLE_CLIENT_ID=docs-capture-google-client \
      GOOGLE_CLIENT_SECRET=docs-capture-google-secret
    for key in "${!setting[@]}"; do export "$key=${setting[$key]}"; done
    while [ "$1" != -- ]; do
      export "$1"
      shift
    done
    shift
    exec "$@"
  }
}

server=
stop() {
  status=$?
  if [ -n "$server" ]; then
    kill -TERM -- "-$server" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 -- "-$server" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL -- "-$server" 2>/dev/null || true
  fi
  if [ "$status" -eq 0 ]; then
    rm -f -- "$log"
  else
    echo "magickli-docs-capture: failed; dev server log: $log" >&2
  fi
}
trap stop EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

cd "$worktree"

# The seed checks for the normal local configuration (localhost:3004)
# before it writes; it uses only the database, so that origin is fine here.
(clean ROOT_URL=http://localhost:3004 BETTER_AUTH_URL=http://localhost:3004 -- \
  "$pnpm" docs-screenshots:seed)

# In a session of its own, so that stopping it stops everything it starts.
# The background job's shell becomes setsid, which (not being a group
# leader) does not fork, so the session's id is $!.
clean ROOT_URL="$origin" BETTER_AUTH_URL="$origin" -- \
  setsid "$pnpm" exec next dev -H 127.0.0.1 -p "$port" >"$log" 2>&1 &
server=$!

ready=false
for _ in $(seq 180); do
  kill -0 "$server" 2>/dev/null || fail "the dev server stopped"
  if grep -qF "127.0.0.1:$port" "$log" && curl -sf -o /dev/null "$origin/"; then
    ready=true
    break
  fi
  sleep 1
done
$ready || fail "the dev server did not answer within three minutes"

(clean DOCS_SCREENSHOTS_ORIGIN="$origin" -- \
  "$pnpm" docs-screenshots:capture "${shots[@]}")
