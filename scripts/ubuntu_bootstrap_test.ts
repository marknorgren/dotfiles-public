const repo = new URL("../", import.meta.url).pathname.replace(/\/$/, "");
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
async function bootstrap(args: string[], upgradeFails = false, remote = false) {
  const root = await Deno.makeTempDir();
  try {
    const bin = `${root}/bin`;
    await Deno.mkdir(bin);
    const events = `${root}/events`;
    const commands: Record<string, string> = {
      uname: "echo Linux",
      sudo: '"$@"',
      "apt-get": `echo "apt-get $*" >> "$EVENTS"\n${
        upgradeFails ? '[ "$1" != upgrade ] || exit 42' : ":"
      }`,
      git: remote
        ? `echo "git $*" >> "$EVENTS"
mkdir -p "$3"
printf '%s\\n' '#!/bin/bash' 'echo "local prepared=$DOTFILES_SYSTEM_PREPARED" >> "$EVENTS"' > "$3/install"
`
        : 'echo "git $*" >> "$EVENTS"\\nexit 1',
      deno:
        'if [ "$1" = --version ]; then echo "deno 2.8.3"; else echo "deno $*" >> "$EVENTS"; fi',
    };
    for (const [name, body] of Object.entries(commands)) {
      await Deno.writeTextFile(`${bin}/${name}`, `#!/bin/sh\n${body}\n`);
      await Deno.chmod(`${bin}/${name}`, 0o755);
    }
    const result = await new Deno.Command("/bin/bash", {
      args: remote
        ? [
          "-c",
          await Deno.readTextFile(`${repo}/install`),
          "/bin/bash",
          ...args,
        ]
        : [`${repo}/install`, ...args],
      cwd: remote ? root : repo,
      env: {
        HOME: root,
        PATH: `${bin}:/usr/bin:/bin`,
        EVENTS: events,
        DOTFILES_TARGET: `${root}/target`,
        DOTFILES_MIN_FREE_KB: "0",
        DOTFILES_HOMEBREW_PATH: `${bin}/brew`,
        TMPDIR: root,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const log = await Deno.readTextFile(events).catch(() => "");
    return {
      code: result.code,
      log,
      output: new TextDecoder().decode(result.stdout) +
        new TextDecoder().decode(result.stderr),
    };
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}
Deno.test("Ubuntu updates precede bootstrap dependencies and Deno", async () => {
  const result = await bootstrap([]);
  assert(result.code === 0, `bootstrap failed: ${result.output}`);
  assert(result.log.indexOf("apt-get update") >= 0, result.log);
  assert(
    result.log.indexOf("apt-get upgrade -y") >
      result.log.indexOf("apt-get update"),
    result.log,
  );
  assert(
    result.log.indexOf("apt-get install") >
      result.log.indexOf("apt-get upgrade -y"),
    result.log,
  );
  assert(
    result.log.indexOf("deno run") > result.log.indexOf("apt-get install"),
    result.log,
  );
});
Deno.test("Ubuntu dry run and skip-packages do not mutate apt", async () => {
  for (const args of [["--dry-run"], ["--skip-packages"]]) {
    const result = await bootstrap(args);
    assert(result.code === 0, result.output);
    assert(!result.log.includes("apt-get"), result.log);
  }
});
Deno.test("Ubuntu skip-system-update still installs bootstrap dependencies", async () => {
  const result = await bootstrap(["--skip-system-update"]);
  assert(result.code === 0, result.output);
  assert(!result.log.includes("upgrade"), result.log);
  assert(result.log.includes("apt-get install"), result.log);
});
Deno.test("Ubuntu update failures stop before dependencies or Deno", async () => {
  const result = await bootstrap([], true);
  assert(result.code !== 0, "upgrade failure was ignored");
  assert(
    !result.log.includes("apt-get install") && !result.log.includes("deno run"),
    result.log,
  );
});

Deno.test("Ubuntu remote one-command bootstrap updates before cloning and preserves preparation", async () => {
  const result = await bootstrap([], false, true);
  assert(result.code === 0, result.output);
  assert(
    result.log.indexOf("git clone") > result.log.indexOf("apt-get install"),
    result.log,
  );
  assert(result.log.includes("local prepared=1"), result.log);
  assert(result.log.split("apt-get upgrade -y").length === 2, result.log);
});
