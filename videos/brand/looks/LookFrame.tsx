// The frame every film of ours is drawn in: the look's colours as the
// site's CSS vars, the three faces, and --u for the stylesheets. Wrap a
// film's picture in one.

import type { CSSProperties, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { useStage } from '../../engine/stage/useStage.ts';
import { FONT, loadFonts } from './fonts.ts';
import { DAY, varsOf, type Look } from './look.ts';
import './type.css';

loadFonts();

export function LookFrame({ look = DAY, children }: { look?: Look; children?: ReactNode }) {
  const { u } = useStage();
  const vars = { ...varsOf(look), '--u': `${u}px`, '--sans': FONT.sans, '--mono': FONT.mono, '--serif': FONT.serif } as CSSProperties;
  return (
    <AbsoluteFill
      style={{
        ...vars,
        background: 'var(--bg)',
        color: 'var(--fg)',
        fontFamily: 'var(--sans)',
        overflow: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
