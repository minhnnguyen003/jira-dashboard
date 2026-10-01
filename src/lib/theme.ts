'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeDefinition {
  id: string;
  mode: ThemeMode;
  labelKey: `theme.name.${string}`;
  // [background, surface, accent] shown in the picker
  swatch: [string, string, string];
}

export const THEMES = [
  { id: 'dark', mode: 'dark', labelKey: 'theme.name.dark', swatch: ['#0b0d18', '#171a2e', '#a99cff'] },
  { id: 'ocean', mode: 'dark', labelKey: 'theme.name.ocean', swatch: ['#06121c', '#10263a', '#56c7ff'] },
  { id: 'forest', mode: 'dark', labelKey: 'theme.name.forest', swatch: ['#07130d', '#112a1f', '#4fd6c8'] },
  { id: 'graphite', mode: 'dark', labelKey: 'theme.name.graphite', swatch: ['#121316', '#26282d', '#8db4ff'] },
  { id: 'light', mode: 'light', labelKey: 'theme.name.light', swatch: ['#f8f8fc', '#ffffff', '#635de8'] },
  { id: 'sky', mode: 'light', labelKey: 'theme.name.sky', swatch: ['#f1f6fc', '#ffffff', '#1d6fd6'] },
  { id: 'sand', mode: 'light', labelKey: 'theme.name.sand', swatch: ['#f8f3ea', '#fffcf6', '#0b7a85'] },
] as const satisfies readonly ThemeDefinition[];

export type ThemeId = (typeof THEMES)[number]['id'];

export const DEFAULT_THEME: ThemeId = 'dark';
export const THEME_STORAGE_KEY = 'theme';

const THEME_CHANGE_EVENT = 'jira-dashboard-theme-change';

function findTheme(id: string | null | undefined): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

export function getStoredThemeId(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    return findTheme(window.localStorage.getItem(THEME_STORAGE_KEY)).id as ThemeId;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: string) {
  const theme = findTheme(id);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);
  root.setAttribute('data-mode', theme.mode);
}

export function setTheme(id: ThemeId) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this session.
  }
  applyTheme(id);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function isLightTheme(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-mode') === 'light';
}

function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(getStoredThemeId());
    onStoreChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);
  return () => {
    observer.disconnect();
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function getThemeIdSnapshot(): string {
  return document.documentElement.getAttribute('data-theme') || DEFAULT_THEME;
}

export function useThemeId(): ThemeId {
  return findTheme(useSyncExternalStore(subscribeToTheme, getThemeIdSnapshot, () => DEFAULT_THEME)).id as ThemeId;
}

export function useIsLightTheme(): boolean {
  return useSyncExternalStore(subscribeToTheme, isLightTheme, () => false);
}

// ---- Canvas (chart.js) colors -------------------------------------------------
// Canvas cannot resolve CSS variables, so read the computed token values.

function readVar(style: CSSStyleDeclaration, name: string): string {
  return style.getPropertyValue(name).trim();
}

export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const rgba = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (rgba) {
    const [r, g, b] = rgba[1].split(',').map((part) => part.trim());
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

export interface ChartColors {
  accent: string;
  success: string;
  text: string;
  textDim: string;
  tooltipBg: string;
  tooltipBorder: string;
  grid: string;
}

export function useChartColors(): ChartColors {
  const themeId = useThemeId();
  return useMemo(() => {
    void themeId;
    if (typeof document === 'undefined') {
      return { accent: '#a99cff', success: '#5fd6a2', text: '#e8eaf4', textDim: '#a0a8c0', tooltipBg: '#14172d', tooltipBorder: 'rgba(255,255,255,0.16)', grid: 'rgba(255,255,255,0.08)' };
    }
    const style = getComputedStyle(document.documentElement);
    return {
      accent: readVar(style, '--accent'),
      success: readVar(style, '--success'),
      text: readVar(style, '--text-primary'),
      textDim: readVar(style, '--text-dim'),
      tooltipBg: readVar(style, '--modal-bg'),
      tooltipBorder: readVar(style, '--modal-border'),
      grid: readVar(style, '--border'),
    };
  }, [themeId]);
}

// Inline script (runs before first paint) so the saved theme never flashes.
export const THEME_INIT_SCRIPT = `(function(){try{var m={${THEMES.map((t) => `${t.id}:'${t.mode}'`).join(',')}};var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(!m[t])t='${DEFAULT_THEME}';var r=document.documentElement;r.setAttribute('data-theme',t);r.setAttribute('data-mode',m[t]);}catch(e){}})();`;
