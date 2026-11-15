import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, FlipHorizontal2, Maximize, Minus, Pencil, Plus, SkipForward, Volume2, VolumeX, Zap, ZapOff } from 'lucide-react';
import { Button } from '@/components/Button';
import { Sheet } from '@/components/Sheet';
import { TextField, SelectField, Check } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { StarMark } from '@/brand/Wordmark';
import { useProject, useProjects } from '@/store/projects';
import { clapSound, audioContext } from '@/lib/audio';
import { framesToTimecode, formatTimecode, FRAME_RATES } from '@/lib/calc/timecode';
import { fmtDate } from '@/lib/format';
import { nextShotId } from '@/lib/slate';
import type { SlateState } from '@/types/project';
import './slate.css';

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          lock = await navigator.wakeLock.request('screen');
        }
      } catch {
        /* not available or denied; the slate still works */
      }
    };
    void request();
    const onVis = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [active]);
}

function useTimecode(fps: number) {
  const [tc, setTc] = useState('00:00:00:00');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const now = new Date();
      const ms = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000 + now.getMilliseconds();
      const frames = Math.floor((ms / 1000) * fps);
      setTc(formatTimecode(framesToTimecode(frames, fps)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);
  return tc;
}

export default function Slate() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const slate = project.slate;
  const set = useCallback((d: Partial<SlateState>) => patch((p) => ({ slate: { ...p.slate, ...d } })), [patch]);
  const [clapping, setClapping] = useState(false);
  const [flash, setFlash] = useState(0);
  const [editing, setEditing] = useState(false);
  const [autoTake, setAutoTake] = useState(true);
  const tc = useTimecode(slate.fps || 24);
  const clapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useWakeLock(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-immersive', 'true');
    return () => document.documentElement.removeAttribute('data-immersive');
  }, []);

  // Space bar claps when nothing else has focus (also works with presentation clickers).
  const clapRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    clapRef.current = clap;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && (document.activeElement === document.body || document.activeElement == null)) {
        e.preventDefault();
        clapRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function clap() {
    if (clapping) return;
    audioContext();
    setClapping(true);
    if (slate.sound) clapSound();
    if (slate.flash) setFlash((n) => n + 1);
    if (navigator.vibrate) navigator.vibrate(30);
    if (clapTimer.current) clearTimeout(clapTimer.current);
    clapTimer.current = setTimeout(() => {
      setClapping(false);
      if (autoTake) set({ take: slate.take + 1 });
    }, 700);
  }

  function nextShot() {
    set({ shot: nextShotId(slate.shot), take: 1 });
  }

  const today = fmtDate(new Date(), undefined, { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <main className="slate-page">
      <h1 className="visually-hidden">Slate</h1>
      <div className="slate-top">
        <Link to="/" className="btn btn--sm btn--ghost" style={{ color: '#f3f1ea' }}>
          <ArrowLeft size={16} /> Exit slate
        </Link>
        <div className="cluster">
          <Button size="sm" variant="quiet" iconOnly icon={slate.sound ? <Volume2 size={16} /> : <VolumeX size={16} />} onClick={() => set({ sound: !slate.sound })} aria-pressed={slate.sound}>
            Clap sound
          </Button>
          <Button size="sm" variant="quiet" iconOnly icon={slate.flash ? <Zap size={16} /> : <ZapOff size={16} />} onClick={() => set({ flash: !slate.flash })} aria-pressed={slate.flash}>
            Screen flash
          </Button>
          <Button size="sm" variant="quiet" iconOnly icon={<FlipHorizontal2 size={16} />} onClick={() => set({ mirrored: !slate.mirrored })} aria-pressed={slate.mirrored}>
            Mirror for rear display
          </Button>
          {document.fullscreenEnabled && (
            <Button size="sm" variant="quiet" iconOnly icon={<Maximize size={16} />} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())}>
              Fullscreen
            </Button>
          )}
        </div>
      </div>

      <div className="slate-wrap">
        {/* The whole board is a tap target for pointer users; keyboard users use the Clap button or the space bar. */}
        <div className={`slate grain ${slate.mirrored ? 'is-mirrored' : ''} ${clapping ? 'is-clapping' : ''}`} onClick={clap}>
          <div className="slate__arm">
            <span className="slate__hinge" aria-hidden="true" />
          </div>
          <div className="slate__board">
            <div className="slate__cell slate__cell--prod">
              <span className="slate__label">Production</span>
              <span className="slate__value slate__value--small" style={{ flex: 1 }}>
                {slate.production || project.name}
              </span>
              <span className="slate__label">{today}</span>
            </div>
            <div className="slate__cell slate__cell--wide">
              <span className="slate__label">Roll</span>
              <span className="slate__value slate__value--mono">{slate.roll}</span>
            </div>
            <div className="slate__cell slate__cell--wide slate__cell--yellow">
              <span className="slate__label">Scene</span>
              <span className="slate__value slate__value--mono">{slate.scene}</span>
            </div>
            <div className="slate__cell slate__cell--wide slate__cell--yellow">
              <span className="slate__label">Shot</span>
              <span className="slate__value slate__value--mono">{slate.shot}</span>
            </div>
            <div className="slate__cell slate__cell--wide slate__cell--yellow">
              <span className="slate__label">Take</span>
              <span className="slate__value slate__value--mono">{slate.take}</span>
            </div>
            <div className="slate__cell slate__cell--wide">
              <span className="slate__label">Director</span>
              <span className="slate__value slate__value--small">{slate.director || '—'}</span>
            </div>
            <div className="slate__cell slate__cell--wide">
              <span className="slate__label">Camera</span>
              <span className="slate__value slate__value--small">{slate.camera || '—'}</span>
            </div>
            <div className="slate__cell slate__cell--tc slate__cell--timecode">
              <span className="slate__label">Timecode · time of day</span>
              <span className="slate__value slate__value--mono" aria-live="off">
                {tc}
              </span>
            </div>
            <div className="slate__cell slate__cell--tc slate__cell--fps">
              <span className="slate__label">FPS</span>
              <span className="slate__value slate__value--mono">{slate.fps}</span>
            </div>
            <div className="slate__foot">
              <span className="slate__brand">
                <StarMark size={14} /> Astris Productions
              </span>
              <span className="slate__label">{slate.sound ? 'Sync' : 'MOS'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="slate-bar" role="toolbar" aria-label="Slate controls">
        <Button icon={<Minus size={16} />} onClick={() => set({ take: Math.max(1, slate.take - 1) })}>
          Take
        </Button>
        <Button icon={<Plus size={16} />} onClick={() => set({ take: slate.take + 1 })}>
          Take
        </Button>
        <Button icon={<SkipForward size={16} />} onClick={nextShot}>
          Next shot
        </Button>
        <Button icon={<Pencil size={16} />} onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="primary" onClick={clap} className="slate-bar__clap">
          Clap
        </Button>
      </div>

      <div key={flash} className={`slate__flash ${flash ? 'is-on' : ''}`} aria-hidden="true" />
      <p className="visually-hidden" aria-live="polite">
        Scene {slate.scene}, shot {slate.shot}, take {slate.take}
      </p>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Slate details">
        <div className="stack">
          <TextField label="Production" value={slate.production} onChange={(v) => set({ production: v })} placeholder={project.name} />
          <div className="grid-2">
            <TextField label="Roll" value={slate.roll} onChange={(v) => set({ roll: v.toUpperCase() })} mono />
            <SelectField label="FPS" value={String(slate.fps)} onChange={(v) => set({ fps: Number(v) })} options={FRAME_RATES.map((f) => ({ value: String(f), label: `${f}` }))} />
          </div>
          <div className="grid-3">
            <TextField label="Scene" value={slate.scene} onChange={(v) => set({ scene: v })} mono />
            <TextField label="Shot" value={slate.shot} onChange={(v) => set({ shot: v.toUpperCase() })} mono />
            <Stepper label="Take" value={slate.take} onChange={(v) => set({ take: Math.max(1, Math.round(v)) })} min={1} />
          </div>
          <div className="grid-2">
            <TextField label="Director" value={slate.director} onChange={(v) => set({ director: v })} />
            <TextField label="Camera" value={slate.camera} onChange={(v) => set({ camera: v })} />
          </div>
          <Check label="Increment the take after each clap" checked={autoTake} onChange={setAutoTake} />
          <Check label="Sync sound (MOS when off)" checked={slate.sound} onChange={(v) => set({ sound: v })} />
          <p className="tiny muted">Timecode is free-run time of day at the chosen frame rate, for logging. Keep the screen awake is on while the slate is open.</p>
        </div>
      </Sheet>
    </main>
  );
}
