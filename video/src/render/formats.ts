// The shapes we post in: wide for YouTube, LinkedIn, Facebook and X; tall
// for Shorts, Reels, TikTok and stories; square for the feeds. The page
// lays itself out for each from its size (picture/stage.ts).

export const FORMATS = {
  '16x9': { w: 1920, h: 1080 },
  '9x16': { w: 1080, h: 1920 },
  '1x1': { w: 1080, h: 1080 },
} as const;

export type FormatId = keyof typeof FORMATS;

export const isFormat = (id: string): id is FormatId => id in FORMATS;
