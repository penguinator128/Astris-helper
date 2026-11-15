import { useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { TAB_TOOLS, PLAN_TOOLS, KIT_TOOLS, TOOLKIT_TAB, UTILITY_NAV } from './nav';
import { Wordmark, StarMark } from '@/brand/Wordmark';
import { useProject } from '@/store/projects';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Toasts } from '@/components/Toasts';
import { UpdatePrompt } from './UpdatePrompt';

export function Shell() {
  const project = useProject();
  const location = useLocation();
  const [switcher, setSwitcher] = useState(false);
  const immersive = location.pathname.startsWith('/slate');

  const kitActive = location.pathname.startsWith('/toolkit') || KIT_TOOLS.some((t) => location.pathname.startsWith(t.path)) || UTILITY_NAV.some((u) => location.pathname.startsWith(u.path)) || ['/checklist', '/export'].some((p) => location.pathname.startsWith(p));

  return (
    <div className="shell">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <ScrollRestoration />
      {!immersive && (
        <nav className="rail" aria-label="Tools">
          <Link to="/" className="rail__brand">
            <Wordmark height={13} />
          </Link>
          <div className="rail__section">
            <button type="button" className="rail__project" onClick={() => setSwitcher(true)} aria-haspopup="dialog">
              <FolderOpen size={16} />
              <span>{project.name}</span>
              <ChevronDown size={14} />
            </button>
          </div>
          <div className="rail__section">
            <div className="micro rail__label">Shoot plan</div>
            {PLAN_TOOLS.map((t) => (
              <NavLink key={t.id} to={t.path} className="rail__item">
                <span className="rail__idx">{t.index}</span>
                <t.icon size={16} />
                <span>{t.name}</span>
              </NavLink>
            ))}
          </div>
          <div className="rail__section">
            <div className="micro rail__label">Toolkit</div>
            {KIT_TOOLS.map((t) => (
              <NavLink key={t.id} to={t.path} className="rail__item">
                <span className="rail__idx">{t.index}</span>
                <t.icon size={16} />
                <span>{t.name}</span>
              </NavLink>
            ))}
          </div>
          <div className="rail__foot">
            {UTILITY_NAV.map((u) => (
              <NavLink key={u.id} to={u.path} className="rail__item">
                <span className="rail__idx" />
                <u.icon size={16} />
                <span>{u.name}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      <div className="shell__main" id="content" tabIndex={-1} style={immersive ? { paddingBottom: 0 } : undefined}>
        {!immersive && (
          <header className="topbar">
            <Link to="/" className="topbar__brand">
              <StarMark size={20} />
              <span style={{ fontWeight: 600, letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase' }}>Astris</span>
              <span className="visually-hidden">, tool index</span>
            </Link>
            <button type="button" className="topbar__project" onClick={() => setSwitcher(true)} aria-haspopup="dialog">
              <span>{project.name}</span>
              <ChevronDown size={14} />
            </button>
          </header>
        )}
        <Outlet />
      </div>

      {!immersive && (
        <nav className="tabbar" aria-label="Primary">
          {TAB_TOOLS.map((t) => (
            <NavLink key={t.id} to={t.path} className="tabbar__item">
              <t.icon size={20} strokeWidth={1.75} />
              <span>{t.short}</span>
            </NavLink>
          ))}
          <NavLink to={TOOLKIT_TAB.path} className={`tabbar__item ${kitActive ? 'is-active' : ''}`}>
            <TOOLKIT_TAB.icon size={20} strokeWidth={1.75} />
            <span>{TOOLKIT_TAB.short}</span>
          </NavLink>
        </nav>
      )}


      <ProjectSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <Toasts />
      <UpdatePrompt />
    </div>
  );
}
