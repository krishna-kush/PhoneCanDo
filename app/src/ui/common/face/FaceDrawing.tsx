import { type ComponentType, Fragment, type ReactNode } from 'react';
import { type StyleProp, type TextStyle, View, type ViewStyle } from 'react-native';
import type { AnimatedStyle } from 'react-native-reanimated';
import tokens from '../../../../../theme/tokens.json';
import { useTheme } from '../globals';
import type { Part } from './change/parts';
import type { FaceLayout } from './layout';
import { HEART, HEART_SHIFT } from './motion';
import WearMarks from './WearMarks';

type Style = StyleProp<AnimatedStyle<ViewStyle>>;

/** The views a face's moving parts are drawn with: Reanimated's on a live face, plain ones on a still one. */
export type Moving = {
  View: ComponentType<{ style?: Style; children?: ReactNode }>;
  Text: ComponentType<{ style?: StyleProp<AnimatedStyle<TextStyle>>; children?: ReactNode }>;
};

/** Each moving part's style at this moment (motion.ts), its opacity its weight in a change (change/parts.ts): animated on a live face, plain on a still one. */
export type MotionStyles = {
  body: Style;
  eye: Style;
  pupil: Style;
  smile: Style;
  z: StyleProp<AnimatedStyle<TextStyle>>;
  drop: Style;
  query: StyleProp<AnimatedStyle<TextStyle>>;
};

/** Where a happy face's heart starts, and its ink. */
export type HeartPlace = { left: number; top: number; cell: number; color: string };

type Props = {
  layout: FaceLayout;
  /** The parts it draws (change/parts.ts): its mood's, or both moods' as it changes, each at its weight. */
  parts: readonly Part[];
  moving: Moving;
  motion: MotionStyles;
  /** How many hearts a happy face shows (1 to 3). */
  hearts: number;
  /** The [i]th of [count] hearts, at [place]. */
  heart: (i: number, count: number, place: HeartPlace) => ReactNode;
};

// A-01's face as drawn, for the live face (AgentFace) and the still one
// (StillFace) alike: the logo's red square on its amber shadow with two
// eyes, in the agent's own mascot (its shape, which ink is in front and what
// it wears, laid out by the shared spec), and the mood's marks: a "z"
// asleep, a "?" in trouble, a drop when sweaty, hearts when happy.
// Decoration only (hidden from screen readers): rows say the state in words.
export default function FaceDrawing({ layout: f, parts, moving, motion, hearts, heart }: Props) {
  const t = useTheme();
  const has = (p: Part) => parts.includes(p);
  const { fig, dx, dy, eyeA, eyeB, eyeW, eyeH, pupil } = f;
  const front = fig.front;

  // Happy: each eye an upturned bracket, shut in a smile.
  const smileEye = (x: number, y: number) => (
    <moving.View
      style={[
        {
          position: 'absolute',
          left: x,
          top: y + Math.round(eyeH * 0.2),
          width: eyeW,
          height: Math.max(f.line * 2, Math.round(eyeH * 0.5)),
          borderColor: t.onPrimary,
          borderTopWidth: f.line,
          borderLeftWidth: f.line,
          borderRightWidth: f.line,
        },
        motion.smile,
      ]}
    />
  );

  // The pupils' gaze is motion.pupil's (awake rests them a little to the right, motion.ts's LOOK).
  const eye = (x: number, y: number) => (
    <moving.View style={[{ position: 'absolute', left: x, top: y, width: eyeW, height: eyeH, backgroundColor: t.onPrimary }, motion.eye]}>
      {pupil && has('pupils') ? (
        <moving.View
          style={[
            {
              position: 'absolute',
              left: pupil.x - eyeA.x,
              top: pupil.y - eyeA.y,
              width: pupil.w,
              height: pupil.h,
              backgroundColor: tokens.dark.bg,
            },
            motion.pupil,
          ]}
        />
      ) : null}
    </moving.View>
  );

  // The hearts start low on the head's top-right corner, the later ones a
  // little further left.
  const heartCount = Math.max(1, Math.min(hearts, HEART_SHIFT.length));

  return (
    <View
      style={{ width: f.box, height: f.box, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <moving.View style={[{ position: 'absolute', left: 0, top: 0, width: f.box, height: f.box }, motion.body]}>
        <View
          style={{
            position: 'absolute',
            left: fig.back.x + dx,
            top: fig.back.y + dy,
            width: f.bodyW,
            height: f.bodyH,
            backgroundColor: fig.back.ink === 'red' ? t.primary : t.secondary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: f.left,
            top: f.top,
            width: f.bodyW,
            height: f.bodyH,
            backgroundColor: front.ink === 'red' ? t.primary : t.secondary,
          }}
        >
          {has('eyes') ? eye(eyeA.x - front.x, eyeA.y - front.y) : null}
          {has('eyes') ? eye(eyeB.x - front.x, eyeB.y - front.y) : null}
          {has('smile') ? smileEye(eyeA.x - front.x, eyeA.y - front.y) : null}
          {has('smile') ? smileEye(eyeB.x - front.x, eyeB.y - front.y) : null}
        </View>
        <WearMarks marks={fig.marks} box={f.box} dx={dx} dy={dy} />
      </moving.View>
      {has('z') ? (
        <moving.Text
          style={[{ position: 'absolute', right: 0, top: 0, fontFamily: 'GeistMono-Bold', fontSize: f.mark, color: t.dim }, motion.z]}
        >
          z
        </moving.Text>
      ) : null}
      {has('drop') ? (
        <moving.View
          style={[
            {
              position: 'absolute',
              left: f.left + f.bodyW - Math.round(f.drop * 0.6),
              top: f.top + Math.round(f.bodyH * 0.05),
              width: f.drop,
              height: f.drop,
              backgroundColor: t.dim,
              borderTopLeftRadius: 0,
              borderTopRightRadius: f.drop / 2,
              borderBottomLeftRadius: f.drop / 2,
              borderBottomRightRadius: f.drop / 2,
            },
            motion.drop,
          ]}
        />
      ) : null}
      {has('hearts')
        ? Array.from({ length: heartCount }, (_, i) => (
            <Fragment key={i}>
              {heart(i, heartCount, {
                left: f.left + f.bodyW + f.off - Math.round(f.heartW * (0.5 - HEART_SHIFT[i])),
                top: f.crown - f.heartH + f.cell,
                cell: f.cell,
                color: t.primary,
              })}
            </Fragment>
          ))
        : null}
      {has('query') ? (
        <moving.Text
          style={[{ position: 'absolute', right: 0, top: 0, fontFamily: 'GeistMono-Bold', fontSize: f.mark, color: t.primary }, motion.query]}
        >
          ?
        </moving.Text>
      ) : null}
    </View>
  );
}

// One pixel heart of a happy face at [place], built from squares like the
// logo; [style] moves it (the live face's rise, or the still one's rest).
export function PixelHeart({ place, style, view: Box }: { place: HeartPlace; style: Style; view: Moving['View'] }) {
  const { left, top, cell, color } = place;
  return (
    <Box style={[{ position: 'absolute', left, top, width: cell * HEART[0].length, height: cell * HEART.length }, style]}>
      {HEART.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === 'X' ? (
            <View
              key={`${x}-${y}`}
              style={{ position: 'absolute', left: x * cell, top: y * cell, width: cell, height: cell, backgroundColor: color }}
            />
          ) : null,
        ),
      )}
    </Box>
  );
}
