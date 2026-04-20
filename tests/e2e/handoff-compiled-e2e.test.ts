import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  BUILD_TIMEOUT_MS,
  SLOW_CLI_TIMEOUT_MS,
  buildCompiledCli,
  expectJson,
  initGitRepo,
  runCompiled,
} from "../helpers/run-compiled-cli.js";
import { runCommand } from "../helpers/command-runner.js";

let tmpDir: string;

beforeAll(buildCompiledCli, BUILD_TIMEOUT_MS);

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "maestro-handoff-e2e-"));
  await initGitRepo(tmpDir);
  await runCommand(["git", "config", "user.name", "Test User"], tmpDir);
  await runCommand(["git", "config", "user.email", "test@example.com"], tmpDir);
  await writeFile(join(tmpDir, "README.md"), "# temp\n");
  await runCommand(["git", "add", "README.md"], tmpDir);
  await runCommand(["git", "commit", "-m", "init"], tmpDir);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function installFakeProvider(
  name: "codex" | "claude",
  argsPath: string,
  cwdPath: string,
): Promise<string> {
  const binDir = join(tmpDir, "bin");
  await Bun.$`mkdir -p ${binDir}`.quiet();
  const scriptPath = join(binDir, name);
  const script = `#!/bin/sh
printf '%s\n' "$PWD" > "$FAKE_PROVIDER_CWD"
printf '%s\n' "$@" > "$FAKE_PROVIDER_ARGS"
echo "${name} output"
`;
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);
  return binDir;
}

async function installFailingProvider(
  name: "codex" | "claude",
): Promise<string> {
  const binDir = join(tmpDir, "bin-fail");
  await Bun.$`mkdir -p ${binDir}`.quiet();
  const scriptPath = join(binDir, name);
  const script = `#!/bin/sh
echo "${name} failed" 1>&2
exit 7
`;
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);
  return binDir;
}

async function waitForFile(path: string, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await access(path);
      return;
    } catch {
      await Bun.sleep(50);
    }
  }

  throw new Error(`Timed out waiting for file: ${path}`);
}

describe("compiled handoff launcher E2E", () => {
  it(
    "launches codex by default, writes prompt artifacts, and returns launch metadata",
    async () => {
      const argsPath = join(tmpDir, "codex-args.txt");
      const cwdPath = join(tmpDir, "codex-cwd.txt");
      const binDir = await installFakeProvider("codex", argsPath, cwdPath);

      const result = await runCompiled(
        ["handoff", "Investigate the bundle export regression", "--json"],
        tmpDir,
        {
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            FAKE_PROVIDER_ARGS: argsPath,
            FAKE_PROVIDER_CWD: cwdPath,
          },
        },
      );

      expect(result.exitCode).toBe(0);
      const record = expectJson<{
        id: string;
        provider: string;
        model: string;
        status: string;
        promptPath: string;
        outputPath: string;
        command: string[];
        pid?: number;
      }>(result);

      expect(record.provider).toBe("codex");
      expect(record.model).toBe("gpt-5.4");
      expect(record.status).toBe("launched");
      expect(record.pid).toBeDefined();

      await waitForFile(argsPath);
      await waitForFile(cwdPath);

      const prompt = await readFile(join(tmpDir, record.promptPath), "utf8");
      expect(prompt).toContain("## Task");
      expect(prompt).toContain("## Acceptance Criteria");

      const launchMeta = await readFile(join(tmpDir, ".maestro", "launches", record.id, "launch.json"), "utf8");
      expect(launchMeta).toContain('"provider": "codex"');

      const loggedArgs = await readFile(argsPath, "utf8");
      expect(loggedArgs).toContain("exec");
      expect(loggedArgs).toContain("--cd");
      expect(loggedArgs).toContain("--full-auto");
      expect(loggedArgs).toContain("gpt-5.4");

      const loggedCwd = (await readFile(cwdPath, "utf8")).trim();
      expect(loggedCwd.endsWith(basename(tmpDir))).toBe(true);
    },
    SLOW_CLI_TIMEOUT_MS,
  );

  it(
    "launches claude in a sibling worktree and waits for completion when requested",
    async () => {
      const argsPath = join(tmpDir, "claude-args.txt");
      const cwdPath = join(tmpDir, "claude-cwd.txt");
      const binDir = await installFakeProvider("claude", argsPath, cwdPath);

      const result = await runCompiled(
        [
          "handoff",
          "Finish the worktree handoff flow",
          "--provider",
          "claude",
          "--worktree",
          "finish-worktree",
          "--wait",
          "--json",
        ],
        tmpDir,
        {
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            FAKE_PROVIDER_ARGS: argsPath,
            FAKE_PROVIDER_CWD: cwdPath,
          },
        },
      );

      expect(result.exitCode).toBe(0);
      const record = expectJson<{
        id: string;
        provider: string;
        model: string;
        status: string;
        exitCode?: number;
        worktree?: {
          path: string;
          branch: string;
          baseBranch: string;
        };
        outputPath: string;
      }>(result);

      expect(record.provider).toBe("claude");
      expect(record.model).toBe("opus");
      expect(record.status).toBe("completed");
      expect(record.exitCode).toBe(0);
      expect(record.worktree).toMatchObject({
        branch: "claude/finish-worktree",
        baseBranch: "main",
      });
      expect(record.worktree?.path.endsWith(`${basename(tmpDir)}-finish-worktree`)).toBe(true);

      const loggedArgs = await readFile(argsPath, "utf8");
      expect(loggedArgs).toContain("--print");
      expect(loggedArgs).toContain("--permission-mode");
      expect(loggedArgs).toContain("bypassPermissions");
      expect(loggedArgs).toContain("opus");

      const loggedCwd = (await readFile(cwdPath, "utf8")).trim();
      expect(loggedCwd).toBe(record.worktree?.path);

      const outputLog = await readFile(join(tmpDir, record.outputPath), "utf8");
      expect(outputLog).toContain("claude output");
    },
    SLOW_CLI_TIMEOUT_MS,
  );

  it(
    "creates a sibling worktree from the repo root when launched from a nested cwd",
    async () => {
      const argsPath = join(tmpDir, "claude-nested-args.txt");
      const cwdPath = join(tmpDir, "claude-nested-cwd.txt");
      const nestedDir = join(tmpDir, "nested", "deeper");
      await Bun.$`mkdir -p ${nestedDir}`.quiet();
      const binDir = await installFakeProvider("claude", argsPath, cwdPath);

      const result = await runCompiled(
        [
          "handoff",
          "Create the nested cwd worktree",
          "--provider",
          "claude",
          "--worktree",
          "nested-cwd",
          "--wait",
          "--json",
        ],
        nestedDir,
        {
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
            FAKE_PROVIDER_ARGS: argsPath,
            FAKE_PROVIDER_CWD: cwdPath,
          },
        },
      );

      expect(result.exitCode).toBe(0);
      const record = expectJson<{
        worktree?: {
          path: string;
          branch: string;
          baseBranch: string;
        };
      }>(result);

      expect(record.worktree).toMatchObject({
        branch: "claude/nested-cwd",
        baseBranch: "main",
      });
      expect(record.worktree?.path.endsWith(`${basename(tmpDir)}-nested-cwd`)).toBe(true);
      expect(record.worktree?.path.includes(`${basename(nestedDir)}-nested-cwd`)).toBe(false);

      const loggedCwd = (await readFile(cwdPath, "utf8")).trim();
      expect(loggedCwd).toBe(record.worktree?.path);
    },
    SLOW_CLI_TIMEOUT_MS,
  );

  it(
    "fails the CLI in --wait mode when the provider exits non-zero",
    async () => {
      const binDir = await installFailingProvider("claude");

      const result = await runCompiled(
        ["handoff", "Fail the waited handoff", "--provider", "claude", "--wait", "--json"],
        tmpDir,
        {
          env: {
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
          },
        },
      );

      expect(result.exitCode).not.toBe(0);
      const payload = expectJson<{ error: string; hints: string[] }>(result);
      expect(payload.error).toContain("claude handoff exited with code 7");
      expect(payload.hints.join(" ")).toContain("Launch record:");

      const launchesDir = join(tmpDir, ".maestro", "launches");
      const [launchId] = await Bun.$`ls ${launchesDir}`.text().then((text) => text.trim().split("\n").filter(Boolean));
      expect(launchId).toBeDefined();
      const launchRecord = JSON.parse(await readFile(join(launchesDir, launchId!, "launch.json"), "utf8")) as {
        status: string;
        exitCode?: number;
      };
      expect(launchRecord.status).toBe("failed");
      expect(launchRecord.exitCode).toBe(7);
    },
    SLOW_CLI_TIMEOUT_MS,
  );
});
