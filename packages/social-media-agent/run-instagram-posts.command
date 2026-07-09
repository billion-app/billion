#!/bin/zsh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Choose what to capture:"
echo "1) Browse"
echo "2) Feed"
read "choice?Enter 1-2: "

category=""

case "$choice" in
  1) category="browse" ;;
  2) category="feed" ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

if [[ ! -x "$SCRIPT_DIR/node_modules/.bin/tsx" ]]; then
  echo "Missing local dependencies. Run install first."
  exit 1
fi

"$SCRIPT_DIR/node_modules/.bin/tsx" "$SCRIPT_DIR/src/entry.ts" instagram --category "$category" --post --no-headless

echo
echo "Saved posts under: $SCRIPT_DIR/instagram-posts"
echo "Instagram posting used the folders generated in this run."
read "done?Press Enter to close..."
