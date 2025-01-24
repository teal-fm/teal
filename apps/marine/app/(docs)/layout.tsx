
import { RootProvider } from 'fumadocs-ui/provider';
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
        <RootProvider>{children}</RootProvider>
  );
}
