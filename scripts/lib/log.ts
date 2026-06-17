/**
 * Logging utilities with colors
 */

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function supportsColor(): boolean {
  // Check for NO_COLOR env var (standard)
  if (Deno.env.get("NO_COLOR") !== undefined) return false;
  // Check for FORCE_COLOR
  if (Deno.env.get("FORCE_COLOR") !== undefined) return true;
  // Check if stdout is a TTY
  return Deno.stdout.isTerminal();
}

const useColor = supportsColor();

function colorize(color: keyof typeof colors, text: string): string {
  if (!useColor) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

export const log = {
  info: (msg: string) => console.log(colorize("blue", "ℹ"), msg),
  success: (msg: string) => console.log(colorize("green", "✓"), msg),
  warn: (msg: string) => console.log(colorize("yellow", "⚠"), msg),
  error: (msg: string) => console.error(colorize("red", "✗"), msg),
  step: (msg: string) => console.log(colorize("cyan", "→"), msg),

  header: (msg: string) => {
    console.log();
    console.log(colorize("bold", colorize("magenta", `▸ ${msg}`)));
  },

  dim: (msg: string) => console.log(colorize("dim", `  ${msg}`)),

  list: (items: string[]) => {
    for (const item of items) {
      console.log(`  • ${item}`);
    }
  },
};

/**
 * Run a command and stream output
 */
export async function run(
  cmd: string[],
  options: { cwd?: string; env?: Record<string, string>; silent?: boolean } =
    {},
): Promise<{ success: boolean; code: number }> {
  const { cwd, env, silent = false } = options;

  if (!silent) {
    log.dim(`$ ${cmd.join(" ")}`);
  }

  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    cwd,
    env: env ? { ...Deno.env.toObject(), ...env } : undefined,
    stdin: "inherit",
    stdout: silent ? "null" : "inherit",
    stderr: silent ? "null" : "inherit",
  });

  const { code } = await command.output();
  if (code !== 0) {
    throw new Error(`Command failed (exit ${code}): ${cmd.join(" ")}`);
  }

  return { success: code === 0, code };
}

/**
 * Run a command and capture output
 */
export async function capture(cmd: string[]): Promise<string> {
  const command = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });

  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Check if a command exists
 */
export async function commandExists(name: string): Promise<boolean> {
  try {
    const command = new Deno.Command("which", {
      args: [name],
      stdout: "null",
      stderr: "null",
    });
    const { code } = await command.output();
    return code === 0;
  } catch {
    return false;
  }
}
