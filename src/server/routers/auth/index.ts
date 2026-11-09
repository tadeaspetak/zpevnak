import { router } from '../../trpc/trpc.ts';
import { logIn } from './auth.logIn.ts';
import { logOut } from './auth.logOut.ts';
import { me } from './auth.me.ts';
import { requestPasswordReset } from './auth.requestPasswordReset.ts';
import { resendVerification } from './auth.resendVerification.ts';
import { resetPasswordProcedure } from './auth.resetPassword.ts';
import { signUp } from './auth.signUp.ts';
import { verifyEmailProcedure } from './auth.verifyEmail.ts';

export const authRouter = router({
  me,
  signUp,
  verifyEmail: verifyEmailProcedure,
  resendVerification,
  logIn,
  logOut,
  requestPasswordReset,
  resetPassword: resetPasswordProcedure,
});
