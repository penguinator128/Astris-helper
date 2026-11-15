import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Plus, Settings as SettingsIcon } from 'lucide-react';
import { TOOLS } from '@/app/nav';
import { Wordmark } from '@/brand/Wordmark';
import { useSettings } from '@/store/settings';
import { useProjects } from '@/store/projects';
import { dayTimes, tzOffsetMinutes } from '@/lib/sun';
import { fmtDate, fmtTime } from '@/lib/format';
import { Button, LinkButton } from '@/components/Button';
import './home.css';

export default function Home() {
  const { location, timeFormat, timezone } = useSettings();
  const { projects, currentId, select, create } = useProjects();
  const recent = Object.values(projects)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);

  const today = useMemo(() => new Date(), []);
  const times = useMemo(() => dayTimes(today, location.lat, location.lng, tzOffsetMinutes(today, timezone)), [today, location.lat, location.lng, timezone]);
  const t = (d: Date) => fmtTime(d, timeFormat, timezone);

  return (
    <main className="page page--flush">
      <h1 className="visually-hidden">Astris Field Kit</h1>
      <section className="home-head grain" aria-label="Today">
        <div className="home-head__inner">
          <div className="home-head__brand">
            <Wordmark height={13} tone="ink" />
            <span className="micro home-head__kit">Field Kit</span>
          </div>
          <div className="home-head__date">
            <span className="mono">{fmtDate(today, timezone, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            <span className="muted-ink">{location.name}</span>
          </div>
          <div className="home-head__sun">
            <div className="readout">
              <span className="readout__label">Sunrise</span>
              <span className="readout__value readout__value--sm">{t(times.sunrise)}</span>
            </div>
            <div className="readout">
              <span className="readout__label">Golden hour</span>
              <span className="readout__value readout__value--sm">{t(times.goldenHour)}</span>
            </div>
            <div className="readout">
              <span className="readout__label">Sunset</span>
              <span className="readout__value readout__value--sm">{t(times.sunset)}</span>
            </div>
            <div className="readout">
              <span className="readout__label">Civil dusk</span>
              <span className="readout__value readout__value--sm">{t(times.dusk)}</span>
            </div>
          </div>
          <Link to="/plan" className="home-head__more">
            Full planner <ChevronRight size={14} />
          </Link>
        </div>
      </section>

      <div className="page">
        <section aria-labelledby="recent-h" className="stack stack--sm">
          <div className="cluster" style={{ justifyContent: 'space-between' }}>
            <h2 id="recent-h" className="micro">
              Projects
            </h2>
            <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => create('Untitled project')}>
              New project
            </Button>
          </div>
          <div className="home-projects">
            {recent.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`home-project ${p.id === currentId ? 'is-current' : ''}`}
                onClick={() => select(p.id)}
                aria-pressed={p.id === currentId}
              >
                <span className="home-project__name">{p.name}</span>
                <span className="home-project__meta mono">
                  {p.shots.length} shots · {p.storyboard.length} frames
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="tools-h" style={{ marginTop: 'var(--s-5)' }}>
          <h2 id="tools-h" className="micro" style={{ marginBottom: 'var(--s-2)' }}>
            Tools
          </h2>
          <div className="rows">
            {TOOLS.map((tool) => (
              <Link key={tool.id} to={tool.path} className="row">
                <span className="row__idx">{tool.index}</span>
                <span className="row__main">
                  <span className="row__title">{tool.name}</span>
                  <span className="row__sub">{tool.description}</span>
                </span>
                <span className="row__end">
                  <ChevronRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="cluster" style={{ marginTop: 'var(--s-5)', justifyContent: 'space-between' }}>
          <span className="tiny muted">Everything is saved on this device. Works offline.</span>
          <LinkButton to="/settings" variant="ghost" size="sm" icon={<SettingsIcon size={14} />}>
            Settings
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
