/**
 * Platform detection utilities
 */

export type Platform = "macos" | "linux" | "windows" | "unknown";
export type Distro = "debian" | "redhat" | "arch" | "alpine" | "unknown";
export type Arch = "arm64" | "x64" | "unknown";

export interface PlatformInfo {
  platform: Platform;
  distro: Distro;
  arch: Arch;
  homeDir: string;
  hostname: string;
  isWSL: boolean;
}

export async function detectPlatform(): Promise<PlatformInfo> {
  const os = Deno.build.os;
  const arch = Deno.build.arch === "aarch64"
    ? "arm64"
    : Deno.build.arch === "x86_64"
    ? "x64"
    : "unknown";
  const homeDir = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? "";

  let hostname = "unknown";
  try {
    const cmd = new Deno.Command("hostname", { stdout: "piped" });
    const output = await cmd.output();
    hostname = new TextDecoder().decode(output.stdout).trim();
  } catch {
    // Ignore hostname detection failure
  }

  const platform: Platform = os === "darwin"
    ? "macos"
    : os === "linux"
    ? "linux"
    : os === "windows"
    ? "windows"
    : "unknown";

  const distro = await detectDistro();
  const isWSL = await checkWSL();

  return { platform, distro, arch, homeDir, hostname, isWSL };
}

async function detectDistro(): Promise<Distro> {
  if (Deno.build.os !== "linux") return "unknown";

  try {
    // Check for common distro files
    if (await fileExists("/etc/debian_version")) return "debian";
    if (await fileExists("/etc/redhat-release")) return "redhat";
    if (await fileExists("/etc/arch-release")) return "arch";
    if (await fileExists("/etc/alpine-release")) return "alpine";

    // Try /etc/os-release
    const osRelease = await Deno.readTextFile("/etc/os-release").catch(() =>
      ""
    );
    if (osRelease.includes("ID=ubuntu") || osRelease.includes("ID=debian")) {
      return "debian";
    }
    if (
      osRelease.includes("ID=fedora") || osRelease.includes("ID=rhel") ||
      osRelease.includes("ID=centos")
    ) return "redhat";
    if (osRelease.includes("ID=arch")) return "arch";
    if (osRelease.includes("ID=alpine")) return "alpine";
  } catch {
    // Ignore errors
  }

  return "unknown";
}

async function checkWSL(): Promise<boolean> {
  if (Deno.build.os !== "linux") return false;

  try {
    const procVersion = await Deno.readTextFile("/proc/version");
    return procVersion.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get platform-specific paths
 */
export function getPaths(info: PlatformInfo) {
  const dotfiles = Deno.env.get("DOTFILES") ??
    `${info.homeDir}/.dotfiles-public`;

  return {
    dotfiles,
    home: info.homeDir,
    config: info.platform === "macos"
      ? `${info.homeDir}/Library/Application Support`
      : `${info.homeDir}/.config`,
    local: `${dotfiles}/local`,
    cache: info.platform === "macos"
      ? `${info.homeDir}/Library/Caches`
      : `${info.homeDir}/.cache`,
  };
}
