import { run, runLogged } from "./log.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test("run rejects when a command exits non-zero", async () => {
  let thrown: unknown;

  try {
    await run([Deno.execPath(), "eval", "Deno.exit(7)"], { silent: true });
  } catch (error) {
    thrown = error;
  }

  assert(thrown instanceof Error, "expected run to reject");
  assert(
    thrown.message.includes("exit 7"),
    `expected exit code in error message, got: ${thrown.message}`,
  );
});

Deno.test("runLogged preserves output and reports the first storage error", async () => {
  const root = await Deno.makeTempDir();
  const logPath = `${root}/command.log`;
  let thrown: unknown;

  try {
    await runLogged(
      [
        "/bin/sh",
        "-c",
        "printf 'starting\\nInput/output error at /private/tmp\\ntrailing noise\\n' >&2; exit 7",
      ],
      logPath,
    );
  } catch (error) {
    thrown = error;
  }

  assert(thrown instanceof Error, "expected runLogged to reject");
  assert(
    thrown.message.includes("Input/output error at /private/tmp"),
    `expected the storage error in the summary, got: ${thrown.message}`,
  );
  assert(
    thrown.message.includes(`Full log: ${logPath}`),
    `expected the log path in the summary, got: ${thrown.message}`,
  );
  assert(
    (await Deno.readTextFile(logPath)).includes("trailing noise"),
    "expected the complete command output in the log",
  );
});

Deno.test("runLogged reports an error before trailing progress output", async () => {
  const root = await Deno.makeTempDir();
  const logPath = `${root}/command.log`;
  let thrown: unknown;

  try {
    await runLogged(
      [
        "/bin/sh",
        "-c",
        "printf 'Error: corrupt cache link\\nDownloaded gettext\\n' >&2; exit 1",
      ],
      logPath,
    );
  } catch (error) {
    thrown = error;
  }

  assert(thrown instanceof Error, "expected runLogged to reject");
  assert(
    thrown.message.includes("\nError: corrupt cache link\nFull log:"),
    `expected the error rather than progress output, got: ${thrown.message}`,
  );
});
