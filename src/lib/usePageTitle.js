import { useEffect } from 'react';

export function usePageTitle(title, enabled = true) {
  useEffect(() => {
    if (enabled) document.title = title ? `${title} | Attendaa` : 'Attendaa';
  }, [title, enabled]);
}
