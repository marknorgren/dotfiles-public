import { getPaths, type PlatformInfo } from "./platform.ts";

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

const platform: PlatformInfo = {
  platform: "macos",
  distro: "unknown",
  arch: "arm64",
  homeDir: "/tmp/home",
  hostname: "test-host",
  isWSL: false,
};

Deno.test("getPaths defaults to the public dotfiles checkout name", () => {
  const originalDotfiles = Deno.env.get("DOTFILES");
  try {
    Deno.env.delete("DOTFILES");

    assertEquals(
      getPaths(platform).dotfiles,
      "/tmp/home/.dotfiles-public",
      "default dotfiles path",
    );
  } finally {
    if (originalDotfiles === undefined) {
      Deno.env.delete("DOTFILES");
    } else {
      Deno.env.set("DOTFILES", originalDotfiles);
    }
  }
});

Deno.test("getPaths honors DOTFILES override", () => {
  const originalDotfiles = Deno.env.get("DOTFILES");
  try {
    Deno.env.set("DOTFILES", "/tmp/custom-dotfiles");

    assertEquals(
      getPaths(platform).dotfiles,
      "/tmp/custom-dotfiles",
      "override dotfiles path",
    );
  } finally {
    if (originalDotfiles === undefined) {
      Deno.env.delete("DOTFILES");
    } else {
      Deno.env.set("DOTFILES", originalDotfiles);
    }
  }
});
