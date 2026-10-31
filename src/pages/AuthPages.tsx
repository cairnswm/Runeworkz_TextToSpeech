import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { authApi } from '../lib/authApi';
import { errMsg } from '../lib/format';
import { Button, Field, Input, Spinner } from '../components/ui';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between px-4 sm:px-6 h-16">
        <Logo />
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 animate-fade-in">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-white">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

const linkClass = 'text-orange-500 hover:text-orange-400 font-medium';

export function LoginPage() {
  const { login, authError, clearAuthError } = useAuth();
  const { notify } = useAlert();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authError) {
      notify(authError);
      clearAuthError();
    }
  }, [authError, notify, clearAuthError]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      navigate('/home', { replace: true });
    } catch (err) {
      notify(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your account">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right text-sm">
          <Link to="/forgot" className={linkClass}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Log in
        </Button>
      </form>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6">
        No account?{' '}
        <Link to="/register" className={linkClass}>
          Register
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { notify } = useAlert();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstname: '', lastname: '', username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      navigate('/home', { replace: true });
    } catch (err) {
      notify(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start generating speech in minutes">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input required value={form.firstname} onChange={set('firstname')} autoComplete="given-name" />
          </Field>
          <Field label="Last name">
            <Input required value={form.lastname} onChange={set('lastname')} autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Username">
          <Input required value={form.username} onChange={set('username')} autoComplete="username" />
        </Field>
        <Field label="Email">
          <Input type="email" required value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" required minLength={8} value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <div className="text-right text-sm">
          <Link to="/forgot" className={linkClass}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={busy} className="w-full">
          Register
        </Button>
      </form>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6">
        Already registered?{' '}
        <Link to="/login" className={linkClass}>
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const { notify } = useAlert();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await authApi.forgot(email);
      setMessage(res.message);
    } catch (err) {
      notify(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Forgot password" subtitle="Enter your email and we'll send you a reset link">
      {message ? (
        <div className="px-4 py-3 rounded-xl border text-sm text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800">
          {message}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="text-sm text-center mt-6">
        <Link to="/login" className={linkClass}>
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const code = params.get('code') ?? '';
  const { applyAuth } = useAuth();
  const { notify } = useAlert();
  const navigate = useNavigate();
  const [state, setState] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!code) return setState('invalid');
    authApi
      .checkReset(code)
      .then((r) => setState(r.used === 0 ? 'valid' : 'invalid'))
      .catch(() => setState('invalid'));
  }, [code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return notify('Passwords do not match');
    setBusy(true);
    try {
      applyAuth(await authApi.reset(code, password));
      navigate('/home', { replace: true });
    } catch (err) {
      notify(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Reset password">
      {state === 'checking' && <Spinner label="Checking reset link…" />}
      {state === 'invalid' && (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-xl border text-sm text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800">
            This reset link is invalid, has expired, or has already been used.
          </div>
          <Link to="/forgot" className={`${linkClass} text-sm`}>
            Request a new link
          </Link>
        </div>
      )}
      {state === 'valid' && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="New password">
            <Input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm password">
            <Input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            Reset password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
