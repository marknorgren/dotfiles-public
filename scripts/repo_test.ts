// Tests for repository-level tooling: the secret scan, formatting conventions,
// and the CI configuration that keeps them honest.
import { fromFileUrl } from "@std/path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const repoRoot = fromFileUrl(new URL("../", import.meta.url));

async function onPath(command: string): Promise<boolean> {
  try {
    const probe = new Deno.Command(command, {
      args: ["version"],
      stdout: "null",
      stderr: "null",
    });
    await probe.output();
    return true;
  } catch {
    return false;
  }
}

/** The command line `just public-scan` runs, split into argv. */
async function publicScanArgs(): Promise<string[]> {
  const justfile = await Deno.readTextFile(`${repoRoot}/justfile`);
  const lines = justfile.split("\n");
  const start = lines.findIndex((line) => line.startsWith("public-scan:"));
  assert(start !== -1, "justfile has no public-scan recipe");
  const recipe = lines[start + 1]?.trim() ?? "";
  assert(
    recipe.startsWith("gitleaks "),
    `expected public-scan to run gitleaks, got "${recipe}"`,
  );
  return recipe.split(/\s+/).slice(1);
}

const gitleaksAvailable = await onPath("gitleaks");

Deno.test({
  name: "the secret scan inspects git history, not just the working tree",
  ignore: !gitleaksAvailable,
  async fn() {
    const root = await Deno.makeTempDir();
    const git = async (...args: string[]) => {
      const command = new Deno.Command("git", {
        args,
        cwd: root,
        stdout: "null",
        stderr: "piped",
      });
      const { code, stderr } = await command.output();
      assert(
        code === 0,
        `git ${args.join(" ")} failed: ${new TextDecoder().decode(stderr)}`,
      );
    };

    await git("init", "--quiet");
    await git("config", "user.email", "test@example.invalid");
    await git("config", "user.name", "Test");

    // Assembled at runtime from random bytes so this file never contains a
    // token-shaped literal, and high-entropy because gitleaks filters
    // low-entropy matches such as a sequential alphabet.
    const alphabet =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(36));
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join(
      "",
    );
    const token = `${"ghp"}_${body}`;

    // Commit the secret, then delete it. It now exists only in history, which
    // is exactly the case a working-tree-only scan cannot see.
    await Deno.writeTextFile(`${root}/leaked.txt`, `token = "${token}"\n`);
    await git("add", "--all");
    await git("commit", "--quiet", "--message", "add");
    await git("rm", "--quiet", "leaked.txt");
    await git("commit", "--quiet", "--message", "remove");

    const scan = new Deno.Command("gitleaks", {
      args: await publicScanArgs(),
      cwd: root,
      stdout: "null",
      stderr: "null",
    });
    const { code } = await scan.output();
    assert(
      code !== 0,
      "just public-scan reported a clean repository while a secret was still " +
        "reachable in git history; CI scans history and would disagree",
    );
  },
});

/**
 * Resolve an .editorconfig property for a path the way an editor would: walk
 * the sections in order and let the last matching one win.
 */
async function editorconfigProperty(
  fileName: string,
  property: string,
): Promise<string | undefined> {
  const contents = await Deno.readTextFile(`${repoRoot}/.editorconfig`);
  let matches = false;
  let value: string | undefined;

  for (const raw of contents.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;

    const section = line.match(/^\[(.+)\]$/);
    if (section) {
      matches = new RegExp(
        `^${
          section[1]
            .replace(/[.+^$()|\\]/g, "\\$&")
            .replace(/\{([^}]+)\}/g, (_, group: string) =>
              `(${group.split(",").join("|")})`)
            .replace(/\*/g, "[^/]*")
        }$`,
      ).test(fileName);
      continue;
    }

    const [key, ...rest] = line.split("=");
    if (matches && key.trim() === property) value = rest.join("=").trim();
  }

  return value;
}

Deno.test("editorconfig agrees with deno fmt about TypeScript indentation", async () => {
  const declared = await editorconfigProperty("install.ts", "indent_size");
  assert(declared !== undefined, ".editorconfig sets no indent_size for .ts");

  // Ask deno fmt what it actually produces rather than assuming its default.
  const root = await Deno.makeTempDir();
  const sample = `${root}/sample.ts`;
  await Deno.writeTextFile(
    sample,
    "export function example(): number {\nreturn 1;\n}\n",
  );
  const format = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "--quiet", sample],
    stdout: "null",
    stderr: "piped",
  });
  const { code, stderr } = await format.output();
  assert(code === 0, new TextDecoder().decode(stderr));

  const formatted = await Deno.readTextFile(sample);
  const indented = formatted.split("\n").find((line) =>
    /^\s+return/.test(line)
  );
  assert(
    indented !== undefined,
    `deno fmt produced no indented line:\n${formatted}`,
  );
  const actual = indented.length - indented.trimStart().length;

  assert(
    Number(declared) === actual,
    `.editorconfig declares indent_size=${declared} for TypeScript but ` +
      `deno fmt writes ${actual} spaces, so an editor honouring .editorconfig ` +
      `produces diffs that \`just check\` rejects`,
  );
});

Deno.test("git normalises line endings for the scripts this repo ships", async () => {
  // The installer, the macOS defaults script, and bin/* are executed by a
  // shell. A CRLF checkout makes them fail on the shebang line, so the repo
  // must pin normalisation rather than rely on each contributor's core.autocrlf.
  const paths = ["install", ".macos", "bin/verify", "scripts/install.ts"];
  const command = new Deno.Command("git", {
    args: ["check-attr", "text", "eol", "--", ...paths],
    cwd: repoRoot,
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await command.output();
  assert(code === 0, new TextDecoder().decode(stderr));
  const attributes = new TextDecoder().decode(stdout);

  for (const path of paths) {
    assert(
      attributes.includes(`${path}: text: auto`),
      `${path} has no "text=auto" attribute:\n${attributes}`,
    );
    assert(
      attributes.includes(`${path}: eol: lf`),
      `${path} has no "eol=lf" attribute:\n${attributes}`,
    );
  }
});

Deno.test("pinned action SHAs have an update path", async () => {
  // Pinning to a commit SHA removes the automatic updates a moving tag gave
  // us, so something has to propose the bumps or the pins quietly rot.
  const workflowDir = `${repoRoot}.github/workflows`;
  const pinned: string[] = [];
  for await (const entry of Deno.readDir(workflowDir)) {
    if (!entry.isFile || !/\.ya?ml$/.test(entry.name)) continue;
    const workflow = await Deno.readTextFile(`${workflowDir}/${entry.name}`);
    for (const line of workflow.split("\n")) {
      if (/uses:\s*\S+@[0-9a-f]{40}\b/.test(line)) pinned.push(line.trim());
    }
  }

  if (pinned.length === 0) return;

  let config: string;
  try {
    config = await Deno.readTextFile(`${repoRoot}.github/dependabot.yml`);
  } catch {
    throw new Error(
      `${pinned.length} action(s) are pinned to a SHA but .github/dependabot.yml ` +
        `does not exist, so nothing will ever bump them:\n  ${
          pinned.join("\n  ")
        }`,
    );
  }

  assert(
    /package-ecosystem:\s*["']?github-actions["']?/.test(config),
    "dependabot.yml has no github-actions ecosystem entry",
  );
  assert(
    /directory:\s*["']?\/["']?/.test(config),
    'the github-actions entry must use directory "/" to cover .github/workflows',
  );
});

Deno.test("the installer pins the same Deno line CI pins", async () => {
  // `deno fmt` output changes between minor versions, so CI pins the toolchain.
  // A bootstrap that fetches whatever is current lets a fresh machine format
  // code the pinned CI gate then rejects.
  const installer = await Deno.readTextFile(`${repoRoot}install`);

  const pin = installer.match(/^DENO_VERSION="(v[0-9]+\.[0-9]+\.[0-9]+)"/m);
  assert(
    pin !== null,
    'install does not define DENO_VERSION="vX.Y.Z", so the bootstrap takes ' +
      "whatever version is current",
  );

  // Join shell line continuations so a pipeline split across lines is checked
  // as the single statement it is.
  const statements = installer
    .replace(/(\||\\)\n\s*/g, "$1 ")
    .split("\n");

  for (const statement of statements) {
    if (!statement.includes("deno.land/install.sh")) continue;
    assert(
      statement.includes("$DENO_VERSION") ||
        statement.includes("${DENO_VERSION}"),
      `installer fetches Deno without the pin: ${statement.trim()}`,
    );
  }

  const workflow = await Deno.readTextFile(
    `${repoRoot}.github/workflows/ci.yml`,
  );
  const ciPin = workflow.match(/deno-version:\s*"([^"]+)"/);
  assert(ciPin !== null, "ci.yml does not pin deno-version");

  // CI pins a range such as "~2.8"; the installer must sit inside it.
  const ciLine = ciPin[1].replace(/^[~^]/, "");
  assert(
    pin[1].slice(1).startsWith(`${ciLine}.`),
    `install pins Deno ${pin[1]} but CI pins "${ciPin[1]}"`,
  );
});

/** Run bin/verify with a controlled PATH and return its report. */
async function runVerify(pathPrefix?: string): Promise<string> {
  const env: Record<string, string> = {
    HOME: Deno.env.get("HOME") ?? "/tmp",
    PATH: pathPrefix
      ? `${pathPrefix}:${Deno.env.get("PATH")}`
      : Deno.env.get("PATH") ?? "/usr/bin:/bin",
    VERIFY_INSTALLED: "1",
  };
  const command = new Deno.Command(`${repoRoot}bin/verify`, {
    cwd: repoRoot,
    clearEnv: true,
    env,
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout);
}

Deno.test({
  name: "verify reports on the tools mise owns",
  ignore: Deno.build.os === "windows",
  async fn() {
    const root = await Deno.makeTempDir();
    const bin = `${root}/bin`;
    await Deno.mkdir(bin, { recursive: true });
    for (const tool of ["delta", "fzf"]) {
      await Deno.writeTextFile(`${bin}/${tool}`, "#!/bin/sh\nexit 0\n");
      await Deno.chmod(`${bin}/${tool}`, 0o755);
    }

    const report = await runVerify(bin);
    // git-delta is the configured git pager and fzf supplies the key bindings,
    // so a setup missing either is broken in a way verify should surface.
    for (const tool of ["delta", "fzf"]) {
      assert(
        /^[✓✗⊘] .*/m.test(report) && report.includes(tool),
        `bin/verify never mentions ${tool}:\n${report}`,
      );
      assert(
        report.includes(`✓ ${tool}`),
        `bin/verify did not pass ${tool} while it was on PATH:\n${report}`,
      );
    }
  },
});

Deno.test({
  name: "verify fails when a mise-managed tool is missing",
  // Only meaningful while delta is genuinely absent from this machine's PATH.
  ignore: await onPath("delta"),
  async fn() {
    const report = await runVerify();
    assert(
      report.includes("✗ delta"),
      `bin/verify reported no failure for a missing delta:\n${report}`,
    );
  },
});

Deno.test("the shfmt pins match across local, CI, and devcontainer", async () => {
  // shfmt formatting can differ between versions, so a contributor running
  // `just check` locally must use the same build CI enforces with.
  const toolVersions = await Deno.readTextFile(`${repoRoot}.tool-versions`);
  const local = toolVersions.match(/^(?:\S+:)?shfmt\s+(\S+)$/m);
  assert(
    local !== null,
    ".tool-versions does not pin shfmt, so a local install can format " +
      "differently from the version CI enforces",
  );

  const workflow = await Deno.readTextFile(
    `${repoRoot}.github/workflows/ci.yml`,
  );
  const ci = workflow.match(/SHFMT_VERSION:\s*v?(\S+)/);
  assert(ci !== null, "ci.yml does not pin SHFMT_VERSION");

  const dockerfile = await Deno.readTextFile(
    `${repoRoot}.devcontainer/Dockerfile`,
  );
  const devcontainer = dockerfile.match(/^ARG SHFMT_VERSION=v?(\S+)$/m);
  assert(
    devcontainer !== null,
    ".devcontainer/Dockerfile does not pin SHFMT_VERSION",
  );

  assert(
    local[1] === ci[1],
    `.tool-versions pins shfmt ${local[1]} but CI installs ${ci[1]}`,
  );
  assert(
    local[1] === devcontainer[1],
    `.tool-versions pins shfmt ${local[1]} but the devcontainer installs ${
      devcontainer[1]
    }`,
  );
});
