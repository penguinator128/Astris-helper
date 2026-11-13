import { create } from 'zustand';
import { DEFAULT_SETTINGS, type Settings, type Theme } from '@/types/settings';
import { dbGetSettings, dbPutSettings } from './db';

const THEME_KEY = 'afk-theme';

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
  setTheme: (theme: Theme) => void;
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0B0B0C' : '#FFC400');
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

/** Resolve the initial theme before React mounts to avoid a flash. */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  theme: typeof window !== 'undefined' ? initialTheme() : 'light',
  hydrated: false,
  hydrate: async () => {
    const saved = await dbGetSettings();
    if (saved) {
      set({ ...saved, hydrated: true });
      applyTheme(saved.theme);
    } else {
      const theme = initialTheme();
      const fresh: Settings = { ...DEFAULT_SETTINGS, theme, firstRunAt: Date.now() };
      set({ ...fresh, hydrated: true });
      applyTheme(theme);
      await dbPutSettings(fresh);
    }
  },
  update: (patch) => {
    set(patch);
    if (patch.theme) applyTheme(patch.theme);
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const s = get();
      const { hydrated: _h, hydrate: _hy, update: _u, setTheme: _st, ...plain } = s;
      void dbPutSettings(plain as Settings);
    }, 150);
  },
  setTheme: (theme) => get().update({ theme }),
}));
