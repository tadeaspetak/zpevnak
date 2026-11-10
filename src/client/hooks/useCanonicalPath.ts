import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

/**
 * Puts the current address in place when the page was opened by a stale or bare one
 * (`/playlist/1`, or a slug from before a rename), keeping the query and state. Replaces the
 * history entry: back doesn't revisit the old spelling.
 */
export function useCanonicalPath(path: string | null) {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (path && readable(location.pathname) !== path) {
      navigate(`${path}${location.search}`, { replace: true, state: location.state });
    }
  }, [path, location.pathname, location.search, location.state, navigate]);
}

/** The path as people write it. A mangled one (`%E0%A4`, cut off in a chat) stays as it is. */
function readable(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
