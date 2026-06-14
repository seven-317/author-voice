#!/usr/bin/env node
/**
 * git-context — deterministic git plumbing for the author-voice skill.
 *
 * This script does NOT call any LLM and needs no API key. It only gathers the
 * facts the agent needs, and applies a message the agent already wrote. The
 * agent that loads the skill reads this output, writes the commit/PR text under
 * the skill rules, then (for commits) feeds the approved message back here.
 *
 * Subcommands:
 *   staged            Print the staged file summary and full staged diff.
 *                     Exits non-zero if nothing is staged.
 *   branch [--base B] Print the log + summary + diff for B...HEAD (for PRs).
 *                     Base defaults to origin/HEAD, falling back to `main`.
 *   commit            Read a commit message from stdin and run `git commit`.
 *                     Uses `-F -` so multi-line bodies need no shell quoting.
 *
 * Run it (Node >= 23.6 strips the types natively; older Node: use tsx):
 *   node scripts/git-context.ts staged
 *   node scripts/git-context.ts branch --base main
 *   printf '%s' "$MESSAGE" | node scripts/git-context.ts commit
 */

import { spawn } from 'node:child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RunResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/** Errors we expect and present to the user without a stack trace. */
class CliError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// Process / git execution
// ─────────────────────────────────────────────────────────────────────────────

/** Run a command, capture stdio, optionally feed `stdinText` to stdin. */
function run(command: string, args: string[], stdinText?: string): Promise<RunResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) =>
      reject(new CliError(`Failed to run "${command}": ${err.message}`)),
    );
    child.on('close', (code) => resolvePromise({ stdout, stderr, code }));

    if (stdinText !== undefined) child.stdin.write(stdinText);
    child.stdin.end();
  });
}

/** Run git and throw a CliError on any non-zero exit. */
async function runGit(args: string[], stdinText?: string): Promise<string> {
  const res = await run('git', args, stdinText);
  if (res.code !== 0) {
    const detail = res.stderr.trim() || res.stdout.trim() || `exit code ${res.code}`;
    throw new CliError(`git ${args.join(' ')} failed:\n${detail}`);
  }
  return res.stdout;
}

async function getRepoRoot(): Promise<string> {
  const res = await run('git', ['rev-parse', '--show-toplevel']);
  if (res.code !== 0 || !res.stdout.trim()) {
    throw new CliError('Not inside a Git repository.');
  }
  return res.stdout.trim();
}

async function getCurrentBranch(repoRoot: string): Promise<string> {
  const res = await run('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD']);
  return res.code === 0 ? res.stdout.trim() : 'HEAD';
}

async function detectBaseBranch(repoRoot: string): Promise<string> {
  const res = await run('git', ['-C', repoRoot, 'rev-parse', '--abbrev-ref', 'origin/HEAD']);
  if (res.code === 0 && res.stdout.trim()) {
    return res.stdout.trim().replace(/^origin\//, '');
  }
  return 'main';
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcommands
// ─────────────────────────────────────────────────────────────────────────────

async function cmdStaged(repoRoot: string): Promise<void> {
  const diff = await runGit(['-C', repoRoot, 'diff', '--staged']);
  if (!diff.trim()) {
    throw new CliError('No staged changes. Stage something first, e.g.  git add <files>');
  }
  const stat = (await runGit(['-C', repoRoot, 'diff', '--staged', '--stat'])).trim();
  const branch = await getCurrentBranch(repoRoot);

  process.stdout.write(
    [
      `# repo: ${repoRoot}`,
      `# branch: ${branch}`,
      '',
      '# staged files:',
      stat,
      '',
      '# staged diff:',
      diff.trimEnd(),
      '',
    ].join('\n'),
  );
}

async function cmdBranch(repoRoot: string, base: string): Promise<void> {
  const range = `${base}...HEAD`;
  const log = (await runGit(['-C', repoRoot, 'log', range, '--oneline'])).trim();
  if (!log) {
    throw new CliError(`No commits between ${base} and HEAD. Nothing to describe.`);
  }
  const stat = (await runGit(['-C', repoRoot, 'diff', range, '--stat'])).trim();
  const diff = await runGit(['-C', repoRoot, 'diff', range]);
  const branch = await getCurrentBranch(repoRoot);

  process.stdout.write(
    [
      `# repo: ${repoRoot}`,
      `# branch: ${branch}`,
      `# base: ${base}`,
      '',
      '# commits on this branch:',
      log,
      '',
      '# changed files:',
      stat,
      '',
      '# diff:',
      diff.trimEnd(),
      '',
    ].join('\n'),
  );
}

async function cmdCommit(repoRoot: string): Promise<void> {
  const message = await readStdin();
  if (!message.trim()) {
    throw new CliError('Empty commit message on stdin. Nothing to commit.');
  }
  // `commit -F -` reads the full message (subject + body + footers) from stdin,
  // avoiding the quoting problems of `commit -m` on multi-line messages.
  await runGit(
    ['-C', repoRoot, 'commit', '-F', '-'],
    message.endsWith('\n') ? message : `${message}\n`,
  );
  const summary = (await runGit(['-C', repoRoot, 'log', '-1', '--oneline'])).trim();
  process.stdout.write(`Committed ${summary}\n`);
}

function readStdin(): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolvePromise(data));
    process.stdin.on('error', reject);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Argument parsing + entry point
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = 'Usage: git-context <staged|branch|commit> [--base <branch>]';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];
  let base = process.env.PR_BASE_BRANCH ?? '';

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base') {
      base = argv[++i] ?? '';
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else if (arg === '-h' || arg === '--help') {
      process.stdout.write(`${USAGE}\n`);
      return;
    } else {
      throw new CliError(`Unknown argument: ${arg}`);
    }
  }

  const repoRoot = await getRepoRoot();

  switch (subcommand) {
    case 'staged':
      await cmdStaged(repoRoot);
      break;
    case 'branch':
      await cmdBranch(repoRoot, base || (await detectBaseBranch(repoRoot)));
      break;
    case 'commit':
      await cmdCommit(repoRoot);
      break;
    case undefined:
    case '-h':
    case '--help':
      process.stdout.write(`${USAGE}\n`);
      break;
    default:
      throw new CliError(`Unknown subcommand: ${subcommand}\n${USAGE}`);
  }
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    process.stderr.write(`${err.message}\n`);
  } else {
    const detail = err instanceof Error ? (err.stack ?? err.message) : String(err);
    process.stderr.write(`Unexpected error: ${detail}\n`);
  }
  process.exitCode = 1;
});
