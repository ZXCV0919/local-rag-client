import { useEffect } from 'react';
import { useAppNavigate } from '../../hooks/useAppNavigate';

/** 全局快捷键（路由内需在 Router 之内挂载） */
export function GlobalShortcuts() {
  const navigate = useAppNavigate();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase?.() ?? '';
      const inField =
        tag === 'INPUT' || tag === 'TEXTAREA' || target?.getAttribute?.('contenteditable') === 'true';

      if (mod && e.key.toLowerCase() === 'n' && !inField) {
        e.preventDefault();
        navigate('/', { state: { openKbCreate: true } });
        return;
      }

      if (mod && e.key.toLowerCase() === 'k' && !inField) {
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-hotkey-primary-search]')?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return null;
}
