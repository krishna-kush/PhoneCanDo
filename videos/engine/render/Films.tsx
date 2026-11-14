// Every film as Remotion compositions, one for each format it is made in:
// what the preview lists and a render picks from. A composition's length
// and rate come from the film's beat line; `fps` in a render's props makes
// a draft at another rate without changing a film (every move is written
// in beats, never frames). Each shot is a named bar on the preview's
// timeline.

import { Audio } from '@remotion/media';
import type { ComponentType } from 'react';
import { AbsoluteFill, Composition, Folder, Sequence, staticFile, useVideoConfig, type CalculateMetadataFunction } from 'remotion';
import { frameOf, secondsOf } from '../beats/tempo.ts';
import { ClockProvider } from '../stage/Clock.tsx';
import { FORMATS } from '../stage/formats.ts';
import { compositionId, mixFile, type Film } from './film.ts';
import { Hud } from './Hud.tsx';

export type RenderProps = {
  /** Frames a second, when not the film's own. */
  fps?: number;
  /** Burns the shot, beat and time into a corner, for review. */
  hud?: boolean;
};

/** The film's shots as bars on the preview's timeline; they draw nothing. */
function ShotBars({ film }: { film: Film }) {
  const { fps } = useVideoConfig();
  return (
    <>
      {film.line.shots.map((shot) => {
        const from = frameOf(film.tempo, film.line.startOf(shot.id), fps);
        const to = frameOf(film.tempo, film.line.startOf(shot.id) + shot.beats, fps);
        return (
          <Sequence key={shot.id} name={shot.id} from={from} durationInFrames={Math.max(1, to - from)} layout="none">
            {null}
          </Sequence>
        );
      })}
    </>
  );
}

function frameFor(film: Film): ComponentType<RenderProps> {
  return function FilmFrame({ hud }: RenderProps) {
    return (
      <AbsoluteFill>
        <ClockProvider tempo={film.tempo}>
          <film.Picture />
          {hud ? <Hud film={film} /> : null}
        </ClockProvider>
        <ShotBars film={film} />
        {film.sound ? <Audio src={staticFile(mixFile(film.id))} /> : null}
      </AbsoluteFill>
    );
  };
}

const lengthOf = (film: Film, fps: number) => Math.max(1, Math.round(secondsOf(film.tempo, film.line.total) * fps));

export function Films({ films }: { films: readonly Film[] }) {
  return (
    <>
      {films.map((film) => {
        const Frame = frameFor(film);
        const metadata: CalculateMetadataFunction<RenderProps> = ({ props }) => {
          const fps = props.fps ?? film.fps;
          return { fps, durationInFrames: lengthOf(film, fps) };
        };
        return (
          <Folder key={film.id} name={film.id}>
            {film.formats.map((format) => (
              <Composition
                key={format}
                id={compositionId(film.id, format)}
                component={Frame}
                width={FORMATS[format].w}
                height={FORMATS[format].h}
                fps={film.fps}
                durationInFrames={lengthOf(film, film.fps)}
                defaultProps={{}}
                calculateMetadata={metadata}
              />
            ))}
          </Folder>
        );
      })}
    </>
  );
}
