#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env
/**
 * Dotfiles installer
 * Handles cross-platform setup for macOS and Linux
 */

import { detectPlatform, getPaths, type PlatformInfo } from "./lib/platform.ts";
import { createAllSymlinks } from "./lib/symlink.ts";
import { commandExists, log, run, runLogged } from "./lib/log.ts";
import { AGENT_CLI_INSTALLERS, agentCliInstallPath } from "./lib/agent_clis.ts";
import { parseArgs } from "@std/cli/parse-args";
import { dirname, resolve } from "@std/path";

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
    await installAgentClis(platform, options);
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
  if (options.dryRun) {
    log.success("Dry run completed; no changes were made");
  } else {
    log.success("Dotfiles installed successfully");
    log.info("Restart your shell or run: source ~/.zshrc");
  }
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

async function installAgentClis(
  platform: PlatformInfo,
  options: InstallOptions,
) {
  if (platform.platform !== "macos" && platform.platform !== "linux") return;

  log.header("Setting up AI coding CLIs");
  if (
    Deno.env.get("DOTFILES_TEST_PLATFORM") ||
    Deno.env.get("DOTFILES_TEST_DISABLE_AGENT_CLIS") === "1"
  ) {
    log.info("Skipping agent CLI installers in the test harness");
    return;
  }

  const installerPath = agentCliInstallPath(
    platform.homeDir,
    Deno.env.get("PATH") ?? "",
  );
  for (const installer of AGENT_CLI_INSTALLERS) {
    log.step(`Installing or updating ${installer.name}...`);
    if (options.dryRun) {
      log.dim(`$ ${installer.command}`);
      continue;
    }

    await run(["sh", "-c", installer.command], {
      env: { PATH: installerPath },
    });

    try {
      const binary = await Deno.stat(
        `${platform.homeDir}/.local/bin/${installer.binary}`,
      );
      if (!binary.isFile) throw new Error("not a file");
    } catch {
      throw new Error(
        `${installer.name} installer did not create ~/.local/bin/${installer.binary}`,
      );
    }
  }

  prependToPath(`${platform.homeDir}/.local/bin`);
}

async function installHomebrew(
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
) {
  let brewCommand = await resolveHomebrewCommand();

  if (!brewCommand) {
    const canPromptForSudo = Deno.stdin.isTerminal();
    if (!canPromptForSudo && !(await hasNonInteractiveSudo())) {
      log.warn(
        "Homebrew is not installed and non-interactive sudo access is unavailable.",
      );
      log.warn(
        "Skipping Brewfile packages; re-run with --skip-packages or install Homebrew manually.",
      );
      return;
    }

    log.step("Installing Homebrew...");
    if (!options.dryRun) {
      try {
        const installCommand = canPromptForSudo
          ? '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
          : 'NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
        await run([
          "/bin/bash",
          "-c",
          installCommand,
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.warn(`Homebrew installation failed: ${message}`);
        log.warn("Skipping Brewfile packages");
        return;
      }
      brewCommand = await resolveHomebrewCommand();
    }
  } else {
    log.info("Homebrew already installed");
  }

  if (!brewCommand) {
    log.warn("Homebrew is not available on PATH; skipping Brewfile packages");
    return;
  }

  prependToPath(dirname(brewCommand));

  await repairHomebrewCommands(brewCommand, paths, options);
  await trustHomebrewTaps(brewCommand, options);

  // Install from Brewfile
  const brewfilePath = `${paths.dotfiles}/Brewfile`;
  try {
    await Deno.stat(brewfilePath);
  } catch {
    log.warn("No Brewfile found, skipping");
    return;
  }

  log.step("Installing packages from Brewfile...");
  if (!options.dryRun) {
    const logPath = `${paths.local}/install-homebrew.log`;
    const bundleCommand = [
      brewCommand,
      "bundle",
      "--quiet",
      "--file",
      brewfilePath,
    ];
    await runHomebrewCommand(
      brewCommand,
      bundleCommand,
      logPath,
      "Retrying Brewfile packages once...",
    );

    for (const command of ["just", "mise"]) {
      if (!(await commandExists(command))) {
        throw new Error(
          `Homebrew completed without the required command "${command}" on PATH`,
        );
      }
    }
  }
}

async function repairHomebrewCommands(
  brewCommand: string,
  paths: ReturnType<typeof getPaths>,
  options: InstallOptions,
): Promise<void> {
  if (options.dryRun) return;

  const brewPath = brewCommand.includes("/")
    ? brewCommand
    : await findExecutable(brewCommand);
  if (!brewPath) return;

  const brewBin = dirname(resolve(brewPath));
  for (
    const command of [
      { displayName: "Git", formula: "git", versionArgs: ["--version"] },
      { displayName: "Bash", formula: "bash", versionArgs: ["--version"] },
    ]
  ) {
    await repairHomebrewCommand(brewCommand, brewBin, paths, command);
  }
}

async function repairHomebrewCommand(
  brewCommand: string,
  brewBin: string,
  paths: ReturnType<typeof getPaths>,
  command: {
    displayName: string;
    formula: string;
    versionArgs: string[];
  },
): Promise<void> {
  const commandPath = `${brewBin}/${command.formula}`;
  try {
    const info = await Deno.stat(commandPath);
    if (!info.isFile) return;
  } catch {
    return;
  }

  const failure = await commandFailure(commandPath, command.versionArgs);
  if (failure === undefined) return;

  const dependency = failure.match(
    /\/(?:opt\/homebrew|usr\/local)\/opt\/([A-Za-z0-9@+_.-]+)\//,
  )?.[1];
  const formulas = dependency && dependency !== command.formula
    ? [dependency, command.formula]
    : [command.formula];
  const repairDescription = dependency
    ? `Homebrew ${command.displayName} and missing dependency ${dependency}`
    : `unusable Homebrew ${command.displayName}`;
  const logPath = `${paths.local}/install-homebrew-${command.formula}.log`;

  log.warn(`Repairing ${repairDescription}`);
  await runHomebrewCommand(
    brewCommand,
    [brewCommand, "reinstall", ...formulas],
    logPath,
    `Retrying Homebrew ${command.displayName} repair once...`,
  );

  const remainingFailure = await commandFailure(
    commandPath,
    command.versionArgs,
  );
  if (remainingFailure !== undefined) {
    throw new Error(
      `Homebrew ${command.displayName} remains unusable after reinstall. Full log: ${logPath}`,
    );
  }
}

async function runHomebrewCommand(
  brewCommand: string,
  command: string[],
  logPath: string,
  retryMessage: string,
): Promise<void> {
  try {
    await runLogged(command, logPath);
  } catch (error) {
    const repairedEntry = await removeCorruptHomebrewCacheEntry(
      brewCommand,
      logPath,
    );
    if (!repairedEntry) throw error;

    log.warn(`Removed corrupt Homebrew cache entry: ${repairedEntry}`);
    log.step(retryMessage);
    await runLogged(command, logPath);
  }
}

async function findExecutable(name: string): Promise<string | undefined> {
  for (const directory of (Deno.env.get("PATH") ?? "").split(":")) {
    if (!directory) continue;
    const path = `${directory}/${name}`;
    try {
      const info = await Deno.stat(path);
      if (info.isFile) return path;
    } catch {
      // Keep looking.
    }
  }
}

async function commandFailure(
  command: string,
  args: string[],
): Promise<string | undefined> {
  try {
    const result = await new Deno.Command(command, {
      args,
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (result.code === 0) return undefined;

    const decoder = new TextDecoder();
    return `${decoder.decode(result.stdout)}${decoder.decode(result.stderr)}`;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function removeCorruptHomebrewCacheEntry(
  brewCommand: string,
  logPath: string,
): Promise<string | undefined> {
  const output = await Deno.readTextFile(logPath).catch(() => "");
  const match = output.match(
    /Invalid argument @ rb_file_s_symlink - \([^,\r\n]+,\s*([^\r\n)]+)\)/,
  );
  if (!match) return undefined;

  try {
    const command = new Deno.Command(brewCommand, {
      args: ["--cache"],
      stdout: "piped",
      stderr: "null",
    });
    const { code, stdout } = await command.output();
    if (code !== 0) return undefined;

    const cacheOutput = new TextDecoder().decode(stdout).trim();
    if (!cacheOutput) return undefined;

    const cacheRoot = resolve(cacheOutput);
    const cacheEntry = resolve(match[1].trim());
    if (dirname(cacheEntry) !== cacheRoot) return undefined;

    const info = await Deno.lstat(cacheEntry);
    if (!info.isFile && !info.isSymlink) return undefined;

    await Deno.remove(cacheEntry);
    return cacheEntry;
  } catch {
    return undefined;
  }
}

async function trustHomebrewTaps(
  brewCommand: string,
  options: InstallOptions,
): Promise<void> {
  if (options.dryRun) return;

  for (const tap of ["1password/tap", "hashicorp/tap"]) {
    try {
      await run([brewCommand, "trust", tap]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.warn(`Unable to trust Homebrew tap ${tap}: ${message}`);
    }
  }
}

async function resolveHomebrewCommand(): Promise<string | undefined> {
  const configuredPath = Deno.env.get("DOTFILES_HOMEBREW_PATH");
  if (configuredPath) {
    try {
      const stat = await Deno.stat(configuredPath);
      if (stat.isFile) return configuredPath;
    } catch {
      throw new Error(
        `DOTFILES_HOMEBREW_PATH does not point to a file: ${configuredPath}`,
      );
    }
  }

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

async function hasNonInteractiveSudo(): Promise<boolean> {
  try {
    const command = new Deno.Command("sudo", {
      args: ["-n", "-v"],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await command.output();
    return code === 0;
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
    let packages: string[];
    try {
      packages = (await Deno.readTextFile(aptFile))
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        log.warn("No apt.txt found, skipping");
        return;
      }
      throw error;
    }

    if (packages.length > 0) {
      log.step("Installing apt packages...");
      if (!options.dryRun) {
        await run(["sudo", "apt", "update"]);
        await run(["sudo", "apt", "install", "-y", ...packages]);
      }
    }
  } else if (platform.distro === "redhat") {
    const dnfFile = `${packagesDir}/dnf.txt`;
    let packages: string[];
    try {
      packages = (await Deno.readTextFile(dnfFile))
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("#"));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        log.warn("No dnf.txt found, skipping");
        return;
      }
      throw error;
    }

    if (packages.length > 0) {
      log.step("Installing dnf packages...");
      if (!options.dryRun) {
        await run(["sudo", "dnf", "install", "-y", ...packages]);
      }
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

    log.step("Installing tools from .tool-versions...");
    await run(["mise", "install"], { cwd: paths.dotfiles });
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

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    if (/no space left|disk full|input\/output error/i.test(message)) {
      log.info("Check free space and disk health, then rerun ./install");
      log.info('Check: df -h / /private/tmp /opt/homebrew "$HOME"');
    } else {
      log.info("Resolve the error, then rerun ./install");
    }
    Deno.exit(1);
  }
}
