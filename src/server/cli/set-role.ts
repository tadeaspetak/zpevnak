/**
 * Gives an existing account a role. The way to make the first admin:
 *   node src/server/cli/set-role.ts you@example.com admin
 * After that, admins promote people in the app.
 */
import { roleSchema } from '#shared/validators/index.ts';
import { db } from '../db/knex.ts';

const [email, roleArg] = process.argv.slice(2);
const role = roleSchema.safeParse(roleArg);

try {
  if (!email || !role.success) {
    console.error('Usage: node src/server/cli/set-role.ts <email> user|editor|admin');
    process.exitCode = 1;
  } else {
    const { rowCount } = await db.raw(
      /* sql */ `UPDATE users SET role = :role WHERE lower(email) = lower(:email)`,
      { email, role: role.data },
    );
    if (rowCount === 0) {
      console.error(`No account with the email ${email}. Sign up in the app first.`);
      process.exitCode = 1;
    } else {
      console.log(`${email} is now ${role.data}`);
    }
  }
} finally {
  await db.destroy();
}
