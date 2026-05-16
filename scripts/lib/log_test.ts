import { run } from "./log.ts";

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
