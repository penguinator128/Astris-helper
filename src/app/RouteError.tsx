import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { Blueprint } from '@/components/Blueprint';

export function RouteError() {
  const err = useRouteError();
  const message = isRouteErrorResponse(err) ? `${err.status} ${err.statusText}` : err instanceof Error ? err.message : 'Something went wrong';
  return (
    <main className="page">
      <Blueprint title="This screen hit an error">
        <div className="stack">
          <p className="small muted mono">{message}</p>
          <p className="small">Your data is saved on this device. Go back to the tool index and try again.</p>
          <Link to="/" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
            Tool index
          </Link>
        </div>
      </Blueprint>
    </main>
  );
}
