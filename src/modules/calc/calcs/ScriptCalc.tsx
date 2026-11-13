import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { scriptEstimate } from '@/lib/calc/script';
import { fmtNum } from '@/lib/format';

export default function ScriptCalc() {
  const [pages, setPages] = useState(12);
  const [secPerPage, setSecPerPage] = useState(60);
  const [pagesPerDay, setPagesPerDay] = useState(4);
  const [setupsPerPage, setSetupsPerPage] = useState(3);
  const e = scriptEstimate(pages, secPerPage, pagesPerDay, setupsPerPage);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Script" index="01">
          <div className="stack">
            <Stepper label="Page count" value={pages} onChange={setPages} min={0.125} step={0.125} decimals={3} hint="Use eighths of a page, as in a breakdown." />
            <Stepper label="Seconds per page" unit="s" value={secPerPage} onChange={setSecPerPage} min={20} max={180} step={5} hint="60 s is the standard. Dialogue-heavy runs faster; action and montage slower." />
          </div>
        </Blueprint>
        <Blueprint title="Schedule assumptions" index="02">
          <div className="grid-2">
            <Stepper label="Pages per day" value={pagesPerDay} onChange={setPagesPerDay} min={0.5} max={15} step={0.5} decimals={1} />
            <Stepper label="Setups per page" value={setupsPerPage} onChange={setSetupsPerPage} min={1} max={12} />
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Runtime" value={`${fmtNum(e.runtimeMin, 1)} min`} size="lg" />
          <Readout label="Shooting days" value={String(e.days)} sub={`at ${pagesPerDay} pages a day`} />
          <Readout label="Setups" value={String(e.setups)} size="sm" />
        </ResultPanel>
        <Expander>
          <Formula>{`runtime = pages × seconds per page
days = ceil(pages / pages per day)`}</Formula>
          <p>Small crews on simple locations manage 4–6 pages a day; a one-person shoot with lighting changes is nearer 2–3. Treat this as a first pass before a proper breakdown.</p>
        </Expander>
      </div>
    </div>
  );
}
