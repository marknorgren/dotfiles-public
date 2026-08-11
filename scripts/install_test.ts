import { fromFileUrl } from "@std/path";

const repoRoot = fromFileUrl(new URL("../", import.meta.url)).replace(
  /\/$/,
  "",
);
const denoInfo = new Deno.Command(Deno.execPath(), {
  args: ["info", "--json"],
  stdout: "piped",
}).outputSync();
const denoDir = (JSON.parse(new TextDecoder().decode(denoInfo.stdout)) as {
  denoDir: string;
}).denoDir;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function runRemoteBootstrap(denoVersion: string): Promise<string> {
  const root = await Deno.makeTempDir();
  const home = `${root}/home`;
  const temp = `${root}/tmp`;
  const bin = `${root}/bin`;
  const homebrewBin = `${root}/homebrew/bin`;

  await Deno.mkdir(home, { recursive: true });
  await Deno.mkdir(temp, { recursive: true });
  await Deno.mkdir(bin, { recursive: true });
  await Deno.mkdir(homebrewBin, { recursive: true });
  await writeExecutable(
    `${bin}/deno`,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno ${denoVersion} (stable, release, test)\\n'
  exit 0
fi
exec "${Deno.execPath()}" "$@"
`,
  );
  await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

  const bootstrap = await Deno.readTextFile(`${repoRoot}/install`);
  const command = new Deno.Command("/bin/bash", {
    args: ["-c", bootstrap, "/bin/bash", "--dry-run"],
    cwd: repoRoot,
    env: {
      DENO_DIR: denoDir,
      DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
      DOTFILES_MIN_FREE_KB: "0",
      HOME: home,
      NO_COLOR: "1",
      PATH: `${bin}:/usr/bin:/bin`,
      TMPDIR: temp,
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  const output = `${new TextDecoder().decode(stdout)}${
    new TextDecoder().decode(stderr)
  }`;
  assert(code === 0, `remote dry run failed: ${output}`);
  return output;
}

interface DenoRecoveryResult {
  code: number;
  curlRan: boolean;
  denoRunArgs?: string;
  output: string;
}

async function runDenoRecovery(
  installedVersion: string | undefined,
): Promise<DenoRecoveryResult> {
  const root = await Deno.makeTempDir();
  const home = `${root}/home`;
  const temp = `${root}/tmp`;
  const bin = `${root}/bin`;
  const homebrewBin = `${root}/homebrew/bin`;
  const curlMarker = `${root}/curl-ran`;
  const denoRunMarker = `${root}/deno-run-args`;
  const installer = `${root}/deno-installer.sh`;
  const workingDeno = installedVersion ? `${root}/working-deno` : "";

  await Deno.mkdir(home, { recursive: true });
  await Deno.mkdir(temp, { recursive: true });
  await Deno.mkdir(bin, { recursive: true });
  await Deno.mkdir(homebrewBin, { recursive: true });
  await writeExecutable(
    `${bin}/deno`,
    "#!/bin/sh\nprintf 'dyld: Library not loaded\\n' >&2\nexit 127\n",
  );
  if (installedVersion) {
    await writeExecutable(
      workingDeno,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno ${installedVersion} (stable, release, test)\\n'
  exit 0
fi
if [ "$1" = "run" ]; then
  printf '%s\\n' "$@" > "$DENO_RUN_MARKER"
  exit 0
fi
exit 1
`,
    );
  }
  await Deno.writeTextFile(
    installer,
    `#!/bin/sh
if [ "$1" != "--no-modify-path" ] || [ "$2" != "v2.8.3" ]; then
  exit 91
fi
if [ -n "$WORKING_DENO" ]; then
  mkdir -p "$HOME/.deno/bin"
  cp "$WORKING_DENO" "$HOME/.deno/bin/deno"
fi
`,
  );
  await writeExecutable(
    `${bin}/curl`,
    `#!/bin/sh
if [ "$1" != "-fsSL" ] || [ "$2" != "https://deno.land/install.sh" ]; then
  exit 92
fi
: > "$CURL_MARKER"
/bin/cat "$DENO_INSTALLER"
`,
  );
  await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
  await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

  const command = new Deno.Command("/bin/bash", {
    args: [`${repoRoot}/install`],
    cwd: repoRoot,
    env: {
      CURL_MARKER: curlMarker,
      DENO_DIR: denoDir,
      DENO_INSTALLER: installer,
      DENO_RUN_MARKER: denoRunMarker,
      DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
      DOTFILES_MIN_FREE_KB: "0",
      HOME: home,
      NO_COLOR: "1",
      PATH: `${bin}:/usr/bin:/bin`,
      TMPDIR: temp,
      WORKING_DENO: workingDeno,
    },
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  return {
    code,
    curlRan: await exists(curlMarker),
    denoRunArgs: await exists(denoRunMarker)
      ? await Deno.readTextFile(denoRunMarker)
      : undefined,
    output: `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`,
  };
}

Deno.test({
  name: "remote bootstrap reports the checkout directory",
  ignore: Deno.build.os === "windows",
  async fn() {
    const output = await runRemoteBootstrap("2.8.3");
    const reportedDirectory = output.match(/Dotfiles directory: ([^\n]+)/)?.[1];
    assert(
      reportedDirectory?.endsWith("/dotfiles-public"),
      `expected checkout directory, got: ${output}`,
    );
    assert(
      !output.includes("Dotfiles directory: /bin\n"),
      `shell binary directory leaked into installer output: ${output}`,
    );
    assert(
      output.includes("Dry run completed; no changes were made"),
      `dry run reported an installed system: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap executable uses the system Bash",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await writeExecutable(
      `${bin}/bash`,
      "#!/bin/sh\nprintf 'broken Bash from PATH\\n' >&2\nexit 77\n",
    );
    await writeExecutable(
      `${bin}/deno`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno 2.8.3 (stable, release, test)\\n'
  exit 0
fi
exec "${Deno.execPath()}" "$@"
`,
    );
    await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

    const command = new Deno.Command(`${repoRoot}/install`, {
      args: ["--dry-run"],
      cwd: repoRoot,
      env: {
        DENO_DIR: denoDir,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_MIN_FREE_KB: "0",
        HOME: home,
        NO_COLOR: "1",
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: temp,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;
    assert(code === 0, `bootstrap used Bash from PATH: ${output}`);
    assert(
      output.includes("Dry run completed; no changes were made"),
      `bootstrap did not complete through system Bash: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap executable falls back to Bash from PATH",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;
    const bashMarker = `${root}/path-bash-ran`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await writeExecutable(
      `${bin}/bash`,
      '#!/bin/sh\nprintf \'ran\\n\' >> "$BASH_MARKER"\nexec /bin/bash "$@"\n',
    );
    await writeExecutable(
      `${bin}/deno`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno 2.8.3 (stable, release, test)\\n'
  exit 0
fi
exec "${Deno.execPath()}" "$@"
`,
    );
    await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

    const command = new Deno.Command(`${repoRoot}/install`, {
      args: ["--dry-run"],
      cwd: repoRoot,
      env: {
        BASH_MARKER: bashMarker,
        DENO_DIR: denoDir,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_MIN_FREE_KB: "0",
        DOTFILES_SYSTEM_BASH: `${root}/missing/bash`,
        HOME: home,
        NO_COLOR: "1",
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: temp,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;
    assert(code === 0, `bootstrap PATH fallback failed: ${output}`);
    assert(
      await exists(bashMarker),
      `bootstrap did not use Bash from PATH: ${output}`,
    );
  },
});

Deno.test({
  name: "remote bootstrap re-executes with the selected Bash",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;
    const bashMarker = `${root}/selected-bash-ran`;
    const bootstrapPath = `${root}/install`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await writeExecutable(
      `${bin}/bash`,
      '#!/bin/sh\nprintf \'ran\\n\' >> "$BASH_MARKER"\nexec /bin/bash "$@"\n',
    );
    await writeExecutable(
      `${bin}/deno`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno 2.8.3 (stable, release, test)\\n'
  exit 0
fi
exec "${Deno.execPath()}" "$@"
`,
    );
    await writeExecutable(`${bin}/git`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(
      bootstrapPath,
      await Deno.readTextFile(`${repoRoot}/install`),
    );

    const command = new Deno.Command(bootstrapPath, {
      args: ["--dry-run"],
      cwd: root,
      env: {
        BASH_MARKER: bashMarker,
        DENO_DIR: denoDir,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_MIN_FREE_KB: "0",
        DOTFILES_SYSTEM_BASH: `${bin}/bash`,
        DOTFILES_TARGET: repoRoot,
        HOME: home,
        NO_COLOR: "1",
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: temp,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;
    assert(code === 0, `remote bootstrap selected Bash failed: ${output}`);
    assert(
      output.includes("Dry run completed; no changes were made"),
      `remote bootstrap did not complete through selected Bash: ${output}`,
    );
    assert(
      await exists(bashMarker),
      `remote bootstrap never used the selected Bash: ${output}`,
    );
    assert(
      (await Deno.readTextFile(bashMarker)).trim().split("\n").length === 2,
      `remote bootstrap did not re-exec with the selected Bash: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap warns when Deno differs from the supported release line",
  ignore: Deno.build.os === "windows",
  async fn() {
    const output = await runRemoteBootstrap("2.9.5");
    assert(
      output.includes("does not match the supported 2.8 release line"),
      `expected a Deno compatibility warning, got: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap replaces an unusable Deno executable",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { code, curlRan, denoRunArgs, output } = await runDenoRecovery(
      "2.8.3",
    );
    assert(code === 0, `expected bootstrap recovery to succeed: ${output}`);
    assert(
      curlRan,
      `bootstrap never invoked the pinned Deno installer: ${output}`,
    );
    assert(
      output.includes("Existing Deno is unusable"),
      `expected an actionable Deno warning, got: ${output}`,
    );
    assert(
      output.includes("Deno installed: deno 2.8.3"),
      `expected the pinned Deno installation, got: ${output}`,
    );
    assert(
      !output.includes("dyld: Library not loaded"),
      `raw loader failure leaked into normal output: ${output}`,
    );
    assert(
      denoRunArgs?.includes("scripts/install.ts"),
      `bootstrap never ran the TypeScript installer: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap rejects a standalone Deno with the wrong pinned version",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { code, denoRunArgs, output } = await runDenoRecovery("2.9.5");
    assert(code !== 0, `expected a Deno version failure: ${output}`);
    assert(
      output.includes("Installed Deno 2.9.5 does not match pinned 2.8.3"),
      `expected an exact-version error, got: ${output}`,
    );
    assert(
      denoRunArgs === undefined,
      `bootstrap continued after a Deno version mismatch: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap stops when Deno installation produces no executable",
  ignore: Deno.build.os === "windows",
  async fn() {
    const { code, denoRunArgs, output } = await runDenoRecovery(undefined);
    assert(code !== 0, `expected a missing Deno failure: ${output}`);
    assert(
      output.includes("did not produce a working executable"),
      `expected an actionable missing-Deno error, got: ${output}`,
    );
    assert(
      denoRunArgs === undefined,
      `bootstrap continued without an installed Deno: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap dry run does not replace an unusable Deno executable",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;
    const curlMarker = `${root}/curl-ran`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await writeExecutable(`${bin}/deno`, "#!/bin/sh\nexit 127\n");
    await writeExecutable(
      `${bin}/curl`,
      `#!/bin/sh
: > "$CURL_MARKER"
printf 'exit 0\\n'
`,
    );
    await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

    const command = new Deno.Command("/bin/bash", {
      args: [`${repoRoot}/install`, "--dry-run"],
      cwd: repoRoot,
      env: {
        CURL_MARKER: curlMarker,
        DENO_DIR: denoDir,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_MIN_FREE_KB: "0",
        HOME: home,
        NO_COLOR: "1",
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: temp,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code !== 0, `expected dry run to stop without Deno: ${output}`);
    assert(
      output.includes("Dry run requires a working Deno executable"),
      `expected actionable dry-run guidance, got: ${output}`,
    );
    assert(
      !await exists(curlMarker),
      `dry run invoked the Deno installer: ${output}`,
    );
    assert(
      !output.includes("Running installer"),
      `dry run continued without a working Deno: ${output}`,
    );
  },
});

Deno.test({
  name:
    "bootstrap stops before package installation when storage is insufficient",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });

    const command = new Deno.Command("/bin/bash", {
      args: [`${repoRoot}/install`, "--dry-run"],
      cwd: repoRoot,
      env: {
        DENO_DIR: denoDir,
        DOTFILES_MIN_FREE_KB: "999999999999",
        HOME: home,
        NO_COLOR: "1",
        PATH: "/usr/bin:/bin",
        TMPDIR: temp,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code !== 0, `expected storage preflight to fail: ${output}`);
    assert(
      output.includes("Insufficient free space"),
      `expected an actionable storage error, got: ${output}`,
    );
    assert(
      !output.includes("Running installer"),
      `installer continued after storage failure: ${output}`,
    );
  },
});

Deno.test({
  name: "bootstrap stops when its temporary directory is not writable",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.chmod(temp, 0o555);

    try {
      const command = new Deno.Command("/bin/bash", {
        args: [`${repoRoot}/install`],
        cwd: repoRoot,
        env: {
          DENO_DIR: denoDir,
          DOTFILES_MIN_FREE_KB: "0",
          HOME: home,
          NO_COLOR: "1",
          PATH: "/usr/bin:/bin",
          TMPDIR: temp,
        },
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stdout, stderr } = await command.output();
      const output = `${new TextDecoder().decode(stdout)}${
        new TextDecoder().decode(stderr)
      }`;

      assert(code !== 0, `expected write preflight to fail: ${output}`);
      assert(
        output.includes(`Cannot write to ${temp}`),
        `expected a write-access error, got: ${output}`,
      );
      assert(
        !output.includes("Running installer"),
        `installer continued after write failure: ${output}`,
      );
    } finally {
      await Deno.chmod(temp, 0o755);
    }
  },
});

Deno.test({
  name: "storage probe cleanup ignores a broken rm on PATH",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const temp = `${root}/tmp`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(temp, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await writeExecutable(
      `${bin}/rm`,
      "#!/bin/sh\nprintf 'rm: Illegal byte sequence\\n' >&2\nexit 1\n",
    );
    await writeExecutable(
      `${bin}/deno`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno 2.8.3 (stable, release, test)\\n'
fi
exit 0
`,
    );
    await writeExecutable(`${bin}/xcode-select`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(`${homebrewBin}/brew`, "#!/bin/sh\nexit 0\n");

    const command = new Deno.Command("/bin/bash", {
      args: [`${repoRoot}/install`],
      cwd: repoRoot,
      env: {
        DENO_DIR: denoDir,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_MIN_FREE_KB: "0",
        HOME: home,
        NO_COLOR: "1",
        PATH: `${bin}:/usr/bin:/bin`,
        TMPDIR: `${temp}/`,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code === 0, `expected storage cleanup to succeed: ${output}`);
    assert(
      !output.includes("Illegal byte sequence"),
      `installer used rm from PATH: ${output}`,
    );
  },
});

Deno.test({
  name: "Homebrew bin is available before required commands are verified",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;

    await Deno.mkdir(`${dotfiles}/local`, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await Deno.writeTextFile(
      `${dotfiles}/Brewfile`,
      'brew "just"\nbrew "mise"\n',
    );
    await writeExecutable(`${bin}/hostname`, "#!/bin/sh\nprintf test-host\n");
    await writeExecutable(
      `${bin}/which`,
      `#!/bin/sh
IFS=:
for dir in $PATH; do
  if [ -x "$dir/$1" ]; then
    exit 0
  fi
done
exit 1
`,
    );
    await writeExecutable(
      `${homebrewBin}/brew`,
      `#!/bin/sh
if [ "$1" = "bundle" ]; then
  printf 'bundle-ran\\n'
fi
exit 0
`,
    );
    await writeExecutable(`${homebrewBin}/just`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(
      `${homebrewBin}/mise`,
      `#!/bin/sh
if [ "$1" = "install" ]; then
  printf 'mise-install-ran\\n' > "$HOME/mise-install-ran"
fi
exit 0
`,
    );

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_TEST_PLATFORM: "macos",
        HOME: home,
        NO_COLOR: "1",
        PATH: bin,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code === 0, `installer failed: ${output}`);
    assert(
      await Deno.stat(`${home}/mise-install-ran`).then(() => true, () => false),
      `Homebrew mise was not used: ${output}`,
    );
    assert(
      !output.includes("Installing mise..."),
      `installer tried to install mise twice: ${output}`,
    );
  },
});

Deno.test({
  name: "Homebrew failure stops dependent phases with a concise diagnostic",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;
    const homebrewBin = `${root}/homebrew/bin`;

    await Deno.mkdir(`${dotfiles}/local`, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.mkdir(homebrewBin, { recursive: true });
    await Deno.writeTextFile(`${dotfiles}/Brewfile`, 'brew "just"\n');
    await writeExecutable(`${bin}/hostname`, "#!/bin/sh\nprintf test-host\n");
    await writeExecutable(`${bin}/which`, "#!/bin/sh\nexit 1\n");
    await writeExecutable(
      `${homebrewBin}/brew`,
      `#!/bin/sh
if [ "$1" = "bundle" ]; then
  printf 'Input/output error at /private/tmp/homebrew-unpack-test\\n' >&2
  exit 23
fi
exit 0
`,
    );

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        DOTFILES_HOMEBREW_PATH: `${homebrewBin}/brew`,
        DOTFILES_TEST_PLATFORM: "macos",
        HOME: home,
        NO_COLOR: "1",
        PATH: bin,
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code !== 0, `expected Homebrew failure: ${output}`);
    assert(
      output.includes(
        "Input/output error at /private/tmp/homebrew-unpack-test",
      ),
      `expected the root cause in the summary, got: ${output}`,
    );
    assert(
      output.includes("Full log:"),
      `expected the detailed log path, got: ${output}`,
    );
    assert(
      !output.includes("Setting up mise"),
      `installer continued into mise after Homebrew failed: ${output}`,
    );
    assert(
      !output.includes("at run ("),
      `raw stack trace leaked into normal output: ${output}`,
    );
  },
});

async function writeExecutable(path: string, contents: string): Promise<void> {
  await Deno.writeTextFile(path, contents);
  await Deno.chmod(path, 0o755);
}

Deno.test({
  name: "installer skips Homebrew bootstrap without non-interactive sudo",
  ignore: Deno.build.os !== "darwin",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.writeTextFile(`${dotfiles}/Brewfile`, 'brew "just"\n');

    await writeExecutable(
      `${bin}/hostname`,
      "#!/bin/sh\nprintf test-host\n",
    );
    await writeExecutable(`${bin}/sudo`, "#!/bin/sh\nexit 1\n");
    await writeExecutable(
      `${bin}/which`,
      '#!/bin/sh\nif [ "$1" = "mise" ]; then\n  exit 0\nfi\nexit 1\n',
    );
    await writeExecutable(`${bin}/mise`, "#!/bin/sh\nexit 0\n");
    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        DOTFILES_TEST_DISABLE_SYSTEM_BREW: "1",
        HOME: home,
        PATH: bin,
        NO_COLOR: "1",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;

    assert(code === 0, `installer failed: ${output}`);
    assert(
      output.includes("non-interactive sudo access is unavailable"),
      `expected non-admin warning, got: ${output}`,
    );
    assert(
      !output.includes("Installing Homebrew"),
      `expected Homebrew bootstrap not to run, got: ${output}`,
    );
  },
});

Deno.test({
  name: "installer --force replaces an existing symlink target",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });

    const source = `${dotfiles}/.zshrc`;
    const target = `${home}/.zshrc`;
    await Deno.writeTextFile(source, "# managed by test\n");
    await Deno.writeTextFile(target, "# existing file\n");

    await writeExecutable(
      `${bin}/hostname`,
      "#!/bin/sh\nprintf test-host\n",
    );
    await writeExecutable(
      `${bin}/which`,
      '#!/bin/sh\nif [ "$1" = "mise" ] || [ "$1" = "starship" ]; then\n  exit 0\nfi\nexit 1\n',
    );
    await writeExecutable(`${bin}/mise`, "#!/bin/sh\nexit 0\n");

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-packages",
        "--force",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        HOME: home,
        PATH: bin,
        NO_COLOR: "1",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    assert(
      code === 0,
      `installer failed: ${new TextDecoder().decode(stderr)}`,
    );

    const targetInfo = await Deno.lstat(target);
    assert(targetInfo.isSymlink, "expected existing target to be replaced");
    const linkTarget = await Deno.readLink(target);
    assert(
      linkTarget === source,
      `expected ${target} to point to ${source}, got ${linkTarget}`,
    );
  },
});

Deno.test({
  name: "installer installs starship outside apt packages on Linux",
  ignore: Deno.build.os !== "linux",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.mkdir(`${dotfiles}/local`, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });

    await writeExecutable(
      `${bin}/hostname`,
      "#!/bin/sh\nprintf test-host\n",
    );
    await writeExecutable(
      `${bin}/which`,
      `#!/bin/sh
IFS=:
for dir in $PATH; do
  if [ -x "$dir/$1" ]; then
    exit 0
  fi
done
exit 1
`,
    );
    await writeExecutable(
      `${bin}/sh`,
      `#!/bin/sh
case "$2" in
  *starship.rs*)
    /bin/mkdir -p "$4/.local/bin"
    /bin/cat > "$4/.local/bin/starship" <<'EOF'
#!/bin/sh
exit 0
EOF
    /bin/chmod +x "$4/.local/bin/starship"
    printf '%s\\n' "$4/.local/bin" > "$4/starship-bin"
    ;;
  *mise.run*)
    /bin/mkdir -p "$HOME/.local/bin"
    /bin/cat > "$HOME/.local/bin/mise" <<'EOF'
#!/bin/sh
exit 0
EOF
    /bin/chmod +x "$HOME/.local/bin/mise"
    ;;
esac
`,
    );

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-packages",
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        HOME: home,
        PATH: bin,
        NO_COLOR: "1",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    assert(
      code === 0,
      `installer failed: ${new TextDecoder().decode(stderr)}`,
    );

    const starshipBin = await Deno.readTextFile(`${home}/starship-bin`);
    assert(
      starshipBin.trim() === `${home}/.local/bin`,
      `expected starship install bin to be ${home}/.local/bin, got ${starshipBin}`,
    );
  },
});

Deno.test({
  name: "installer trusts mise and installs configured tools",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    await Deno.mkdir(dotfiles, { recursive: true });
    await Deno.mkdir(`${dotfiles}/local`, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });

    await writeExecutable(
      `${bin}/hostname`,
      "#!/bin/sh\nprintf test-host\n",
    );
    await writeExecutable(
      `${bin}/which`,
      "#!/bin/sh\nexit 1\n",
    );
    await writeExecutable(
      `${bin}/sh`,
      `#!/bin/sh
case "$1" in
  -c)
    /bin/mkdir -p "$HOME/.local/bin"
    /bin/cat > "$HOME/.local/bin/mise" <<'EOF'
#!/bin/sh
case "$1" in
  trust)
    printf '%s\\n' "$2" > "$HOME/mise-trusted"
    ;;
  install)
    pwd > "$HOME/mise-installed-from"
    ;;
esac
exit 0
EOF
    /bin/chmod +x "$HOME/.local/bin/mise"
    ;;
esac
`,
    );

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-packages",
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        HOME: home,
        PATH: bin,
        NO_COLOR: "1",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    assert(
      code === 0,
      `installer failed: ${new TextDecoder().decode(stderr)}`,
    );

    const trustedPath = await Deno.readTextFile(`${home}/mise-trusted`);
    assert(
      trustedPath.trim() === dotfiles,
      `expected mise to trust ${dotfiles}, got ${trustedPath}`,
    );

    const installedFrom = await Deno.readTextFile(
      `${home}/mise-installed-from`,
    );
    const expectedInstallDirectory = await Deno.realPath(dotfiles);
    assert(
      installedFrom.trim() === expectedInstallDirectory,
      `expected mise install to run from ${expectedInstallDirectory}, got ${installedFrom}`,
    );
  },
});

Deno.test({
  name: "bootstrap works without a controlling terminal",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await writeExecutable(
      `${bin}/deno`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  printf 'deno test\n'
fi
exit 0
`,
    );

    const bootstrap = new URL("../install", import.meta.url);
    const command = new Deno.Command("/bin/bash", {
      args: [bootstrap.pathname, "--dry-run"],
      env: {
        DENO_DIR: denoDir,
        HOME: home,
        PATH: `${bin}:/usr/bin:/bin`,
        NO_COLOR: "1",
      },
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stderr } = await command.output();
    assert(
      code === 0,
      `bootstrap failed without a TTY: ${new TextDecoder().decode(stderr)}`,
    );
  },
});

Deno.test({
  name: "Linux package errors are not reported as missing manifests",
  ignore: Deno.build.os !== "linux",
  async fn() {
    const root = await Deno.makeTempDir();
    const dotfiles = `${root}/dotfiles`;
    const home = `${root}/home`;
    const bin = `${root}/bin`;

    let packageManager: "apt" | "dnf";
    let manifest: "apt.txt" | "dnf.txt";
    try {
      await Deno.stat("/etc/debian_version");
      packageManager = "apt";
      manifest = "apt.txt";
    } catch {
      try {
        await Deno.stat("/etc/redhat-release");
        packageManager = "dnf";
        manifest = "dnf.txt";
      } catch {
        return;
      }
    }

    await Deno.mkdir(`${dotfiles}/packages`, { recursive: true });
    await Deno.mkdir(`${dotfiles}/local`, { recursive: true });
    await Deno.mkdir(home, { recursive: true });
    await Deno.mkdir(bin, { recursive: true });
    await Deno.writeTextFile(
      `${dotfiles}/packages/${manifest}`,
      "broken-package\n",
    );

    await writeExecutable(`${bin}/hostname`, "#!/bin/sh\nprintf test-host\n");
    await writeExecutable(
      `${bin}/which`,
      '#!/bin/sh\nif [ "$1" = "mise" ] || [ "$1" = "starship" ]; then\n  exit 0\nfi\nexit 1\n',
    );
    await writeExecutable(`${bin}/mise`, "#!/bin/sh\nexit 0\n");
    await writeExecutable(
      `${bin}/sudo`,
      `#!/bin/sh
if [ "$1" = "${packageManager}" ] && [ "$2" = "install" ]; then
  exit 42
fi
exit 0
`,
    );

    const installer = new URL("./install.ts", import.meta.url);
    const command = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        "--allow-write",
        "--allow-run",
        "--allow-env",
        installer.pathname,
        "--skip-symlinks",
      ],
      env: {
        DENO_DIR: denoDir,
        DOTFILES: dotfiles,
        HOME: home,
        PATH: `${bin}:/usr/bin:/bin`,
        NO_COLOR: "1",
      },
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await command.output();
    const output = `${new TextDecoder().decode(stdout)}${
      new TextDecoder().decode(stderr)
    }`;
    assert(code !== 0, `expected package failure, got: ${output}`);
    assert(
      !output.includes(`No ${manifest} found`),
      `package failure was mislabeled as a missing manifest: ${output}`,
    );
  },
});
