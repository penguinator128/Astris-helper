import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { KIT_TOOLS, PLAN_TOOLS, UTILITY_NAV } from '@/app/nav';

export default function Toolkit() {
  const extras = PLAN_TOOLS.filter((t) => !t.tab);
  return (
    <main className="page">
      <PageHead title="Toolkit" sub="Calculators, colour, sun and moon, and the other tools that support the shoot plan." />
      <div className="stack stack--lg">
        <section aria-labelledby="kit-h">
          <h2 id="kit-h" className="micro" style={{ marginBottom: 'var(--s-2)' }}>
            Tools
          </h2>
          <div className="rows">
            {KIT_TOOLS.map((t) => (
              <Link key={t.id} to={t.path} className="row">
                <span className="row__idx">{t.index}</span>
                <span className="row__main">
                  <span className="row__title">{t.name}</span>
                  <span className="row__sub">{t.description}</span>
                </span>
                <span className="row__end">
                  <ChevronRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section aria-labelledby="more-h">
          <h2 id="more-h" className="micro" style={{ marginBottom: 'var(--s-2)' }}>
            Packing and export
          </h2>
          <div className="rows">
            {extras.map((t) => (
              <Link key={t.id} to={t.path} className="row">
                <span className="row__idx">{t.index}</span>
                <span className="row__main">
                  <span className="row__title">{t.name}</span>
                  <span className="row__sub">{t.description}</span>
                </span>
                <span className="row__end">
                  <ChevronRight size={18} />
                </span>
              </Link>
            ))}
            {UTILITY_NAV.map((u) => (
              <Link key={u.id} to={u.path} className="row">
                <span className="row__idx" />
                <span className="row__main">
                  <span className="row__title">{u.name}</span>
                </span>
                <span className="row__end">
                  <u.icon size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
