export const THEME_PALETTES = ['mint', 'red', 'blue', 'cyan', 'orange'];
export const THEME_APPEARANCES = ['light', 'dark'];

export function normalizeTheme(settings = {}) {
  return {
    palette: THEME_PALETTES.includes(settings.palette) ? settings.palette : 'mint',
    appearance: THEME_APPEARANCES.includes(settings.appearance) ? settings.appearance : 'dark',
  };
}

export function applyTheme(settings = {}) {
  if (typeof document === 'undefined') return;
  const theme = normalizeTheme(settings);
  const root = document.documentElement;
  root.dataset.palette = theme.palette;
  root.dataset.appearance = theme.appearance;
  root.style.colorScheme = theme.appearance;
  const themeColor = getComputedStyle(root).getPropertyValue('--system-ui').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute('content', theme.appearance === 'light' ? 'default' : 'black-translucent');
}
