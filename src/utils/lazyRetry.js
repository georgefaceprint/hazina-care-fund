import { lazy } from 'react';

/**
 * lazyRetry - A wrapper for React.lazy that adds refresh logic when
 * a module fails to load (typically due to a new deployment).
 */
export const lazyRetry = (componentImport) => {
  return lazy(async () => {
    // Check if we've already tried to reload for this session
    const hasRetried = window.sessionStorage.getItem('lazy-retry-done');

    try {
      return await componentImport();
    } catch (error) {
      if (!hasRetried) {
        // First failure: Clear cache/reload to get fresh manifest
        console.warn('🔄 Module load failed. Refreshing to fetch new version...', error);
        window.sessionStorage.setItem('lazy-retry-done', 'true');
        window.location.reload();
        return;
      }

      // Second failure: Something is actually wrong, let it bubble to ErrorBoundary
      console.error('❌ Module load failed after retry:', error);
      throw error;
    }
  });
};
