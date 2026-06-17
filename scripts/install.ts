#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * Dotfiles installer
 * Handles cross-platform setup for macOS and Linux
 */

import { detectPlatform, getPaths, type PlatformInfo } from "./lib/platform.ts";
import { createAllSymlinks } from "./lib/symlink.ts";
import { capture, commandExists, log, run } from "./lib/log.ts";
import { parseArgs } from "@std/cli/parse-args";

interface InstallOptions {
  dryRun: boolean;
  skipPackages: boolean;
  skipSymlinks: boolean;
  force: boolean;
}

async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run", "skip-packages", "skip-symlinks", "force", "help"],
    alias: { n: "dry-run", h: "help" },
  });

  if (args.help) {
    console.log(`
Dotfiles Installer

Usage: install [options]

Options:
  -n, --dry-run       Show what would be done without making changes
  --skip-packages     Skip package installation
  --skip-symlinks     Skip symlink creation
  --force             Overwrite existing files without backup
  -h, --help          Show this help
`);
    Deno.exit(0);
  }

  const options: InstallOptions = {
    dryRun: args["dry-run"] ?? false,
    skipPackages: args["skip-packages"] ?? false,
    skipSymlinks: args["skip-symlinks"] ?? false,
    force: args.force ?? false,
  };

  if (options.dryRun) {
    log.warn("Dry run mode - no changes will be made");
  }

  log.header("Detecting platform");
  const platform = await detectPlatform();
  const paths = getPaths(platform);

  log.info(`Platform: ${platform.platform} (${platform.arch})`);
  if (platform.platform === "linux") {
    log.info(`Distro: ${platform.distro}`);
  }
  log.info(`Hostname: ${platform.hostname}`);
  log.info(`Home: ${platform.homeDir}`);
  log.info(`Dotfiles: ${paths.dotfiles}`);

  // Platform-specific package installation
  if (!options.skipPackages) {
    await installPackages(platform, paths, options);
  }

  if (platform.platform === "linux") {
    await installStarship(platform, options);
  }

  // Install mise (universal version manager)
  await installMise(platform, options);

  // Create symlinks
  if (!options.skipSymlinks) {
    log.header("Creating symlinks");
    const platformName = platform.platform === "macos" ? "macos" : "linux";
    await createAllSymlinks(paths.dotfiles, platform.homeDir, platformName, {
      backup: !options.force,
      dryRun: options.dryRun,
      force: options.force,
    });
  }

  // Create local directory for machine-specific overrides
  await setupLocalDir(paths, options);

  log.header("Done!");
  log.success("Dotfiles installed successfully");
  log.info("Restart your shell or run: source ~/.zshrc");
}

async function installPackages(
  platform: PlatformInfo,
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
) {
  log.header("Installing packages");

  if (platform.platform === "macos") {
    await installHomebrew(paths, options);
  } else if (platform.platform === "linux") {
    await installLinuxPackages(platform, paths, options);
  }
}

async function installHomebrew(
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
) {
  let brewCommand = await resolveHomebrewCommand();

  if (!brewCommand) {
    if (!(await canInstallHomebrew())) {
      log.warn(
        "Homebrew is not installed and this macOS user is not an Administrator.",
      );
      log.warn(
        "Skipping Brewfile packages; re-run with --skip-packages or install Homebrew as an admin user.",
      );
      return;
    }

    log.step("Installing Homebrew...");
    if (!options.dryRun) {
      await run([
        "/bin/bash",
        "-c",
        'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      ]);
      brewCommand = await resolveHomebrewCommand();
    }
  } else {
    log.info("Homebrew already installed");
  }

  if (!brewCommand) {
    log.warn("Homebrew is not available on PATH; skipping Brewfile packages");
    return;
  }

  // Install from Brewfile
  const brewfilePath = `${paths.dotfiles}/Brewfile`;
  try {
    await Deno.stat(brewfilePath);
    log.step("Installing packages from Brewfile...");
    if (!options.dryRun) {
      await run([brewCommand, "bundle", "--file", brewfilePath]);
    }
  } catch {
    log.warn("No Brewfile found, skipping");
  }
}

async function resolveHomebrewCommand(): Promise<string | undefined> {
  if (await commandExists("brew")) return "brew";
  if (Deno.env.get("DOTFILES_TEST_DISABLE_SYSTEM_BREW") === "1") {
    return undefined;
  }

  for (const path of ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) return path;
    } catch {
      // Keep looking.
    }
  }
}

async function canInstallHomebrew(): Promise<boolean> {
  try {
    const groups = await capture(["id", "-Gn"]);
    return groups.split(/\s+/).includes("admin");
  } catch {
    return false;
  }
}

async function installLinuxPackages(
  platform: PlatformInfo,
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
) {
  const packagesDir = `${paths.dotfiles}/packages`;

  if (platform.distro === "debian") {
    const aptFile = `${packagesDir}/apt.txt`;
    try {
      const packages = (await Deno.readTextFile(aptFile))
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));

      if (packages.length > 0) {
        log.step("Installing apt packages...");
        if (!options.dryRun) {
          await run(["sudo", "apt", "update"]);
          await run(["sudo", "apt", "install", "-y", ...packages]);
        }
      }
    } catch {
      log.warn("No apt.txt found, skipping");
    }
  } else if (platform.distro === "redhat") {
    const dnfFile = `${packagesDir}/dnf.txt`;
    try {
      const packages = (await Deno.readTextFile(dnfFile))
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));

      if (packages.length > 0) {
        log.step("Installing dnf packages...");
        if (!options.dryRun) {
          await run(["sudo", "dnf", "install", "-y", ...packages]);
        }
      }
    } catch {
      log.warn("No dnf.txt found, skipping");
    }
  } else {
    log.warn(
      `Unknown distro: ${platform.distro}, skipping package installation`,
    );
  }
}

async function installStarship(
  platform: PlatformInfo,
  options: InstallOptions,
) {
  log.header("Setting up starship (shell prompt)");

  const hasStarship = await commandExists("starship");

  if (!hasStarship) {
    log.step("Installing starship...");
    if (!options.dryRun) {
      await run([
        "sh",
        "-c",
        'set -e; mkdir -p "$1/.local/bin"; curl -fsSL https://starship.rs/install.sh | sh -s -- -y -b "$1/.local/bin"',
        "install-starship",
        platform.homeDir,
      ]);
      prependToPath(`${platform.homeDir}/.local/bin`);
    }
  } else {
    log.info("starship already installed");
  }
}

async function installMise(
  platform: PlatformInfo,
  options: InstallOptions,
) {
  log.header("Setting up mise (version manager)");

  const hasMise = await commandExists("mise");

  if (!hasMise) {
    log.step("Installing mise...");
    if (!options.dryRun) {
      await run(["sh", "-c", "curl -fsSL https://mise.run | sh"]);
      prependToPath(`${platform.homeDir}/.local/bin`);
    }
  } else {
    log.info("mise already installed");
  }

  // Trust the dotfiles directory
  if (!options.dryRun) {
    const paths = getPaths(await detectPlatform());
    await run(["mise", "trust", paths.dotfiles], { silent: true });
  }
}

function prependToPath(path: string) {
  if (!path) return;

  const currentPath = Deno.env.get("PATH") ?? "";
  const entries = currentPath.split(":").filter(Boolean);
  if (entries.includes(path)) return;

  Deno.env.set("PATH", [path, ...entries].join(":"));
}

async function setupLocalDir(
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
) {
  log.header("Setting up local overrides");

  const localDir = paths.local;
  const readmePath = `${localDir}/README.md`;

  try {
    await Deno.stat(localDir);
    log.info("Local directory already exists");
  } catch {
    log.step("Creating local directory...");
    if (!options.dryRun) {
      await Deno.mkdir(localDir, { recursive: true });
      await Deno.writeTextFile(
        readmePath,
        `# Local Overrides

This directory is for machine-specific configuration.
Files here are git-ignored and not synced.

## Files you can create:

- \`init.sh\` - Sourced after core dotfiles load
- \`aliases.sh\` - Machine-specific aliases
- \`exports.sh\` - Machine-specific environment variables
- \`path.sh\` - Machine-specific PATH additions

## Example init.sh:

\`\`\`bash
# Load local configs
[[ -f "$DOTFILES/local/aliases.sh" ]] && source "$DOTFILES/local/aliases.sh"
[[ -f "$DOTFILES/local/exports.sh" ]] && source "$DOTFILES/local/exports.sh"

# Machine-specific settings
export MY_MACHINE_NAME="${await (async () => {
          try {
            const cmd = new Deno.Command("hostname", { stdout: "piped" });
            const { stdout } = await cmd.output();
            return new TextDecoder().decode(stdout).trim();
          } catch {
            return "unknown";
          }
        })()}"
\`\`\`
`,
      );
      await Deno.writeTextFile(`${localDir}/.gitkeep`, "");
    }
  }
}

// Run
await main();
