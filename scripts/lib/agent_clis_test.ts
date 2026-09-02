import { AGENT_CLI_INSTALLERS, agentCliInstallPath } from "./agent_clis.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("agent CLIs use the vendors' recommended native installers", () => {
  const commands = Object.fromEntries(
    AGENT_CLI_INSTALLERS.map((
      installer,
    ) => [installer.binary, installer.command]),
  );

  assert(
    commands.codex === "curl -fsSL https://chatgpt.com/codex/install.sh | sh",
    "Codex does not use the official standalone installer",
  );
  assert(
    commands.claude === "curl -fsSL https://claude.ai/install.sh | bash",
    "Claude Code does not use the recommended native installer",
  );
});

Deno.test("agent CLI installation cannot rewrite a managed profile for ChatGPT Codex", () => {
  const path = agentCliInstallPath(
    "/home/test",
    "/Applications/ChatGPT.app/Contents/Resources:/usr/bin:/home/test/.local/bin",
  );

  assert(
    path === "/home/test/.local/bin:/usr/bin",
    `unexpected sanitized installer PATH: ${path}`,
  );
});
