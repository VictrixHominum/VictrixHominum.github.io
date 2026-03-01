import { useEffect, useCallback } from 'react';
import { useBlocker } from 'react-router-dom';

interface UseUnsavedChangesReturn {
  blocker: ReturnType<typeof useBlocker>;
  proceed: () => void;
  reset: () => void;
}

export function useUnsavedChanges(isDirty: boolean): UseUnsavedChangesReturn {
  // In-app navigation guard (react-router)
  const blocker = useBlocker(
    useCallback(() => isDirty, [isDirty]),
  );

  // Browser / tab-close guard
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const proceed = useCallback(() => {
    if (blocker.state === 'blocked') blocker.proceed();
  }, [blocker]);

  const reset = useCallback(() => {
    if (blocker.state === 'blocked') blocker.reset();
  }, [blocker]);

  return { blocker, proceed, reset };
}
