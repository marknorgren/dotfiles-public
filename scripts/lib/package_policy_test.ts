function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = new URL("../../", import.meta.url);
const read = (name: string) => Deno.readTextFile(new URL(name, root));

Deno.test("package profiles have one owner per package and keep optional tools out of the base", async () => {
  const owners = new Map<string, string>();
  for await (const entry of Deno.readDir(root)) {
    if (!/^Brewfile(?:\.[a-z-]+)?$/.test(entry.name)) continue;
    const contents = await read(entry.name);
    for (
      const [, kind, name] of contents.matchAll(/^\s*(brew|cask) "([^"]+)"/gm)
    ) {
      const key = `${kind}:${name}`;
      assert(
        !owners.has(key),
        `${key} appears in ${owners.get(key)} and ${entry.name}`,
      );
      owners.set(key, entry.name);
    }
  }
  for (
    const name of [
      "node",
      "python",
      "ruby",
      "dotnet",
      "pnpm",
      "fzf",
      "git-delta",
      "shfmt",
      "tree",
      "direnv",
      "mas",
      "dash",
      "dash-shell",
      "awscli",
      "mint",
      "ffmpeg",
      "ollama",
    ]
  ) {
    assert(
      owners.get(`brew:${name}`) !== "Brewfile",
      `${name} must not be installed by the base Brewfile`,
    );
  }
  for (const key of ["brew:rustup-init", "cask:makemkv", "cask:sublime-text"]) {
    assert(!owners.has(key), `${key} is retired from the shared profiles`);
  }
  for (
    const key of [
      "brew:rustup",
      "brew:neovim",
      "cask:ghostty",
      "cask:visual-studio-code",
    ]
  ) {
    assert(owners.get(key) === "Brewfile", `${key} is missing from the base`);
  }
});

Deno.test("Linux networking and editor packages match shell verification", async () => {
  for (const [manager, network] of [["apt", "iproute2"], ["dnf", "iproute"]]) {
    const packages = (await read(`packages/${manager}.txt`)).split("\n").map((
      line,
    ) => line.trim());
    assert(packages.includes(network), `${manager} must supply ip and ss`);
    assert(
      packages.includes("neovim") && packages.includes("tree"),
      `${manager} must retain the terminal editor and tree fallback`,
    );
    for (const retired of ["vim", "net-tools", "fzf", "htop"]) {
      assert(
        !packages.includes(retired),
        `${manager} still explicitly installs ${retired}`,
      );
    }
  }
});

Deno.test("pnpm 11 policy uses YAML and preserves project version selection", async () => {
  const config = await read(".config/pnpm/config.yaml");
  assert(
    /^ignoreScripts: true$/m.test(config),
    "pnpm must preserve the no-install-scripts policy",
  );
  assert(
    /^managePackageManagerVersions: true$/m.test(config),
    "project packageManager pins must be respected",
  );
  assert(
    !/^manage-package-manager-versions=/m.test(await read(".npmrc")),
    "pnpm settings do not belong in .npmrc",
  );
});
