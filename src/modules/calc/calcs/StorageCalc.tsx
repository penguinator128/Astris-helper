import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Tabs } from '@/components/Tabs';
import { Stepper } from '@/components/Stepper';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { gbPerHour, gbPerMinute, minutesOnCard, cardsNeeded, battery, CODEC_PRESETS } from '@/lib/calc/storage';
import { fmtBytes, fmtDuration, fmtNum } from '@/lib/format';

export default function StorageCalc() {
  const [tab, setTab] = useState<'media' | 'battery'>('media');
  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        label="Storage tools"
        tabs={[
          { id: 'media', label: 'Cards and bitrate' },
          { id: 'battery', label: 'Battery' },
        ]}
      />
      {tab === 'media' ? <Media /> : <Battery />}
    </div>
  );
}

function Media() {
  const [mbps, setMbps] = useState(120);
  const [card, setCard] = useState(128);
  const [hours, setHours] = useState(2);
  const [preset, setPreset] = useState('');
  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Codec" index="01">
          <div className="stack">
            <SelectField
              label="Preset"
              value={preset}
              onChange={(v) => {
                setPreset(v);
                const p = CODEC_PRESETS.find((c) => c.name === v);
                if (p) setMbps(p.mbps);
              }}
              options={[{ value: '', label: 'Choose a typical bitrate' }, ...CODEC_PRESETS.map((c) => ({ value: c.name, label: `${c.name} · ${c.mbps} Mbps` }))]}
            />
            <Stepper label="Bitrate" unit="Mbps" value={mbps} onChange={setMbps} min={1} step={10} />
          </div>
        </Blueprint>
        <Blueprint title="Shoot" index="02">
          <div className="grid-2">
            <Stepper label="Card size" unit="GB" value={card} onChange={setCard} min={1} snaps={[32, 64, 128, 256, 512, 1000, 2000]} />
            <Stepper label="Footage planned" unit="h" value={hours} onChange={setHours} min={0.25} step={0.5} decimals={2} />
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Per hour" value={fmtBytes(gbPerHour(mbps))} size="lg" />
          <Readout label="Per minute" value={fmtBytes(gbPerMinute(mbps))} size="sm" />
          <Readout label={`On a ${card} GB card`} value={fmtDuration(minutesOnCard(card, mbps) * 60)} />
          <Readout label={`Cards for ${fmtNum(hours, 1)} h`} value={String(cardsNeeded(hours, mbps, card))} />
          <Readout label="Total data" value={fmtBytes(gbPerHour(mbps) * hours)} size="sm" />
        </ResultPanel>
        <Expander>
          <Formula>{`GB per hour = Mbps × 3600 / 8 / 1000 = Mbps × 0.45
minutes per card = card GB × 8000 / Mbps / 60`}</Formula>
          <p>100 Mbps records about 45 GB an hour. Cards are rated in decimal gigabytes, and usable space is a little less than the label, so leave a margin.</p>
        </Expander>
      </div>
    </div>
  );
}

function Battery() {
  const [mah, setMah] = useState(2130);
  const [volts, setVolts] = useState(7.2);
  const [watts, setWatts] = useState(5);
  const [count, setCount] = useState(3);
  const [hours, setHours] = useState(8);
  const b = battery(mah, volts, watts, count, hours);
  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Battery" index="01">
          <div className="grid-2">
            <Stepper label="Capacity" unit="mAh" value={mah} onChange={setMah} min={100} step={100} />
            <Stepper label="Voltage" unit="V" value={volts} onChange={setVolts} min={3} max={30} step={0.1} decimals={1} />
          </div>
        </Blueprint>
        <Blueprint title="Load" index="02">
          <div className="stack">
            <Stepper label="Camera draw" unit="W" value={watts} onChange={setWatts} min={0.5} step={0.5} decimals={1} hint="Mirrorless bodies draw 3–7 W recording; 10–20 W with a monitor." />
            <div className="grid-2">
              <Stepper label="Batteries carried" value={count} onChange={setCount} min={1} />
              <Stepper label="Shoot length" unit="h" value={hours} onChange={setHours} min={0.5} step={0.5} decimals={1} />
            </div>
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Per battery" value={fmtDuration(b.minutesPerBattery * 60)} size="lg" sub={`${fmtNum(b.wh, 1)} Wh`} />
          <Readout label={`Total with ${count}`} value={fmtDuration(b.totalMinutes * 60)} />
          <Readout label={`Needed for ${fmtNum(hours, 1)} h`} value={String(b.batteriesForShoot)} />
        </ResultPanel>
        <Expander>
          <Formula>{`Wh = mAh / 1000 × V
minutes = Wh / W × 60`}</Formula>
          <p>Real runtime is lower in the cold and with screens, wireless and continuous autofocus running. Plan for 70% of the figure here.</p>
        </Expander>
      </div>
    </div>
  );
}
