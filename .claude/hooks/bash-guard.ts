/**
 * PreToolUse guard for Bash commands (see .claude/settings.json). A deterministic backstop
 * for the ground rules in CLAUDE.md: prompt rules can be lost when context is compacted,
 * this file cannot.
 *
 * One developer commits straight to main, so pushing main is fine. What stays guarded:
 *
 *   1. No force pushes (history on the remote is the only backup of history), no skipping
 *      hooks on push, no pushing every branch at once.
 *   2. No changing the machine's global gcloud state. The owner's default configuration
 *      (work account and project) is the one that matters on this machine; this repo uses
 *      its own `zpevnak` configuration through CLOUDSDK_ACTIVE_CONFIG_NAME and never
 *      activates it, and never touches Application Default Credentials, which are global.
 *   3. No psql/pg_dump against anything but a local database: production data is off limits.
 *
 * Exit 0 allows, exit 2 blocks (stderr is shown to the agent).
 * Test: `yarn test --project unit .claude/hooks`.
 */
import { readFileSync } from 'node:fs';

const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/;

/** Splits a shell line into words, honouring quotes. Good enough for a guard, not a shell. */
function words(command: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i] as string;
    if (quote) {
      if (ch === quote) {
        quote = null;
      } else if (ch === '\\' && quote === '"' && i + 1 < command.length) {
        i += 1;
        current += command[i];
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || current) {
        out.push(current);
      }
      current = '';
      has = false;
    } else {
      current += ch;
      has = true;
    }
  }
  if (has || current) {
    out.push(current);
  }
  return out;
}

/** The simple commands in a line: split on ; && || | and newlines (outside quotes). */
function simpleCommands(line: string): string[][] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] as string;
    if (quote) {
      current += ch;
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ';' || ch === '\n' || ch === '|' || ch === '&') {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map(words).filter((w) => w.length > 0);
}

/** Drops what only wraps a command: `VAR=x`, `env`, `command`, `sudo`, a path to the binary. */
function unwrap(argv: string[]): string[] {
  let rest = [...argv];
  for (;;) {
    const head = rest[0];
    if (head === undefined) {
      return rest;
    }
    if (
      /^[A-Za-z_][A-Za-z0-9_]*=/.test(head) ||
      ['env', 'command', 'sudo', 'exec', 'time'].includes(head)
    ) {
      rest = rest.slice(1);
      continue;
    }
    if (head.includes('/')) {
      rest = [head.slice(head.lastIndexOf('/') + 1), ...rest.slice(1)];
    }
    return rest;
  }
}

function checkGit(args: string[]): string | null {
  // Skip git's own global options: -C <dir>, -c <k=v>, --git-dir=…
  let i = 0;
  while (i < args.length && args[i]?.startsWith('-')) {
    i += args[i] === '-C' || args[i] === '-c' ? 2 : 1;
  }
  const sub = args[i];
  const rest = args.slice(i + 1);
  if (sub !== 'push') {
    return null;
  }
  if (rest.some((a) => a === '-f' || a.startsWith('--force') || /^-[a-z]*f/.test(a))) {
    return 'Force pushes are not allowed. Push a new commit instead.';
  }
  if (rest.some((a) => '--no-verify'.startsWith(a) && a.startsWith('--no-v'))) {
    return 'Skipping hooks on push is not allowed. Fix what the hook reports.';
  }
  if (rest.some((a) => a === '--all' || a === '--mirror')) {
    return 'Pushing every branch is not allowed. Push the one branch you mean.';
  }
  if (rest.some((a) => a.startsWith('+') || a.includes(':+') || /:\+/.test(a))) {
    return 'A +ref push is a force push. Push a new commit instead.';
  }
  return null;
}

function checkGcloud(args: string[]): string | null {
  const joined = args.join(' ');
  if (/\bconfig configurations activate\b/.test(joined)) {
    return 'Switching the active gcloud configuration changes the machine-wide default. This repo uses CLOUDSDK_ACTIVE_CONFIG_NAME=zpevnak instead.';
  }
  if (/\bauth application-default\b/.test(joined) || args.includes('--update-adc')) {
    return 'Application Default Credentials are global to the machine and belong to the work setup. Leave them alone.';
  }
  if (/\bconfig configurations (delete|rename)\b/.test(joined)) {
    return 'Deleting or renaming gcloud configurations is for the owner to do by hand.';
  }
  return null;
}

function hostsIn(args: string[]): string[] {
  const hosts: string[] = [];
  args.forEach((arg, i) => {
    const url = /^postgres(?:ql)?:\/\/(?:[^@/]*@)?(\[[^\]]+\]|[^:/?]+)/.exec(arg);
    if (url?.[1]) {
      hosts.push(url[1]);
    }
    if ((arg === '-h' || arg === '--host') && args[i + 1]) {
      hosts.push(args[i + 1] as string);
    }
    const inline = /^(?:--host=|-h)(.+)$/.exec(arg);
    if (inline?.[1]) {
      hosts.push(inline[1]);
    }
    const kv = /\bhost=([^\s]+)/.exec(arg);
    if (kv?.[1]) {
      hosts.push(kv[1]);
    }
  });
  return hosts;
}

function checkPostgres(args: string[]): string | null {
  const remote = hostsIn(args).find((h) => !LOCAL_HOSTS.test(h));
  return remote
    ? `Connecting to ${remote} is not allowed: only local databases. Ask the owner to run it.`
    : null;
}

export function check(command: string, depth = 0): string | null {
  if (depth > 3) {
    return null;
  }
  for (const raw of simpleCommands(command)) {
    const argv = unwrap(raw);
    const [bin, ...args] = argv;
    if (!bin) {
      continue;
    }
    // A command run through a shell or eval is checked as the command it runs.
    if (
      (bin === 'sh' || bin === 'bash' || bin === 'zsh') &&
      args[0] === '-c' &&
      args[1]
    ) {
      const inner = check(args[1], depth + 1);
      if (inner) {
        return inner;
      }
      continue;
    }
    if (bin === 'eval') {
      const inner = check(args.join(' '), depth + 1);
      if (inner) {
        return inner;
      }
      continue;
    }
    const verdict =
      bin === 'git'
        ? checkGit(args)
        : bin === 'gcloud'
          ? checkGcloud(args)
          : ['psql', 'pg_dump', 'pg_restore', 'pg_dumpall'].includes(bin)
            ? checkPostgres(args)
            : null;
    if (verdict) {
      return verdict;
    }
  }
  return null;
}

if (import.meta.main) {
  let command = '';
  try {
    const input = JSON.parse(readFileSync(0, 'utf8')) as {
      tool_input?: { command?: unknown };
    };
    command =
      typeof input.tool_input?.command === 'string' ? input.tool_input.command : '';
  } catch {
    process.exit(0);
  }
  const reason = check(command);
  if (reason) {
    process.stderr.write(`Blocked by .claude/hooks/bash-guard.ts: ${reason}\n`);
    process.exit(2);
  }
}
