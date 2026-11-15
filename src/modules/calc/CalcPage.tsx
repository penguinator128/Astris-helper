import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { CALCS, calcById } from './registry';

const LAZY: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(CALCS.map((c) => [c.id, lazy(c.load)]));

export default function CalcPage() {
  const { calcId } = useParams();
  const def = calcById(calcId);
  const Comp = def ? LAZY[def.id] : null;
  if (!def || !Comp) return <Navigate to="/calc" replace />;
  return (
    <main className="page">
      <PageHead
        index={`Calculators · ${def.index}`}
        title={def.name}
        sub={def.description}
        actions={
          <Link to="/calc" className="btn btn--ghost btn--sm">
            <ArrowLeft size={16} /> All calculators
          </Link>
        }
      />
      <Suspense fallback={<div className="muted small">Loading…</div>}>
        <Comp />
      </Suspense>
    </main>
  );
}
