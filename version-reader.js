const fs = require("fs").promises;
const { existsSync } = require("fs");
const { execFile } = require("child_process");

const DEFAULT_VERSION_FILE = "version";
const CHANGELOG_FILE = "CHANGELOG.md";
const CHANGELOG_HEADER = "# Changelog\n\nAll notable changes will be documented here.\n";
const CHANGELOG_COMMIT_MSG = "docs: update CHANGELOG.md";

/**
 * Run a git command asynchronously with proper error handling
 */
function runGitCommand(args) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { encoding: "utf-8" }, (err, stdout) => {
      if (err) {
        reject(new Error(`Git command failed: git ${args.join(" ")} → ${err.message}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

module.exports = {
  analyzeCommits: async (pluginConfig, context) => {
    const file = pluginConfig.file || DEFAULT_VERSION_FILE;
    const version = (await fs.readFile(file, "utf-8")).trim();
    const tagName = `v${version}`;

    context.logger.log(`📖 Using version ${version} from ${file}`);

    try {
      await runGitCommand(["rev-parse", tagName]);
      context.logger.log(
        `✅ Tag ${tagName} already exists AND version file matches. Skipping release completely.`
      );
      context.skipRelease = true;
      return false;
    } catch {
      context.logger.log(`🚀 Tag ${tagName} does not exist, release will proceed.`);
    }

    context.nextRelease = { version, notes: "" };
    return "patch"; // semantic-release requires a valid release type
  },

  generateNotes: async (pluginConfig, context) => {
    if (context.skipRelease) {
      context.logger.log("⏩ Skipping generateNotes (release disabled).");
      return "";
    }

    const { version } = context.nextRelease;
    const commitMsg = await runGitCommand(["log", "-1", "--pretty=%B"]);
    context.logger.log(`📝 Last commit message: "${commitMsg}"`);

    let changelog;
    if (existsSync(CHANGELOG_FILE)) {
      changelog = await fs.readFile(CHANGELOG_FILE, "utf-8");
    } else {
      changelog = CHANGELOG_HEADER;
    }

    const entry = `\n## v${version}\n\n- ${commitMsg}\n`;

    if (changelog.includes(entry)) {
      context.logger.log("⚠️ Entry already exists in changelog. Skipping append.");
      context.skipCommit = true;
      return "";
    }

    await fs.writeFile(CHANGELOG_FILE, changelog + entry, "utf-8");
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

    try {
      await runGitCommand(["add", CHANGELOG_FILE]);
      await runGitCommand(["commit", "-m", CHANGELOG_COMMIT_MSG]);
      context.logger.log("📦 Committed CHANGELOG.md");
    } catch (err) {
      context.logger.error(`❌ Failed to commit CHANGELOG.md: ${err.message}`);
      throw err;
    }
  },

  publish: async (pluginConfig, context) => {
    if (context.skipRelease) {
      context.logger.log("⏩ Skipping publish (release disabled).");
    }
  },
};
