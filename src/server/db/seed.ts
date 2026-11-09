/**
 * Loads the songs in seeds/songs as verified, skipping any whose title and artist already
 * exist. Safe to run again, and against production.
 *
 * Against a local database it also creates the development personas (`devPersonas.ts`),
 * a song waiting for review and a playlist, so every role and state can be tried.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSong } from '#shared/chordpro/parse.ts';
import { hashPassword } from '../auth/password.ts';
import { env } from '../env.ts';
import { DEV_PASSWORD, DEV_PERSONAS } from './devPersonas.ts';
import { db } from './knex.ts';

const dir = new URL('../../../seeds/songs', import.meta.url).pathname;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(
  new URL(env.DATABASE_URL).hostname,
);

async function seedSongs() {
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.pro'))
    .sort()) {
    const source = readFileSync(join(dir, file), 'utf8');
    const song = parseSong(source);
    const title = song.meta.title?.trim();
    if (!title) {
      console.warn(`Skipped ${file}: no {title}`);
      continue;
    }
    const artist = song.artist?.trim() || null;
    const { rows } = await db.raw(
      /* sql */ `
        INSERT INTO songs (title, artist, source, status, reviewed_at)
        SELECT :title, :artist, :source, 'verified', now()
        WHERE NOT EXISTS (
          SELECT 1 FROM songs WHERE title = :title AND artist IS NOT DISTINCT FROM :artist
        )
        RETURNING id
      `,
      { title, artist, source },
    );
    console.log(rows.length ? `Added ${title} – ${artist}` : `Already there: ${title}`);
  }
}

// Made-up words: the dev data must never carry real lyrics.
const PENDING_SONG = `{title: Zkušební písnička}
{artist: Testovací kapela}
{key: G}

{start_of_verse}
[G]Tohle je jen [C]zkouška, [D]nic víc
[G]na kontrolu [Em]čeká [C]dlouho, [D]víc a víc
{end_of_verse}

{start_of_chorus}
[C]La la [D]la, [G]lo lo [Em]lo
{end_of_chorus}
`;

async function seedDevData() {
  const hash = await hashPassword(DEV_PASSWORD);
  for (const p of DEV_PERSONAS) {
    await db.raw(
      /* sql */ `
        INSERT INTO users (email, display_name, password_hash, role, email_verified_at)
        VALUES (:email, :displayName, :hash, :role, CASE WHEN :verified THEN now() END)
        ON CONFLICT (lower(email)) DO NOTHING
      `,
      { ...p, hash },
    );
  }
  const { rows: users } = await db.raw(
    /* sql */ `SELECT id FROM users WHERE email = 'user@zpevnak.test'`,
  );
  const userId: number = users[0].id;
  await db.raw(
    /* sql */ `
      INSERT INTO songs (title, artist, source, created_by)
      SELECT 'Zkušební písnička', 'Testovací kapela', :source, :userId
      WHERE NOT EXISTS (SELECT 1 FROM songs WHERE title = 'Zkušební písnička')
    `,
    { source: PENDING_SONG, userId },
  );
  const { rows: existing } = await db.raw(
    /* sql */ `SELECT 1 FROM playlists WHERE owner_id = :userId`,
    { userId },
  );
  if (existing.length === 0) {
    const { rows } = await db.raw(
      /* sql */ `
        INSERT INTO playlists (owner_id, name, is_public)
        VALUES (:userId, 'Vršek 2026', true)
        RETURNING id
      `,
      { userId },
    );
    await db.raw(
      /* sql */ `
        INSERT INTO playlist_songs (playlist_id, position, song_id)
        SELECT :playlistId, row_number() OVER (ORDER BY id), id FROM songs
      `,
      { playlistId: rows[0].id },
    );
  }
  console.log(
    `Dev personas (password "${DEV_PASSWORD}"): ${DEV_PERSONAS.map((p) => p.email).join(', ')}`,
  );
}

try {
  await seedSongs();
  if (isLocal) {
    await seedDevData();
  }
} finally {
  await db.destroy();
}
