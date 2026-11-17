import { create } from 'zustand';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CLOUD_KEY, CLOUD_URL, BUCKET, TABLE, cloudConfigured } from '@/lib/cloud/config';
import { planSync, mergeLibrary, sameLibrary, isBlank, type CloudRow, type SyncBase } from '@/lib/cloud/plan';
import { imageIdsOf } from '@/lib/backup';
import { uid } from '@/lib/id';
import { dbGetImage, dbGetMeta, dbPutImage, dbPutMeta } from './db';
import { useProjects, flushProjects, DELETES_KEY } from './projects';
import { useLibrary, type Library } from './library';
import type { Project } from '@/types/project';

export type CloudStatus = 'off' | 'loading' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';

interface CloudStore {
  configured: boolean;
  status: CloudStatus;
  user: { id: string; email: string } | null;
  lastSync: number | null;
  message: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  sendLink: (email: string) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  setPassword: (password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
}

let client: SupabaseClient | null = null;
async function getClient(): Promise<SupabaseClient> {
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } });
  return client;
}

const baseKey = (userId: string) => `sync-base:${userId}`;
const pullKey = (userId: string) => `sync-pulled:${userId}`;
const imgKey = (userId: string) => `sync-images:${userId}`;

/** Friendly wording for the errors people actually see. */
function explain(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(m)) return 'That email and password do not match. Check them, or use "Email me a sign-in link".';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email first: open the link we sent you.';
  if (/user already registered/i.test(m)) return 'There is already an account with this email. Sign in instead.';
  if (/password should be at least/i.test(m)) return 'Use a password of at least 6 characters.';
  if (/rate limit/i.test(m)) return 'Too many tries in a short time. Wait a minute and try again.';
  if (/failed to fetch|network/i.test(m)) return 'Could not reach the server. Check your connection.';
  if (/relation .* does not exist|could not find the table/i.test(m)) return 'The cloud database is not set up yet: run supabase/schema.sql in your Supabase project (see the README).';
  return m;
}

let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export const useCloud = create<CloudStore>((set, get) => ({
  configured: cloudConfigured(),
  status: cloudConfigured() ? 'loading' : 'off',
  user: null,
  lastSync: null,
  message: null,

  init: async () => {
    if (!cloudConfigured()) return;
    const sb = await getClient();
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    set({ user: u ? { id: u.id, email: u.email ?? '' } : null, status: u ? 'idle' : 'signed-out', lastSync: u ? ((await dbGetMeta<number>(`sync-last:${u.id}`)) ?? null) : null });
    sb.auth.onAuthStateChange((event, session) => {
      const su = session?.user;
      set({ user: su ? { id: su.id, email: su.email ?? '' } : null, status: su ? (get().status === 'syncing' ? 'syncing' : 'idle') : 'signed-out' });
      if (event === 'SIGNED_IN') void get().syncNow();
      if (event === 'PASSWORD_RECOVERY') set({ message: 'Choose a new password below.' });
    });
    if (u) void get().syncNow();
    // Sync soon after changes, when the app goes to the background, and when the connection comes back.
    useProjects.subscribe(() => scheduleSync());
    useLibrary.subscribe(() => scheduleSync());
    window.addEventListener('online', () => void get().syncNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void get().syncNow();
    });
  },

  signIn: async (email, password) => {
    try {
      const sb = await getClient();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return null;
    } catch (e) {
      return explain(e);
    }
  },
  signUp: async (email, password) => {
    try {
      const sb = await getClient();
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${location.origin}/account` } });
      if (error) throw error;
      if (!data.session) set({ message: `Almost there: we sent a link to ${email.trim()}. Open it on this device to finish creating your account.` });
      return null;
    } catch (e) {
      return explain(e);
    }
  },
  sendLink: async (email) => {
    try {
      const sb = await getClient();
      const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/account` } });
      if (error) throw error;
      set({ message: `Sign-in link sent to ${email.trim()}. Open it on this device.` });
      return null;
    } catch (e) {
      return explain(e);
    }
  },
  resetPassword: async (email) => {
    try {
      const sb = await getClient();
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/account` });
      if (error) throw error;
      set({ message: `If there is an account for ${email.trim()}, a reset link is on its way.` });
      return null;
    } catch (e) {
      return explain(e);
    }
  },
  setPassword: async (password) => {
    try {
      const sb = await getClient();
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      set({ message: 'Password changed.' });
      return null;
    } catch (e) {
      return explain(e);
    }
  },
  signOut: async () => {
    await get().syncNow();
    const sb = await getClient();
    await sb.auth.signOut();
    set({ user: null, status: 'signed-out', message: 'Signed out. Your plans stay on this device.' });
  },

  syncNow: async () => {
    if (running) return running;
    const user = get().user;
    if (!user || !cloudConfigured()) return;
    if (!navigator.onLine) {
      set({ status: 'offline' });
      return;
    }
    running = (async () => {
      set({ status: 'syncing', message: null });
      try {
        await runSync(await getClient(), user.id);
        const now = Date.now();
        await dbPutMeta(`sync-last:${user.id}`, now);
        set({ status: 'idle', lastSync: now });
      } catch (e) {
        set({ status: navigator.onLine ? 'error' : 'offline', message: explain(e) });
      } finally {
        running = null;
      }
    })();
    return running;
  },
}));

function scheduleSync() {
  const s = useCloud.getState();
  if (!s.user || applying) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void useCloud.getState().syncNow(), 4000);
}

/** True while sync is writing to the local stores, so those writes do not trigger another sync. */
let applying = false;

async function runSync(sb: SupabaseClient, userId: string) {
  await flushProjects();
  const base = (await dbGetMeta<SyncBase>(baseKey(userId))) ?? { projects: {} };
  const since = await dbGetMeta<string>(pullKey(userId));

  // 1. Everything changed in the cloud since the last pull.
  let q = sb.from(TABLE).select('kind,id,data,deleted,updated_at,server_updated_at');
  if (since) q = q.gt('server_updated_at', since);
  const { data: rows, error } = await q;
  if (error) throw error;
  const remote = (rows ?? []) as (CloudRow & { server_updated_at: string })[];

  // 2. Plans.
  const projects = Object.values(useProjects.getState().projects);
  const deletes = (await dbGetMeta<{ id: string; at: number }[]>(DELETES_KEY)) ?? [];
  const plan = planSync(projects, remote, base, deletes, uid);
  // A brand-new device's blank starter plan is dropped once real plans arrive.
  const blankStarter = projects.length === 1 && isBlank(projects[0]) && plan.apply.length > 0 ? [projects[0].id] : [];
  applying = true;
  try {
    if (plan.apply.length || plan.copies.length || plan.removeLocal.length || blankStarter.length) {
      await useProjects.getState().applyCloud([...plan.apply, ...plan.copies], [...plan.removeLocal, ...blankStarter]);
    }
  } finally {
    applying = false;
  }
  await fetchImages(sb, userId, [...plan.apply, ...plan.copies]);

  const upload: (CloudRow & { user_id: string })[] = [];
  for (const p of [...plan.push, ...plan.copies]) {
    upload.push({ user_id: userId, kind: 'project', id: p.id, data: p, deleted: false, updated_at: p.updatedAt });
    plan.base.projects[p.id] = p.updatedAt;
  }
  for (const d of plan.pushDeletes) upload.push({ user_id: userId, kind: 'project', id: d.id, data: null, deleted: true, updated_at: d.at });

  // 3. Saved rigs, cameras and lenses: merged item by item.
  const lib = useLibrary.getState();
  const mine: Library = { rigs: lib.rigs, cameras: lib.cameras, lenses: lib.lenses };
  const theirsRow = remote.find((r) => r.kind === 'library' && r.id === 'main');
  const theirs = (theirsRow?.data as Library | null) ?? null;
  const merged = theirs ? mergeLibrary(mine, theirs) : mine;
  if (!sameLibrary(merged, mine)) {
    applying = true;
    try {
      useLibrary.getState().setAll(merged);
    } finally {
      applying = false;
    }
  }
  const libStamp = Math.max(0, ...merged.rigs.map((r) => r.updatedAt), ...merged.cameras.map((r) => r.updatedAt), ...merged.lenses.map((r) => r.updatedAt));
  const lastLib = (await dbGetMeta<number>(`sync-lib:${userId}`)) ?? -1;
  const hasItems = merged.rigs.length + merged.cameras.length + merged.lenses.length > 0;
  // Upload when the cloud copy is missing something, or when this device changed since the last sync.
  const pushLib = theirs ? !sameLibrary(merged, theirs) : hasItems && libStamp !== lastLib;
  if (pushLib) {
    upload.push({ user_id: userId, kind: 'library', id: 'main', data: merged, deleted: false, updated_at: libStamp });
  }

  // 4. Upload, images first so a plan never arrives without its pictures.
  await sendImages(sb, userId, plan.push);
  if (upload.length) {
    const { error: upErr } = await sb.from(TABLE).upsert(upload, { onConflict: 'user_id,kind,id' });
    if (upErr) throw upErr;
  }
  await dbPutMeta(`sync-lib:${userId}`, libStamp);
  await dbPutMeta(baseKey(userId), plan.base);
  // Next time, ask only for rows changed after the newest one seen (our own uploads come back once, harmlessly).
  const newest = remote.reduce((a, r) => (r.server_updated_at > a ? r.server_updated_at : a), since ?? '');
  if (newest) await dbPutMeta(pullKey(userId), newest);
  if (deletes.length) await dbPutMeta(DELETES_KEY, []);
}

async function sendImages(sb: SupabaseClient, userId: string, projects: Project[]) {
  const done = new Set((await dbGetMeta<string[]>(imgKey(userId))) ?? []);
  const ids = new Set(projects.flatMap((p) => imageIdsOf(p)));
  let changed = false;
  for (const id of ids) {
    if (done.has(id)) continue;
    const blob = await dbGetImage(id);
    if (!blob) continue;
    const { error } = await sb.storage.from(BUCKET).upload(`${userId}/${id}`, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (error) throw error;
    done.add(id);
    changed = true;
  }
  if (changed) await dbPutMeta(imgKey(userId), [...done]);
}

async function fetchImages(sb: SupabaseClient, userId: string, projects: Project[]) {
  const ids = new Set(projects.flatMap((p) => imageIdsOf(p)));
  const done = new Set((await dbGetMeta<string[]>(imgKey(userId))) ?? []);
  for (const id of ids) {
    if (await dbGetImage(id)) continue;
    const { data, error } = await sb.storage.from(BUCKET).download(`${userId}/${id}`);
    if (error || !data) continue;
    await dbPutImage(id, data);
    done.add(id);
  }
  await dbPutMeta(imgKey(userId), [...done]);
}
