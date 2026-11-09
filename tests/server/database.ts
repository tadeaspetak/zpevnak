export const TEST_DATABASE = 'zpevnak_test';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgres://zpevnak:zpevnak@127.0.0.1:5434/${TEST_DATABASE}`;
