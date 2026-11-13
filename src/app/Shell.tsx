import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { ChevronDown, MoreHorizontal, FolderOpen, Settings as SettingsIcon } from 'lucide-react';
import { TAB_TOOLS, MORE_TOOLS, TOOLS, UTILITY_NAV } from './nav';
import { Wordmark, StarMark } from '@/brand/Wordmark';
import { useProject } from '@/store/projects';
import { ProjectSwitcher } from './ProjectSwitcher';
import { Sheet } from '@/components/Sheet';
import { Toasts } from '@/components/Toasts';
import { UpdatePrompt } from './UpdatePrompt';

export function Shell() {
  const project = useProject();
  const location = useLocation();
  const [switcher, setSwitcher] = useState(false);
  const [more, setMore] = useState(false);
  const immersive = location.pathname.startsWith('/slate');

  const moreActive = MORE_TOOLS.some((t) => location.pathname.startsWith(t.path)) || UTILITY_NAV.some((u) => location.pathname.startsWith(u.path));

  return (
    <div className="shell">
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
            <div className="micro rail__label">Tools</div>
            {TOOLS.map((t) => (
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

      <div className="shell__main" style={immersive ? { paddingBottom: 0 } : undefined}>
        {!immersive && (
          <header className="topbar">
            <Link to="/" className="topbar__brand" aria-label="Home">
              <StarMark size={20} />
              <span style={{ fontWeight: 600, letterSpacing: '0.18em', fontSize: 12, textTransform: 'uppercase' }}>Astris</span>
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
          <button type="button" className={`tabbar__item ${moreActive ? 'is-active' : ''}`} onClick={() => setMore(true)} aria-haspopup="dialog" aria-expanded={more}>
            <MoreHorizontal size={20} strokeWidth={1.75} />
            <span>More</span>
          </button>
        </nav>
      )}

      <Sheet open={more} onClose={() => setMore(false)} title="More tools">
        <div className="rows">
          {MORE_TOOLS.map((t) => (
            <Link key={t.id} to={t.path} className="row" onClick={() => setMore(false)}>
              <span className="row__idx">{t.index}</span>
              <div className="row__main">
                <div className="row__title">{t.name}</div>
                <div className="row__sub">{t.description}</div>
              </div>
              <span className="row__end">
                <t.icon size={18} />
              </span>
            </Link>
          ))}
          {UTILITY_NAV.map((u) => (
            <Link key={u.id} to={u.path} className="row" onClick={() => setMore(false)}>
              <span className="row__idx" />
              <div className="row__main">
                <div className="row__title">{u.name}</div>
              </div>
              <span className="row__end">{u.id === 'settings' ? <SettingsIcon size={18} /> : <FolderOpen size={18} />}</span>
            </Link>
          ))}
        </div>
      </Sheet>

      <ProjectSwitcher open={switcher} onClose={() => setSwitcher(false)} />
      <Toasts />
      <UpdatePrompt />
    </div>
  );
}
