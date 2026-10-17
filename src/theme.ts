import { useColorScheme } from 'react-native';

const accent = '#7c5cff';

export const Colors = {
  light: {
    accent,
    onAccent: '#ffffff',
    text: '#111114',
    textSecondary: '#62636C',
    background: '#ffffff',
    surface: '#F2F2F6',
    surfaceStrong: '#E4E4EA',
    border: '#DCDCE2',
    /** Border of a hovered input. */
    borderStrong: '#B9B9C3',
    userBubble: accent,
    userBubbleText: '#ffffff',
    danger: '#D93036',
    dangerSurface: '#FDECEC',
  },
  dark: {
    accent: '#9b85ff',
    onAccent: '#ffffff',
    text: '#F2F2F5',
    textSecondary: '#A2A3AD',
    background: '#0E0E11',
    surface: '#1C1C21',
    surfaceStrong: '#2A2A31',
    border: '#2F2F37',
    borderStrong: '#4A4A55',
    userBubble: '#6a4ff0',
    userBubbleText: '#ffffff',
    danger: '#FF6369',
    dangerSurface: '#3B1416',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export function useColors(): ThemeColors {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const Radius = { sm: 8, md: 12, lg: 20, pill: 999 } as const;

/** Removes the browser's own focus ring on web, where inputs draw their own focus state. */
// Chrome's default `auto` focus ring ignores width and colour, so switch to a zero-width solid outline.
export const noWebOutline = process.env.EXPO_OS === 'web' ? ({ outlineStyle: 'solid', outlineWidth: 0 } as const) : {};
