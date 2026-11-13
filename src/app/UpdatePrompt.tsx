import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/Button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      // Check for updates every hour while the app stays open on set.
      if (r) setInterval(() => void r.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="toast-host" role="status">
      <div className="toast" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>Update ready</span>
        <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
          Reload
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)} style={{ color: 'inherit' }}>
          Later
        </Button>
      </div>
    </div>
  );
}
