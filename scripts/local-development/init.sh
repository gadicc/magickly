#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."

pnpm install --frozen-lockfile
pnpm exec loom db local setup
pnpm local-development:check
pnpm local-development:migrate
pnpm local-development:seed
