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
