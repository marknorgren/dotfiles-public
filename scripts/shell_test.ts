import { fromFileUrl } from "@std/path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function writeExecutable(path: string, contents: string): Promise<void> {
  await Deno.writeTextFile(path, contents);
  await Deno.chmod(path, 0o755);
}

const repoRoot = fromFileUrl(new URL("../", import.meta.url));

Deno.test("global ignores preserve shareable Codex project config", async () => {
  const root = await Deno.makeTempDir();
  await Deno.mkdir(`${root}/.codex/skills/example`, { recursive: true });
  await Deno.mkdir(`${root}/.codex/attachments`, { recursive: true });
  await Deno.writeTextFile(`${root}/.codex/config.toml`, "model = 'test'\n");
  await Deno.writeTextFile(
    `${root}/.codex/skills/example/SKILL.md`,
    "# Example\n",
  );
  await Deno.writeTextFile(`${root}/.codex/auth.json`, "{}\n");
  await Deno.writeTextFile(`${root}/.codex/session_index.jsonl`, "{}\n");
  await Deno.writeTextFile(
    `${root}/.codex/transcription-history.jsonl`,
    "{}\n",
  );
  await Deno.writeTextFile(`${root}/.codex/.codex-global-state.json`, "{}\n");
  await Deno.writeTextFile(
    `${root}/.codex/attachments/pasted-text-attachments.json`,
    "{}\n",
  );
  const init = new Deno.Command("git", {
    args: ["init", "--quiet"],
    cwd: root,
  });
  const initialized = await init.output();
  assert(initialized.code === 0, "failed to initialize test repository");

  const check = async (path: string) => {
    const command = new Deno.Command("git", {
      args: [
        "-c",
        `core.excludesFile=${repoRoot}/.gitignore_global`,
        "check-ignore",
        "--no-index",
        path,
      ],
      cwd: root,
      stdout: "null",
      stderr: "piped",
    });
    return await command.output();
  };

  for (
    const path of [
      ".codex/config.toml",
      ".codex/skills/example/SKILL.md",
    ]
  ) {
    const result = await check(path);
    assert(result.code === 1, `shareable ${path} must remain visible to Git`);
  }

  for (
    const path of [
      ".codex/auth.json",
      ".codex/session_index.jsonl",
      ".codex/transcription-history.jsonl",
      ".codex/.codex-global-state.json",
      ".codex/attachments/pasted-text-attachments.json",
    ]
  ) {
    const result = await check(path);
    assert(result.code === 0, `private ${path} must remain ignored`);
  }
});

Deno.test("Linux shell defaults use batcat and a portable UTF-8 locale", async () => {
  const root = await Deno.makeTempDir();
  const bin = `${root}/bin`;
  await Deno.mkdir(bin, { recursive: true });
  await writeExecutable(`${bin}/uname`, "#!/bin/sh\nprintf Linux\n");
  await writeExecutable(`${bin}/batcat`, "#!/bin/sh\nexit 0\n");

  const command = new Deno.Command("/bin/bash", {
    args: [
      "--noprofile",
      "--norc",
      "-c",
      'source "$DOTFILES/.exports"; printf "%s\\n%s\\n%s\\n" "$LANG" "$MANPAGER" "$MANROFFOPT"',
    ],
    clearEnv: true,
    env: {
      DOTFILES: repoRoot,
      HOME: root,
      PATH: `${bin}:/usr/bin:/bin`,
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = new TextDecoder().decode(stdout).trim().split("\n");
  assert(code === 0, new TextDecoder().decode(stderr));
  assert(output[0] === "C.UTF-8", `expected C.UTF-8, got ${output[0]}`);
  assert(
    output[1].includes("batcat"),
    `expected batcat pager, got ${output[1]}`,
  );
  assert(output[2] === "-c", `expected MANROFFOPT=-c, got ${output[2]}`);
});

Deno.test({
  name: "shell initialization falls back when the cache is unwritable",
  ignore: Deno.build.os === "windows",
  async fn() {
    try {
      await Deno.stat("/bin/zsh");
    } catch {
      return;
    }

    const root = await Deno.makeTempDir();
    const bin = `${root}/bin`;
    const cache = `${root}/cache`;
    const dotfiles = `${root}/dotfiles`;
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(`${cache}/zsh`, { recursive: true });
    await Deno.chmod(`${cache}/zsh`, 0o555);
    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.copyFile(`${repoRoot}/.zshrc`, `${dotfiles}/.zshrc`);
    for (const file of [".exports", ".aliases", ".functions"]) {
      await Deno.writeTextFile(`${dotfiles}/${file}`, "");
    }
    await writeExecutable(
      `${bin}/starship`,
      "#!/bin/sh\nprintf \"CACHE_FALLBACK='ready'\\n\"\n",
    );

    const command = new Deno.Command("/bin/zsh", {
      args: [
        "-f",
        "-c",
        'source "$DOTFILES/.zshrc"; print -r -- "$CACHE_FALLBACK"',
      ],
      env: {
        DOTFILES: dotfiles,
        HOME: root,
        PATH: `${bin}:/usr/bin:/bin`,
        XDG_CACHE_HOME: cache,
      },
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await command.output();
    const output = new TextDecoder().decode(stdout).trim();
    assert(code === 0, new TextDecoder().decode(stderr));
    assert(output === "ready", `live initialization did not run: ${output}`);
  },
});

Deno.test({
  name: "concurrent shells publish complete initialization caches",
  ignore: Deno.build.os === "windows",
  async fn() {
    try {
      await Deno.stat("/bin/zsh");
    } catch {
      return;
    }

    const root = await Deno.makeTempDir();
    const bin = `${root}/bin`;
    const cache = `${root}/cache`;
    const dotfiles = `${root}/dotfiles`;
    const marker = `${root}/first-started`;
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.copyFile(`${repoRoot}/.zshrc`, `${dotfiles}/.zshrc`);
    for (const file of [".exports", ".aliases", ".functions"]) {
      await Deno.writeTextFile(`${dotfiles}/${file}`, "");
    }
    await writeExecutable(
      `${bin}/starship`,
      `#!/bin/sh
if ( set -C; : > "$RACE_MARKER" ) 2>/dev/null; then
  token=first
  printf "CACHE_START='%s'\\n" "$token"
  while [ ! -e "$RACE_MARKER.second" ]; do
    sleep 0.01
  done
  sleep 0.05
else
  token=second
  printf "CACHE_START='%s'\\n" "$token"
  : > "$RACE_MARKER.second"
fi
printf "CACHE_END='%s'\\n" "$token"
`,
    );

    const runShell = () => {
      const command = new Deno.Command("/bin/zsh", {
        args: [
          "-f",
          "-c",
          'source "$DOTFILES/.zshrc"; print -r -- "$CACHE_START|$CACHE_END"',
        ],
        env: {
          DOTFILES: dotfiles,
          HOME: root,
          PATH: `${bin}:/usr/bin:/bin`,
          RACE_MARKER: marker,
          XDG_CACHE_HOME: cache,
        },
        stdout: "piped",
        stderr: "piped",
      });
      return command.output();
    };

    const first = runShell();
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = runShell();
    const results = await Promise.all([first, second]);

    for (const result of results) {
      const output = new TextDecoder().decode(result.stdout).trim();
      assert(
        result.code === 0,
        `shell read a mixed cache: ${new TextDecoder().decode(result.stderr)}`,
      );
      const [start, end] = output.split("|");
      assert(start.length > 0, `shell did not load the cache: ${output}`);
      assert(start === end, `shell read a mixed cache: ${output}`);
    }
  },
});

Deno.test({
  name: "login shells put mise-managed tools on PATH",
  ignore: Deno.build.os === "windows",
  async fn() {
    try {
      await Deno.stat("/bin/zsh");
    } catch {
      return;
    }

    const root = await Deno.makeTempDir();
    const bin = `${root}/bin`;
    const shims = `${root}/shims`;
    const dotfiles = `${root}/dotfiles`;
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(shims, { recursive: true });
    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.copyFile(`${repoRoot}/.zprofile`, `${dotfiles}/.zprofile`);
    await Deno.copyFile(`${repoRoot}/.exports`, `${dotfiles}/.exports`);

    // `mise activate <shell> --shims` prints a single PATH export. Stand in for
    // it so the test does not depend on a real mise installation.
    await writeExecutable(
      `${bin}/mise`,
      `#!/bin/sh
if [ "$1" = "activate" ]; then
  printf 'export PATH="%s:$PATH"\\n' "${shims}"
  exit 0
fi
exit 1
`,
    );
    // git-delta is configured as the global git pager, so a login shell that
    // cannot resolve it leaves every git invocation reporting "cannot run delta".
    await writeExecutable(`${shims}/delta`, "#!/bin/sh\nexit 0\n");

    const command = new Deno.Command("/bin/zsh", {
      args: ["-f", "-c", 'source "$DOTFILES/.zprofile"; command -v delta'],
      clearEnv: true,
      env: {
        DOTFILES: dotfiles,
        HOME: root,
        PATH: `${bin}:/usr/bin:/bin`,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const resolved = new TextDecoder().decode(stdout).trim();
    assert(code === 0, new TextDecoder().decode(stderr));
    assert(
      resolved === `${shims}/delta`,
      `login shell resolved delta to "${resolved}", expected the mise shim`,
    );
  },
});
