/**
 * Symlink management utilities
 */

import { ensureDir } from "@std/fs";
import { basename, dirname } from "@std/path";

export interface SymlinkResult {
  source: string;
  target: string;
  status: "created" | "exists" | "backed_up" | "skipped" | "error";
  message?: string;
}

export interface SymlinkOptions {
  backup?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

/**
 * Create a symlink, optionally backing up existing files
 */
export async function createSymlink(
  source: string,
  target: string,
  options: SymlinkOptions = {},
): Promise<SymlinkResult> {
  const { backup = true, force = false, dryRun = false } = options;

  // Check if source exists
  try {
    await Deno.stat(source);
  } catch {
    return {
      source,
      target,
      status: "error",
      message: "Source does not exist",
    };
  }

  // Check if target already exists
  let targetInfo: Deno.FileInfo | null = null;
  try {
    targetInfo = await Deno.lstat(target);
  } catch {
    // Target doesn't exist, which is fine
  }

  if (targetInfo) {
    // Target exists
    if (targetInfo.isSymlink) {
      // Check if it points to our source
      try {
        const linkTarget = await Deno.readLink(target);
        if (linkTarget === source) {
          return {
            source,
            target,
            status: "exists",
            message: "Symlink already correct",
          };
        }
      } catch {
        // Can't read link
      }
    }

    if (!force && !backup) {
      return {
        source,
        target,
        status: "skipped",
        message: "Target exists, use --force or --backup",
      };
    }

    if (backup) {
      const backupPath = `${target}.backup.${Date.now()}`;
      if (!dryRun) {
        await Deno.rename(target, backupPath);
      }
      const action = dryRun ? "Would back up" : "Backed up";
      console.log(`  ${action}: ${target} → ${basename(backupPath)}`);
    } else if (force) {
      if (!dryRun) {
        await Deno.remove(target, { recursive: true });
      }
    }
  }

  // Ensure parent directory exists
  if (!dryRun) {
    await ensureDir(dirname(target));
    await Deno.symlink(source, target);
  }

  return { source, target, status: "created" };
}

/**
 * Define symlinks to create
 */
export interface SymlinkDefinition {
  source: string; // Relative to dotfiles dir
  target: string; // Relative to home dir (or absolute)
  platform?: "macos" | "linux" | "all";
}

/**
 * Standard dotfile symlinks
 */
export function getStandardSymlinks(
  dotfilesDir: string,
  homeDir: string,
): SymlinkDefinition[] {
  const symlinks: SymlinkDefinition[] = [
    // Shell configs
    { source: ".zshrc", target: ".zshrc" },
    { source: ".zprofile", target: ".zprofile" },
    { source: ".zshenv", target: ".zshenv" },

    // Git
    { source: ".gitconfig", target: ".gitconfig" },
    { source: ".gitignore_global", target: ".gitignore_global" },

    // Editor configs
    { source: ".editorconfig", target: ".editorconfig" },
    { source: ".inputrc", target: ".inputrc" },

    // Tool configs
    { source: ".tool-versions", target: ".tool-versions" },
    { source: ".config/starship.toml", target: ".config/starship.toml" },

    // Shell helpers
    { source: ".aliases", target: ".aliases" },
    { source: ".functions", target: ".functions" },
    { source: ".exports", target: ".exports" },

    // Application configs
    { source: "ghostty", target: ".config/ghostty", platform: "macos" },

    // Cursor editor
    {
      source: "app-settings/cursor/settings.json",
      target: "Library/Application Support/Cursor/User/settings.json",
      platform: "macos",
    },
    {
      source: "app-settings/cursor/keybindings.json",
      target: "Library/Application Support/Cursor/User/keybindings.json",
      platform: "macos",
    },

    // VS Code editor
    {
      source: "app-settings/vscode/settings.json",
      target: "Library/Application Support/Code/User/settings.json",
      platform: "macos",
    },
    {
      source: "app-settings/vscode/settings.json",
      target: ".config/Code/User/settings.json",
      platform: "linux",
    },

    // Zed editor
    { source: "zed/settings.json", target: ".config/zed/settings.json" },
  ];

  return symlinks.map((def) => ({
    ...def,
    source: `${dotfilesDir}/${def.source}`,
    target: def.target.startsWith("/")
      ? def.target
      : `${homeDir}/${def.target}`,
    platform: def.platform ?? "all",
  }));
}

/**
 * Create all symlinks for current platform
 */
export async function createAllSymlinks(
  dotfilesDir: string,
  homeDir: string,
  platform: "macos" | "linux",
  options: SymlinkOptions = {},
): Promise<SymlinkResult[]> {
  const results: SymlinkResult[] = [];
  const symlinks = getStandardSymlinks(dotfilesDir, homeDir);

  for (const def of symlinks) {
    if (def.platform !== "all" && def.platform !== platform) {
      continue;
    }

    const result = await createSymlink(def.source, def.target, options);
    results.push(result);

    const icon = result.status === "created"
      ? "✓"
      : result.status === "exists"
      ? "="
      : result.status === "backed_up"
      ? "⟳"
      : result.status === "skipped"
      ? "⊘"
      : "✗";

    console.log(`  ${icon} ${basename(def.target)}`);
  }

  return results;
}
