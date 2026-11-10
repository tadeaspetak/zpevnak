import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { check } from './bash-guard.ts';

const blocked: string[] = [
  'git push --force origin main',
  'git push origin +main',
  'git push origin +HEAD:main',
  'git push -f',
  'git push --force-with-lease origin feat/x',
  'git push --no-verify origin feat/x',
  'git push --all origin',
  'cd src && git push -f origin main',
  'command git push -f origin main',
  '/usr/bin/git push --force',
  'env FOO=1 git push -f',
  'git -C ../other push --force',
  'sh -c "git push -f origin main"',
  "bash -c 'git push -f'",
  'eval "git push --force"',
  'gcloud config configurations activate zpevnak',
  'gcloud config configurations activate default',
  'gcloud auth application-default login',
  'gcloud auth login --update-adc',
  'gcloud config configurations delete zpevnak',
  'psql postgres://user:pw@ep-wild-sun.eu-central-1.aws.neon.tech/neondb',
  'psql -h db.example.com zpevnak',
  'pg_dump --host=db.example.com zpevnak',
  "psql 'host=db.example.com dbname=x'",
  'psql "$DATABASE_URL_UNPOOLED"',
  'PGHOST=ep-wild-sun.eu-central-1.aws.neon.tech psql neondb',
  'echo $(git push -f)',
  'echo "`git push --force`"',
];

// The legitimate commands an agent runs here every day. Each guard needs its false-reject test.
const allowed: string[] = [
  'git status',
  'git push -u origin feat/song-sheet',
  'git push origin feat/maintenance',
  'git push origin main',
  'git push -u origin main',
  'git commit -m "Fix the chord layout"',
  'git log --oneline -5',
  'gcloud run deploy zpevnak --source .',
  'CLOUDSDK_ACTIVE_CONFIG_NAME=zpevnak gcloud config set project zpevnak',
  'gcloud config configurations list',
  'gcloud auth login',
  'psql postgres://zpevnak:zpevnak@127.0.0.1:5434/zpevnak',
  'psql -h localhost -U zpevnak zpevnak',
  'docker compose exec db psql -U zpevnak',
  'yarn test',
  'echo "git push -f origin main"',
  "echo '$(git push -f)'",
  "cat <<'EOF'\nsee `git push --force` in the docs\nEOF",
  'PGHOST=localhost psql zpevnak',
  'echo "today is $(date)"',
];

describe('bash guard', () => {
  it.each(blocked)('blocks %s', (command) => {
    expect(check(command)).not.toBeNull();
  });

  it.each(allowed)('allows %s', (command) => {
    expect(check(command)).toBeNull();
  });

  it('runs as a hook: exit 2 with a reason, exit 0 otherwise', () => {
    const run = (command: string) =>
      spawnSync('node', [new URL('./bash-guard.ts', import.meta.url).pathname], {
        input: JSON.stringify({ tool_input: { command } }),
        encoding: 'utf8',
        // A clean environment: the test worker's own variables make a child node hang.
        env: { PATH: process.env.PATH },
        timeout: 10_000,
      });
    const no = run('git push -f origin main');
    expect(no.status).toBe(2);
    expect(no.stderr).toMatch(/Blocked by/);
    expect(run('git status').status).toBe(0);
    expect(run('').status).toBe(0);
  });
});
