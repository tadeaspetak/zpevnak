import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { createUser, db, PASSWORD, useCleanDatabase } from '#tests/server/helpers.ts';

useCleanDatabase();

const app = createApp(db);

describe('the HTTP app', () => {
  it('never makes or hands out an invite link on a GET (it may write one)', async () => {
    const input = encodeURIComponent(
      JSON.stringify({ kind: 'playlist', id: 1, role: 'collaborator' }),
    );
    const response = await request(app).get(`/trpc/sharing.invite?input=${input}`);
    expect(response.status).toBe(405);
  });

  it('answers the health check', async () => {
    await request(app).get('/health').expect(200, { ok: true });
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
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("frame-ancestors 'none'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  describe('at an address the app has moved from (D140)', () => {
    const OLD = 'zpevnak.tadeaspetak.com';

    it('sends a page on to the same page at zpevnak.cz, for good', async () => {
      const res = await request(app)
        .get('/verify?token=abc')
        .set('Host', OLD)
        .set('Sec-Fetch-Mode', 'navigate')
        .expect(301);
      expect(res.headers.location).toBe('https://zpevnak.cz/verify?token=abc');
    });

    it('sends a page on for a browser that only says it wants HTML', async () => {
      const res = await request(app)
        .get('/song/1')
        .set('Host', `www.zpevnak.cz`)
        .set('Accept', 'text/html,application/xhtml+xml')
        .expect(301);
      expect(res.headers.location).toBe('https://zpevnak.cz/song/1');
    });

    it('still answers the API and the health check there, for an installed app to update', async () => {
      await request(app).get('/health').set('Host', OLD).expect(200, { ok: true });
      // The service worker's update check, as a browser sends it (served by main.ts).
      await request(app)
        .get('/sw.js')
        .set('Host', OLD)
        .set('Sec-Fetch-Mode', 'same-origin')
        .set('Accept', '*/*')
        .expect((res) => expect(res.status).not.toBe(301));
      await request(app)
        .get('/trpc/auth.me')
        .set('Host', OLD)
        .set('Sec-Fetch-Mode', 'cors')
        .expect(200);
      await request(app)
        .post('/trpc/auth.logOut')
        .set('Host', OLD)
        .set('Sec-Fetch-Mode', 'navigate')
        .expect((res) => expect(res.status).not.toBe(301));
    });

    it('leaves a page at zpevnak.cz itself where it is', async () => {
      await request(app)
        .get('/health')
        .set('Host', 'zpevnak.cz')
        .set('Sec-Fetch-Mode', 'navigate')
        .expect(200);
    });
  });
});
