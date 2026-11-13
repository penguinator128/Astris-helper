import { useEffect, useRef, useState } from 'react';
import { Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/Button';
import { beep } from '@/lib/audio';
import { fmtDuration } from '@/lib/format';

interface Props {
  seconds: number;
  label?: string;
}

/** Countdown timer for long exposures and time lapses. Beeps at the end. */
export function Timer({ seconds, label = 'Timer' }: Props) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(seconds);
  const endAt = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, (endAt.current - performance.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        setRunning(false);
        beep(1046, 200);
        setTimeout(() => beep(1046, 200), 260);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running]);

  const start = () => {
    endAt.current = performance.now() + remaining * 1000;
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setRemaining(seconds);
  };
  const stop = () => setRunning(false);

  const display = remaining >= 60 ? fmtDuration(remaining) : `${remaining.toFixed(1)} s`;

  return (
    <div className="stack stack--sm">
      <div className="cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span className="micro">{label}</span>
        <span className="mono" style={{ fontSize: 'var(--fs-28)', fontVariantNumeric: 'tabular-nums' }} aria-live="off">
          {display}
        </span>
      </div>
      <div className="cluster">
        {!running ? (
          <Button variant="primary" icon={<Play size={16} />} onClick={start} disabled={remaining <= 0 || !Number.isFinite(seconds)}>
            Start
          </Button>
        ) : (
          <Button icon={<Square size={16} />} onClick={stop}>
            Stop
          </Button>
        )}
        <Button variant="quiet" icon={<RotateCcw size={16} />} onClick={reset}>
          Reset to {fmtDuration(seconds)}
        </Button>
      </div>
    </div>
  );
}
