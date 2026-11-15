import { Link } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { CALCS } from './registry';
import { useCamera } from './shared/useCamera';
import { fmtAperture } from '@/lib/format';

export default function CalcIndex() {
  const { camera, sensor } = useCamera();
  return (
    <main className="page">
      <PageHead index="Toolkit · Calculators" title="Calculators" sub={`Current camera: ${sensor.name}, ${camera.focalLength} mm, ${fmtAperture(camera.aperture)}. Changing it in any calculator updates the project.`} />
      <div className="rows">
        {CALCS.map((c) => (
          <Link key={c.id} to={`/calc/${c.id}`} className="row">
            <span className="row__idx">{c.index}</span>
            <span className="row__main">
              <span className="row__title">{c.name}</span>
              <span className="row__sub">{c.description}</span>
            </span>
            <span className="row__end">
              <ChevronRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
