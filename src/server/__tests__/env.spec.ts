import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** Runs `code` as its own Node process, with `env` in place of the test's environment. */
function run(code: string, env: Record<string, string>) {
  try {
    execFileSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { PATH: process.env.PATH ?? '', ...env },
      stdio: 'pipe',
    });
    return { ok: true, stderr: '' };
  } catch (error) {
    return { ok: false, stderr: String((error as { stderr?: Buffer }).stderr) };
  }
}

describe('the environment', () => {
  it('lets migrations load in production without the email key', () => {
    // Migrations run on boot in the container; they only need the database (898bc16).
    const result = run(
      `await import('${new URL('../db/knex.ts', import.meta.url).pathname}');`,
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://nobody@127.0.0.1:1/none',
      },
    );
    expect(result).toEqual({ ok: true, stderr: '' });
  });
});
