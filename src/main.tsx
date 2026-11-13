import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App';
import { useSettings, applyTheme, initialTheme } from './store/settings';
import { useProjects } from './store/projects';

applyTheme(initialTheme());

async function boot() {
  await useSettings.getState().hydrate();
  await useProjects.getState().hydrate();
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
}

void boot();
