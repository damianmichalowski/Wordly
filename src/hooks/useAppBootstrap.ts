import { useContext } from 'react';

import { AppBootstrapContext } from '@/src/providers/AppBootstrapProvider';

export function useAppBootstrap() {
  const context = useContext(AppBootstrapContext);
  if (!context) {
    throw new Error('useAppBootstrap must be used within AppBootstrapProvider.');
  }

  return context;
}
