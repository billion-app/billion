const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const MARKER = "# Fix fmt consteval compilation errors with Xcode 26.";

function patchPodfile(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const anchor =
    "    # This is necessary for Xcode 14, because it signs resource bundles by default";
  const snippet = `    ${MARKER}
    fmt_base = File.join(installer.sandbox.pod_dir('fmt'), 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patched = content.gsub(/^#\\s*define FMT_USE_CONSTEVAL 1$/, '#  define FMT_USE_CONSTEVAL 0')
      if patched != content
        File.chmod(0644, fmt_base)
        File.write(fmt_base, patched)
      end
    end

`;

  if (!contents.includes(anchor)) {
    throw new Error(
      "Could not find Podfile post_install anchor for fmt Xcode 26 patch.",
    );
  }

  return contents.replace(anchor, `${snippet}${anchor}`);
}

module.exports = function withFmtXcode26Fix(config) {
  return withDangerousMod(config, [
    "ios",
    async (modConfig) => {
      const podfilePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "Podfile",
      );
      const contents = fs.readFileSync(podfilePath, "utf8");
      fs.writeFileSync(podfilePath, patchPodfile(contents));
      return modConfig;
    },
  ]);
};
