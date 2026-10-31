set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.orbstack/bin:/usr/bin:/bin:/usr/sbin:/sbin"
readonly checkout="$HOME/.local/share/billion/autodeploy"
readonly image_repo="ghcr.io/billion-app/billion-scraper"

if [[ ! -d "$checkout/.git" ]]; then
  mkdir -p "${checkout:h}"
  git clone --quiet https://github.com/billion-app/billion.git "$checkout"
fi
git -C "$checkout" fetch --quiet origin main
readonly sha=$(git -C "$checkout" rev-parse origin/main)
readonly image="$image_repo:$sha"
readonly pin="$HOME/.config/billion/deploy.env"
if [[ -r "$pin" ]] && [[ "$(cat "$pin")" == "SCRAPER_IMAGE=$image" ]] && \
   [[ "$(docker ps --filter name=^/billion-supervisor$ --format '{{.Image}}')" == "$image" ]]; then
  exit 0
fi

if ! docker pull --quiet "$image"; then
  print -u2 "Waiting for CI image $sha; leaving the current deployment running."
  exit 1
fi
git -C "$checkout" reset --hard "$sha"
BILLION_DEPLOY_REPO="$checkout" node "$HOME/.local/bin/billion-deploy-scraper.mjs" --local "$sha"
