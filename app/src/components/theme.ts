import { useEffect, useState } from 'react';

/** צבעי סדרות (פלטה מאומתת לעיוורון צבעים), לפי מצב בהיר/כהה */
const LIGHT = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#fcfcfb' };
const DARK = { s1: '#3987e5', s2: '#d95926', s3: '#199e70', grid: '#2c2c2a', axis: '#383835', surface: '#1a1a19' };

export type Palette = typeof LIGHT;

function isDark() {
  const t = document.documentElement.dataset.theme;
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function usePalette(): Palette {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setDark(isDark());
    mq.addEventListener('change', on);
    const obs = new MutationObserver(on);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', on);
      obs.disconnect();
    };
  }, []);
  return dark ? DARK : LIGHT;
}
