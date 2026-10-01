'use client';

import { createContext, useContext } from 'react';

// Read on the server at request time (see app/layout.tsx) so the Jira URL
// comes from the container's runtime env instead of being baked in at build.
export interface RuntimeConfig {
  jiraBaseUrl: string;
}

const RuntimeConfigContext = createContext<RuntimeConfig>({ jiraBaseUrl: '' });

export function RuntimeConfigProvider({
  value,
  children,
}: {
  value: RuntimeConfig;
  children: React.ReactNode;
}) {
  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfig(): RuntimeConfig {
  return useContext(RuntimeConfigContext);
}
