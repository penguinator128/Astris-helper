import { useMemo } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Plus, Settings as SettingsIcon, Map as MapIcon, ListChecks } from 'lucide-react';
import { PLAN_TOOLS, KIT_TOOLS } from '@/app/nav';
import { Wordmark } from '@/brand/Wordmark';
import { useSettings } from '@/store/settings';
import { useProject, useProjects } from '@/store/projects';
import { dayTimes, tzOffsetMinutes, zonedDate } from '@/lib/sun';
import { fmtDate, fmtTime, parseIsoDate } from '@/lib/format';
import { equipmentList } from '@/lib/gear/equipment';
import { Button, LinkButton } from '@/components/Button';
import './home.css';

export default function Home() {
  const { location, timeFormat, timezone } = useSettings();
  const project = useProject();
  const { projects, currentId, select, create } = useProjects();
  const recent = Object.values(projects)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 4);
  const cs = project.callSheet;
  const lat = cs.lat ?? location.lat;
  const lng = cs.lng ?? location.lng;
  const times = useMemo(() => {
    const noon = zonedDate(cs.isoDate, '12:00', timezone);
    return dayTimes(noon, lat, lng, tzOffsetMinutes(noon, timezone));
  }, [cs.isoDate, lat, lng, timezone]);
  const t = (d: Date) => fmtTime(d, timeFormat, timezone);
  const equip = useMemo(() => equipmentList(project), [project]);
  const stats: [string, number, string][] = [
    ['Set-ups', project.diagrams.length, '/plan'],
    ['Gear', project.gear.length, '/gear'],
    ['Connections', project.connections.length, '/gear'],
    ['Shots', project.shots.length, '/shots'],
    ['To pack', equip.reduce((a, r) => a + r.qty, 0), '/gear'],
  ];

  return (
    <main className="page page--flush">
      <h1 className="visually-hidden">Astris Field Kit</h1>
      <section className="home-head grain" aria-label="Shoot day">
        <div className="home-head__inner">
          <div className="home-head__brand">
            <Wordmark height={13} tone="ink" />
            <span className="micro home-head__kit">Field Kit</span>
          </div>
          <div className="home-head__project">
            <span className="micro home-head__kit">Shoot plan</span>
            <span className="home-head__name">{project.name}</span>
            <span className="home-head__date mono">
              {fmtDate(parseIsoDate(cs.isoDate), undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · call {cs.callTime || '—'} · {cs.locationName || location.name}
            </span>
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
          <div className="home-head__cta">
            <Link to="/plan" className="btn btn--lg home-head__primary">
              <MapIcon size={18} /> Open shoot plan
            </Link>
            <Link to="/gear" className="btn btn--lg home-head__secondary">
              <ListChecks size={18} /> Gear and equipment list
            </Link>
          </div>
        </div>
      </section>

      <div className="page">
        <nav className="home-stats" aria-label="Plan at a glance">
          {stats.map(([label, n, to]) => (
            <Link key={label} to={to} className="home-stat">
              <span className="readout__label">{label}</span>
              <span className="readout__value readout__value--sm">{n}</span>
            </Link>
          ))}
        </nav>

        {project.diagrams.length > 0 && (
          <section aria-labelledby="setups-h" style={{ marginTop: 'var(--s-5)' }}>
            <h2 id="setups-h" className="micro" style={{ marginBottom: 'var(--s-2)' }}>
              Set-ups
            </h2>
            <div className="rows">
              {project.diagrams
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .slice(0, 5)
                .map((d, i) => (
                  <Link key={d.id} to={`/plan/${d.id}`} className="row">
                    <span className="row__idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="row__main">
                      <span className="row__title">{d.name}</span>
                      <span className="row__sub mono tiny">
                        {d.objects.filter((o) => o.type === 'camera').length} cam · {d.objects.filter((o) => o.type === 'light').length} lights · {d.objects.filter((o) => o.type === 'gear').length} other gear
                      </span>
                    </span>
                    <span className="row__end">
                      <ChevronRight size={18} />
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        )}

        <section aria-labelledby="plan-h" style={{ marginTop: 'var(--s-5)' }}>
          <h2 id="plan-h" className="micro" style={{ marginBottom: 'var(--s-2)' }}>
            Plan the shoot
          </h2>
          <div className="rows">
            {PLAN_TOOLS.map((tool) => (
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

        <section aria-labelledby="kit-h" style={{ marginTop: 'var(--s-5)' }}>
          <div className="cluster" style={{ justifyContent: 'space-between', marginBottom: 'var(--s-2)' }}>
            <h2 id="kit-h" className="micro">
              Toolkit
            </h2>
            <Link to="/toolkit" className="tiny">
              All tools
            </Link>
          </div>
          <div className="home-kit">
            {KIT_TOOLS.map((tool) => (
              <Link key={tool.id} to={tool.path} className="home-kit__item">
                <tool.icon size={18} aria-hidden="true" />
                <span>{tool.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <section aria-labelledby="recent-h" className="stack stack--sm" style={{ marginTop: 'var(--s-5)' }}>
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
              <button key={p.id} type="button" className={`home-project ${p.id === currentId ? 'is-current' : ''}`} onClick={() => select(p.id)} aria-pressed={p.id === currentId}>
                <span className="home-project__name">{p.name}</span>
                <span className="home-project__meta mono">
                  {p.diagrams.length} set-ups · {p.gear.length} gear · {p.shots.length} shots
                </span>
              </button>
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
