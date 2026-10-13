const denoInfo = new Deno.Command(Deno.execPath(), {
  args: ["info", "--json"],
  stdout: "piped",
}).outputSync();
const denoDir = JSON.parse(new TextDecoder().decode(denoInfo.stdout))
  .denoDir as string;
const repo = new URL("../", import.meta.url);
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function verify(brokenAgent = false) {
  const root = await Deno.makeTempDir();
  try {
    const checkout = `${root}/checkout`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;
    for (const dir of [checkout, `${checkout}/bin`, home, bin]) {
      await Deno.mkdir(dir, { recursive: true });
    }
    const script = await Deno.readTextFile(new URL("bin/verify", repo));
    await Deno.writeTextFile(`${checkout}/bin/verify`, script);
    await Deno.chmod(`${checkout}/bin/verify`, 0o755);
    await Deno.writeTextFile(
      `${checkout}/.zshrc`,
      `
for name in w g now dh help; do alias "$name"=true; done
for name in _zsh_cache_init _zsh_source_plugin wt dothelp; do functions[$name]='return 0'; done
week() { echo 42; }
uuid() { echo fixture-id; }
urlencode() { echo hello+world; }
`,
    );
    for (const name of [".zshrc", ".aliases", ".functions"]) {
      if (name !== ".zshrc") {
        await Deno.writeTextFile(`${checkout}/${name}`, "");
      }
      await Deno.symlink(`${checkout}/${name}`, `${home}/${name}`);
    }
    for (
      const name of [
        "deno",
        "git",
        "just",
        "mise",
        "node",
        "pnpm",
        "python3",
        "ruby",
        "dotnet",
        "uv",
        "tmux",
        "starship",
        "codex",
        "claude",
        "delta",
        "fzf",
        "shfmt",
        "devcontainer-stack",
        "ifconfig",
        "ip",
        "ss",
      ]
    ) {
      await Deno.writeTextFile(
        `${bin}/${name}`,
        `#!/bin/sh\n${
          name === "tmux" ? '[ "$1" = "-V" ] || exit 2\n' : ""
        }exit ${brokenAgent && name === "claude" ? 17 : 0}\n`,
      );
      await Deno.chmod(`${bin}/${name}`, 0o755);
    }
    const result = await new Deno.Command("/bin/zsh", {
      args: [`${checkout}/bin/verify`],
      clearEnv: true,
      env: { HOME: home, PATH: `${bin}:/usr/bin:/bin`, VERIFY_INSTALLED: "1" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    return {
      code: result.code,
      output: new TextDecoder().decode(result.stdout),
    };
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}
Deno.test("installed verification executes both agents and required runtimes", async () => {
  const result = await verify();
  assert(result.code === 0, result.output);
  for (
    const tool of [
      "claude",
      "codex",
      "node",
      "pnpm",
      "python3",
      "uv",
      "just",
      "tmux",
    ]
  ) {
    assert(result.output.includes(`✓ ${tool} executes`), result.output);
  }
});
Deno.test("installed verification rejects an agent binary that exists but cannot run", async () => {
  const result = await verify(true);
  assert(result.code !== 0, "broken Claude binary passed verification");
  assert(result.output.includes("✗ claude executes"), result.output);
});

Deno.test("full installer stops when its installed verification fails", async () => {
  const root = await Deno.makeTempDir();
  try {
    const bin = `${root}/bin`;
    await Deno.mkdir(bin);
    const events = `${root}/verification-ran`;
    for (const name of ["brew", "starship", "hostname"]) {
      await Deno.writeTextFile(`${bin}/${name}`, "#!/bin/sh\nexit 0\n");
      await Deno.chmod(`${bin}/${name}`, 0o755);
    }
    await Deno.writeTextFile(
      `${bin}/mise`,
      `#!/bin/sh
if [ "$1" = exec ]; then
    echo "$VERIFY_INSTALLED" > "$VERIFY_MARKER"
    exit 23
fi
exit 0
`,
    );
    await Deno.chmod(`${bin}/mise`, 0o755);
    await Deno.writeTextFile(`${root}/home-marker`, "");
    const result = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        new URL("scripts/install.ts", repo).pathname,
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: root,
        HOME: root,
        PATH: `${bin}:/usr/bin:/bin`,
        DOTFILES_TEST_DISABLE_AGENT_CLIS: "1",
        DOTFILES_HOMEBREW_PATH: `${bin}/brew`,
        VERIFY_MARKER: events,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const output = new TextDecoder().decode(result.stdout) +
      new TextDecoder().decode(result.stderr);
    assert(result.code !== 0, output);
    assert(
      (await Deno.readTextFile(events).catch(() => "missing")).trim() === "1",
      output,
    );
    assert(!output.includes("Dotfiles installed successfully"), output);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
