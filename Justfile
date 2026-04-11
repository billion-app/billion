# Expo release workflow
# Requires: just, bun, node

# Bump version in app.config.json, commit, and tag
bump type="patch":
    node scripts/bump.mjs {{type}}

# Regenerate native project for a platform (ios or android)
build platform="ios":
    cd apps/expo && bunx expo prebuild --clean --platform {{platform}}
    {{ if platform == "ios" { "node scripts/patch-pbxproj.mjs" } else { "" } }}

# Bump version then build for a platform
release type="patch" platform="ios":
    just bump {{type}}
    just build {{platform}}
