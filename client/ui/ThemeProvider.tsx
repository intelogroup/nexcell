import { type ReactNode, useEffect } from 'react';
import tokens from './tokens.json';

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-family', tokens.fontFamily);
    root.style.setProperty('--space-xs', tokens.space.xs + 'px');
    root.style.setProperty('--space-sm', tokens.space.sm + 'px');
    root.style.setProperty('--space-md', tokens.space.md + 'px');
    root.style.setProperty('--space-lg', tokens.space.lg + 'px');
    root.style.setProperty('--color-surface', tokens.colors.surface);
    root.style.setProperty('--color-muted', tokens.colors.muted);
    root.style.setProperty('--color-accent-500', tokens.colors.aiAccent);
    root.style.setProperty('--color-danger', tokens.colors.danger);
  }, []);
  return <>{children}</>;
}
