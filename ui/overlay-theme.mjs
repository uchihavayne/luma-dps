// The look the player chose, for the detached windows: the theme's four colours (or the custom ones), the
// font and the opacity. The meter window applies the same preferences to itself; each detached window
// reads them too, so a theme or an opacity changes every window and not only the meter.
import { FONTS, THEMES } from './model.mjs';

const lightness = hex => {
  const channels = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};

// The CSS variables a window sets on its root, and whether the surface is light.
export function themeVariables(prefs) {
  const wanted = prefs?.theme === 'custom' ? prefs.customColors : THEMES[prefs?.theme];
  const colors = ['bg', 'panel', 'text', 'accent'].every(key => /^#[0-9a-f]{6}$/i.test(wanted?.[key] ?? '')) ? wanted : THEMES.graphite;
  const opacity = Number.isFinite(prefs?.opacity) ? Math.min(1, Math.max(0.25, prefs.opacity)) : 0.92;
  return {
    light: lightness(colors.bg) > .3,
    variables: {
      '--bg': colors.bg, '--panel': colors.panel, '--text': colors.text, '--accent': colors.accent,
      '--muted': `color-mix(in srgb, ${colors.text} 58%, ${colors.bg})`,
      '--line': `color-mix(in srgb, ${colors.text} 10%, transparent)`,
      '--body-font': FONTS[prefs?.font] ?? FONTS.system,
      '--alpha': String(opacity),
    },
  };
}

export function applyTheme(prefs, root = document.documentElement) {
  const { light, variables } = themeVariables(prefs);
  for (const [name, value] of Object.entries(variables)) root.style.setProperty(name, value);
  root.dataset.surface = light ? 'light' : 'dark';
  root.style.colorScheme = light ? 'light' : 'dark';
}
