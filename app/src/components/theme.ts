/** צבעי סדרות לגרפים (פלטה מאומתת לעיוורון צבעים). הממשק לבן בלבד, לכן פלטה בהירה אחת. */
const LIGHT = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', grid: '#e8ebef', axis: '#cfd4db', surface: '#ffffff' };

export type Palette = typeof LIGHT;

export function usePalette(): Palette {
  return LIGHT;
}
