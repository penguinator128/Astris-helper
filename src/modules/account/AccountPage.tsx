import { useState } from 'react';
import { Link } from 'react-router';
import { Cloud, CloudOff, LogOut, RefreshCw } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { TextField } from '@/components/Field';
import { useCloud } from '@/store/cloud';
import { toast } from '@/store/toast';
import '@/modules/cameras/cameras.css';
import './account.css';

function ago(t: number | null): string {
  if (!t) return 'not yet';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString('en-AU');
}

export default function AccountPage() {
  const cloud = useCloud();
  return (
    <main className="page">
      <PageHead index="Account" title="Account" sub="Sign in to keep your production plans, saved rigs, cameras and lenses on every device you use." />
      <div className="stack account">
        {cloud.message && <p className="account-note" role="status">{cloud.message}</p>}
        {!cloud.configured ? <NotSetUp /> : cloud.user ? <SignedIn /> : cloud.status === 'loading' ? <p className="muted">Checking…</p> : <SignInForm />}
        <Blueprint title="What is saved where" index="i">
          <ul className="tiny account-list">
            <li>Everything always saves on this device first, and works offline.</li>
            <li>Signed in, your plans, saved rigs, cameras, lenses and plan images are copied to your account and to your other devices, a few seconds after each change.</li>
            <li>If the same plan was changed on two devices before they synced, you keep both: the other device's version arrives as a copy. Nothing is overwritten.</li>
            <li>App settings (theme, units, location) stay per device.</li>
          </ul>
        </Blueprint>
      </div>
    </main>
  );
}

function SignInForm() {
  const cloud = useCloud();
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /.+@.+\..+/.test(email.trim());
  async function go(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const e = await action();
    setBusy(false);
    if (e) setError(e);
  }
  return (
    <Blueprint title={mode === 'up' ? 'Create an account' : mode === 'forgot' ? 'Reset your password' : 'Sign in'} index="A">
      <form
        className="stack stack--sm"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return setError('Enter your email address.');
          if (mode === 'forgot') return void go(() => cloud.resetPassword(email));
          if (password.length < 6) return setError('Use a password of at least 6 characters.');
          void go(() => (mode === 'up' ? cloud.signUp(email, password) : cloud.signIn(email, password)));
        }}
      >
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} />
        {mode !== 'forgot' && <TextField label="Password" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} hint={mode === 'up' ? 'At least 6 characters.' : undefined} />}
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? 'One moment…' : mode === 'up' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
        </Button>
        {mode === 'in' && (
          <Button variant="quiet" block disabled={busy || !valid} onClick={() => void go(() => cloud.sendLink(email))}>
            Email me a sign-in link instead
          </Button>
        )}
        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="link-btn" onClick={() => setMode(mode === 'up' ? 'in' : 'up')}>
            {mode === 'up' ? 'I already have an account' : 'Create an account'}
          </button>
          {mode !== 'forgot' ? (
            <button type="button" className="link-btn" onClick={() => setMode('forgot')}>
              Forgot password?
            </button>
          ) : (
            <button type="button" className="link-btn" onClick={() => setMode('in')}>
              Back to sign in
            </button>
          )}
        </div>
      </form>
    </Blueprint>
  );
}

function SignedIn() {
  const cloud = useCloud();
  const [pw, setPw] = useState('');
  const recovering = /new password/i.test(cloud.message ?? '');
  const label: Record<string, string> = { idle: 'Up to date', syncing: 'Syncing…', offline: 'Offline: will sync when you are back online', error: 'Could not sync', loading: 'Checking…' };
  return (
    <>
      <Blueprint title="Signed in" index="A" aside={cloud.status === 'offline' || cloud.status === 'error' ? <CloudOff size={16} aria-hidden /> : <Cloud size={16} aria-hidden />}>
        <div className="stack stack--sm">
          <div className="kv">
            <span className="micro">Account</span>
            <strong>{cloud.user!.email}</strong>
          </div>
          <div className="kv">
            <span className="micro">Sync</span>
            <span>
              {label[cloud.status] ?? cloud.status} · last synced {ago(cloud.lastSync)}
            </span>
          </div>
          <div className="cluster">
            <Button size="sm" icon={<RefreshCw size={14} />} disabled={cloud.status === 'syncing'} onClick={() => void cloud.syncNow().then(() => useCloud.getState().status === 'idle' && toast('Synced'))}>
              Sync now
            </Button>
            <Button size="sm" variant="quiet" icon={<LogOut size={14} />} onClick={() => void cloud.signOut()}>
              Sign out
            </Button>
          </div>
          <p className="tiny muted">Signing out keeps everything on this device. See all your plans in <Link to="/projects">My Production Plans</Link>.</p>
        </div>
      </Blueprint>
      {recovering && (
        <Blueprint title="New password" index="P">
          <form
            className="stack stack--sm"
            onSubmit={(e) => {
              e.preventDefault();
              void cloud.setPassword(pw).then((err) => toast(err ?? 'Password changed'));
            }}
          >
            <TextField label="New password" type="password" autoComplete="new-password" value={pw} onChange={setPw} />
            <Button type="submit" variant="primary" disabled={pw.length < 6}>
              Save new password
            </Button>
          </form>
        </Blueprint>
      )}
    </>
  );
}

function NotSetUp() {
  return (
    <Blueprint title="Accounts are not switched on yet" index="A">
      <div className="stack stack--sm">
        <p className="small">This copy of the app has no account server connected, so everything is saved on this device only (it still works fully, offline too). To switch accounts on, whoever runs the site does this once:</p>
        <ol className="small account-list">
          <li>Create a free project at supabase.com.</li>
          <li>In its SQL editor, run the file <code>supabase/schema.sql</code> from this app's code.</li>
          <li>In Vercel, add the environment variables <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Supabase: Project Settings, API), then redeploy.</li>
        </ol>
        <p className="tiny muted">Until then you can move plans between devices with Shoot Pack, Backup.</p>
      </div>
    </Blueprint>
  );
}
