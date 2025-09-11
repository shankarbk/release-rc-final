const fs = require("fs");
const { execSync } = require("child_process");

module.exports = {
  analyzeCommits: async (pluginConfig, context) => {
    const file = pluginConfig.file || "version";
    const version = fs.readFileSync(file, "utf-8").trim();
    const tagName = `v${version}`;

    context.logger.log(`📖 Using version ${version} from ${file}`);

    // Check if tag already exists
    try {
      execSync(`git rev-parse ${tagName}`, { stdio: "ignore" });
      context.logger.log(
        `✅ Tag ${tagName} already exists AND version file matches. Skipping release completely.`
      );
      context.skipRelease = true;
      return false;
    } catch {
      context.logger.log(`🚀 Tag ${tagName} does not exist, release will proceed.`);
    }

    context.nextRelease = { version, notes: "" };
    return "patch"; // must return something semantic-release accepts
  },

  generateNotes: async (pluginConfig, context) => {
    if (context.skipRelease) {
      context.logger.log("⏩ Skipping generateNotes (release disabled).");
      return "";
    }

    const version = context.nextRelease.version;
    const commitMsg = execSync("git log -1 --pretty=%B").toString().trim();
    context.logger.log(`📝 Last commit message: "${commitMsg}"`);

    const changelogFile = "CHANGELOG.md";
    let changelog;

    if (fs.existsSync(changelogFile)) {
      changelog = fs.readFileSync(changelogFile, "utf-8");
    } else {
      changelog = "# Changelog\n\nAll notable changes will be documented here.\n";
    }

    const entry = `\n## v${version}\n\n- ${commitMsg}\n`;

    if (changelog.includes(entry)) {
      context.logger.log("⚠️ Entry already exists in changelog. Skipping append.");
      context.skipCommit = true;
      return "";
    }

    fs.writeFileSync(changelogFile, changelog + entry);
    context.logger.log(`✅ Appended changelog entry for v${version}`);
    context.skipCommit = false;
    return entry;
  },

  prepare: async (pluginConfig, context) => {
    if (context.skipRelease) {
      context.logger.log("⏩ Skipping prepare (release disabled).");
      return;
    }

    if (context.skipCommit) {
      context.logger.log("⏩ Skipping git commit (no changelog update).");
      return;
    }

    execSync("git add CHANGELOG.md");
    execSync(`git commit -m "docs: update CHANGELOG.md"`);
    context.logger.log("📦 Committed CHANGELOG.md");
  },

  publish: async (pluginConfig, context) => {
    if (context.skipRelease) {
      context.logger.log("⏩ Skipping publish (release disabled).");
      return;
    }
    return;
  },
};
