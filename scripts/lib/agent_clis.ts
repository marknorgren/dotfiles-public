export interface AgentCliInstaller {
  name: string;
  binary: string;
  command: string;
  documentation: string;
}

export const AGENT_CLI_INSTALLERS: readonly AgentCliInstaller[] = [
  {
    name: "OpenAI Codex CLI",
    binary: "codex",
    command: "curl -fsSL https://chatgpt.com/codex/install.sh | sh",
    documentation: "https://learn.chatgpt.com/docs/codex/cli",
  },
  {
    name: "Anthropic Claude Code",
    binary: "claude",
    command: "curl -fsSL https://claude.ai/install.sh | bash",
    documentation: "https://code.claude.com/docs/en/installation",
  },
] as const;

/**
 * Put the native install directory first and hide the Codex binary bundled
 * inside ChatGPT.app. Otherwise the Codex installer treats that app binary as
 * a conflicting package-manager install and writes a literal path to the shell
 * profile, which may be a managed dotfiles symlink.
 */
export function agentCliInstallPath(
  homeDir: string,
  currentPath: string,
): string {
  const installDir = `${homeDir}/.local/bin`;
  const entries = currentPath.split(":").filter((entry) =>
    entry && entry !== installDir &&
    !entry.includes("/Applications/ChatGPT.app/Contents/Resources")
  );
  return [installDir, ...entries].join(":");
}
