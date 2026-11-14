import { useCallback, useState } from 'react';

interface Entry<T> {
  value: T;
  key?: string;
  at: number;
}

interface State<T> {
  present: T;
  past: Entry<T>[];
  future: Entry<T>[];
  lastKey?: string;
  lastAt: number;
}

/** Undo/redo stack. Commits with the same key within `coalesceMs` replace the previous entry (for sliders). */
export function useHistory<T>(initial: T, coalesceMs = 600) {
  const [state, setState] = useState<State<T>>({ present: initial, past: [], future: [], lastAt: 0 });

  const commit = useCallback(
    (next: T, key?: string) => {
      setState((s) => {
        const now = Date.now();
        const coalesce = !!key && s.lastKey === key && now - s.lastAt < coalesceMs;
        const past = coalesce ? s.past : [...s.past, { value: s.present, at: now, key }].slice(-80);
        return { present: next, past, future: [], lastKey: key, lastAt: now };
      });
    },
    [coalesceMs],
  );

  /** Update without recording history (live drags). */
  const live = useCallback((next: T) => setState((s) => ({ ...s, present: next })), []);

  const undo = useCallback(() => {
    setState((s) => {
      const e = s.past[s.past.length - 1];
      if (!e) return s;
      return { present: e.value, past: s.past.slice(0, -1), future: [...s.future, { value: s.present, at: Date.now() }], lastAt: 0 };
    });
  }, []);

  const redo = useCallback(() => {
    setState((s) => {
      const e = s.future[s.future.length - 1];
      if (!e) return s;
      return { present: e.value, past: [...s.past, { value: s.present, at: Date.now() }], future: s.future.slice(0, -1), lastAt: 0 };
    });
  }, []);

  return { present: state.present, commit, live, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
