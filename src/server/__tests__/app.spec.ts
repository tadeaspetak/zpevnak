import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { createUser, db, PASSWORD, useCleanDatabase } from '#tests/server/helpers.ts';

useCleanDatabase();

const app = createApp(db);

describe('the HTTP app', () => {
  it('answers the health check', async () => {
    await request(app).get('/healthz').expect(200, { ok: true });
  });

  it('signs in with an HttpOnly cookie that later requests are recognised by', async () => {
    await createUser({ email: 'bob@example.com' });
    const login = await request(app)
      .post('/trpc/auth.logIn')
      .send({ email: 'bob@example.com', password: PASSWORD })
      .expect(200);
    const cookie = login.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^zp_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const me = await request(app)
      .get('/trpc/auth.me')
      .set('Cookie', cookie.split(';')[0] as string)
      .expect(200);
    expect(me.body.result.data.email).toBe('bob@example.com');
  });

  it('treats an unknown session cookie as signed out', async () => {
    const me = await request(app)
      .get('/trpc/auth.me')
      .set('Cookie', 'zp_session=nonsense')
      .expect(200);
    expect(me.body.result.data).toBeNull();
  });

  it('sends the error code as the message, for the client to translate', async () => {
    const res = await request(app)
      .post('/trpc/auth.logIn')
      .send({ email: 'nobody@example.com', password: 'whatever' })
      .expect(401);
    expect(res.body.error.message).toBe('INVALID_CREDENTIALS');
  });

  it('sets the security headers', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
