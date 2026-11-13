import { useToasts } from '@/store/toast';

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
