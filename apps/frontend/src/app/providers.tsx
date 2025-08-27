// app/providers.tsx
'use client';
import { ReactNode } from 'react';
import { useOrgStore } from './_store/useorgStore';
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
