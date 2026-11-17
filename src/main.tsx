import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { useSettings, applyTheme, initialTheme, flushSettings } from './store/settings';
import { useProjects, flushProjects } from './store/projects';
import { useLibrary } from './store/library';
import { useCloud } from './store/cloud';
import { collectUnusedImages } from './lib/backup';

applyTheme(initialTheme());

async function boot() {
  await useSettings.getState().hydrate();
  await useProjects.getState().hydrate();
  await useLibrary.getState().hydrate();
  const splash = document.getElementById('splash');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  if (splash) {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 220);
  }
  // Accounts and sync, when this build has a Supabase project.
  void useCloud.getState().init();
  // Clear images no project references any more (replaced backgrounds, deleted frames).
  setTimeout(() => void collectUnusedImages().catch(() => undefined), 4000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    void flushProjects();
    void flushSettings();
  }
});
window.addEventListener('pagehide', () => {
  void flushProjects();
  void flushSettings();
});

void boot();
