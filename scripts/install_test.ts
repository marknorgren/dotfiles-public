function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

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
