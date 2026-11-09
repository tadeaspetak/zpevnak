import {
  Alert,
  Anchor,
  Button,
  Center,
  Loader,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PASSWORD_MIN } from '#shared/validators/index.ts';
import { ErrorText } from '../components/ErrorText.tsx';
import { Page } from '../components/Page.tsx';
import { PageHeader } from '../components/PageHeader.tsx';
import { useI18n } from '../i18n/index.tsx';
import { trpc } from '../trpc.ts';
import { url } from '../urls.ts';

/** Where to go after signing in. Only paths inside the app: never an open redirect. */
function useNext() {
  const [params] = useSearchParams();
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : url.home();
}

function AuthPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={title} backTo={url.home()} backLabel={t('nav.backHome')} />
      <Page>
        <Stack maw={420} mx="auto" gap="md">
          {children}
        </Stack>
      </Page>
    </>
  );
}

function useSignedIn() {
  const utils = trpc.useUtils();
  return () => utils.auth.me.invalidate();
}

export function LogInPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const next = useNext();
  const signedIn = useSignedIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const logIn = trpc.auth.logIn.useMutation({
    onSuccess: async () => {
      await signedIn();
      navigate(next, { replace: true });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    logIn.mutate({ email, password });
  };
  return (
    <AuthPage title={t('auth.logInTitle')}>
      <form onSubmit={submit}>
        <Stack>
          <ErrorText error={logIn.error} />
          <TextInput
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <PasswordInput
            label={t('auth.password')}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" loading={logIn.isPending}>
            {t('auth.logIn')}
          </Button>
        </Stack>
      </form>
      <Anchor component={Link} to={url.forgotPassword()} size="sm">
        {t('auth.forgot')}
      </Anchor>
      <Text size="sm">
        {t('auth.noAccount')}{' '}
        <Anchor component={Link} to={url.signUp()}>
          {t('auth.signUp')}
        </Anchor>
      </Text>
      <Text size="sm" c="dimmed">
        {t('auth.whyAccount')}
      </Text>
    </AuthPage>
  );
}

export function SignUpPage() {
  const { t, locale } = useI18n();
  const signedIn = useSignedIn();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const signUp = trpc.auth.signUp.useMutation({ onSuccess: () => signedIn() });
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: { currentTarget: { value: string } }) =>
      setForm((f) => ({ ...f, [key]: e.currentTarget.value })),
  });

  if (signUp.data) {
    return (
      <AuthPage title={t('auth.signUpTitle')}>
        <Alert variant="light">
          {signUp.data.signedIn ? t('auth.signedUp') : t('auth.signUpPending')}
        </Alert>
        <Button component={Link} to={url.home()} variant="light">
          {t('notFound.home')}
        </Button>
      </AuthPage>
    );
  }
  return (
    <AuthPage title={t('auth.signUpTitle')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signUp.mutate({ ...form, locale });
        }}
      >
        <Stack>
          <ErrorText error={signUp.error} />
          <TextInput
            label={t('auth.displayName')}
            description={t('auth.displayNameHint')}
            autoComplete="nickname"
            required
            maxLength={60}
            {...field('displayName')}
          />
          <TextInput
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            {...field('email')}
          />
          <PasswordInput
            label={t('auth.password')}
            description={t('auth.passwordHint', { min: PASSWORD_MIN })}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            {...field('password')}
          />
          <Button type="submit" loading={signUp.isPending}>
            {t('auth.signUp')}
          </Button>
        </Stack>
      </form>
      <Text size="sm">
        {t('auth.haveAccount')}{' '}
        <Anchor component={Link} to={url.logIn()}>
          {t('auth.logIn')}
        </Anchor>
      </Text>
    </AuthPage>
  );
}

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const request = trpc.auth.requestPasswordReset.useMutation();
  return (
    <AuthPage title={t('auth.forgotTitle')}>
      {request.isSuccess ? (
        <Alert variant="light">{t('auth.linkSent', { email })}</Alert>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request.mutate({ email });
          }}
        >
          <Stack>
            <Text size="sm">{t('auth.forgotIntro')}</Text>
            <ErrorText error={request.error} />
            <TextInput
              label={t('auth.email')}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <Button type="submit" loading={request.isPending}>
              {t('auth.sendLink')}
            </Button>
          </Stack>
        </form>
      )}
    </AuthPage>
  );
}

export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const signedIn = useSignedIn();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      await signedIn();
      navigate(url.home(), { replace: true });
    },
  });
  return (
    <AuthPage title={t('auth.resetTitle')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          reset.mutate({ token, password });
        }}
      >
        <Stack>
          <ErrorText error={reset.error} />
          <PasswordInput
            label={t('auth.newPassword')}
            description={t('auth.passwordHint', { min: PASSWORD_MIN })}
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
          <Button type="submit" loading={reset.isPending}>
            {t('auth.setPassword')}
          </Button>
        </Stack>
      </form>
      {reset.error && (
        <Anchor component={Link} to={url.forgotPassword()} size="sm">
          {t('auth.forgot')}
        </Anchor>
      )}
    </AuthPage>
  );
}

export function VerifyEmailPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const signedIn = useSignedIn();
  const verify = trpc.auth.verifyEmail.useMutation({ onSuccess: () => signedIn() });
  // Strict mode mounts twice in development; the token can be used only once.
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current && token) {
      sent.current = true;
      verify.mutate({ token });
    }
  }, [token, verify]);
  return (
    <AuthPage title={t('auth.verifyTitle')}>
      {verify.isSuccess ? (
        <>
          <Alert variant="light" color="green">
            {t('auth.verified')}
          </Alert>
          <Button component={Link} to={url.home()}>
            {t('notFound.home')}
          </Button>
        </>
      ) : verify.isError || !token ? (
        <>
          <ErrorText error={verify.error ?? { message: 'INVALID_TOKEN' }} />
          <Anchor component={Link} to={url.account()}>
            {t('account.resend')}
          </Anchor>
        </>
      ) : (
        <Center py="xl">
          <Loader />
        </Center>
      )}
    </AuthPage>
  );
}
