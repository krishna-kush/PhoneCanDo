import { useEffect, useRef, useState } from 'react';
import { autoPick } from '../../engine/agents/offers';
import type { ImageId } from '../../engine/linux/types';
import { getBuildChannel } from '../../engine/runner';
import { continueWithoutLinux, setUpFirstAgent, type SetupPath } from '../../state/flows/firstLaunch';
import { offersForEnv } from '../../state/flows/kindOffers';
import { linuxErrorCode } from '../../state/flows/logic/errors';
import type { AgentPick } from '../../state/flows/logic/modelStep';
import { asksForModel } from '../../state/flows/newAgent';
import { useLinuxStore } from '../../state/linux';
import { setupOfferEnv } from '../env/logic/agentChoice';
import { linuxFailureText } from '../env/logic/errorText';
import type { SetupContext } from './copy';

export type SetupPhase = { kind: 'choosing' } | { kind: 'working' } | { kind: 'failed'; reason: string };

// Runs first launch once: Linux when this build has it, else straight to the
// Android path. A build that has Linux but not the Default image (a dev
// build before staging it) answers linux_unavailable, which takes the
// Android path the same way. Choose agent comes first when there is a
// choice of kind, or of model (the Model step); falling back to Android
// asks again only when the kind picked cannot run there. Retry runs the same path again (setup reuses the
// image it already made); Continue without Linux drops that image and takes
// the Android path. Success needs nothing here: App swaps this screen out as
// soon as the first agent exists. Everything the steps share is in refs or
// state setters, so a step started in one render finishes right in a later one.
export function useFirstLaunch() {
  const [ctx, setCtx] = useState<SetupContext>({ path: 'linux', play: false, noLinux: null });
  const [imageId, setImageId] = useState<ImageId | null>(null);
  const [phase, setPhase] = useState<SetupPhase>({ kind: 'working' });
  const started = useRef(false);
  /** The kind (and model) being set up, once picked. */
  const pick = useRef<AgentPick | null>(null);
  /** The Linux image to drop when the Android path runs (it failed, or Linux was skipped). */
  const dropImage = useRef<ImageId | null>(null);

  function run(path: SetupPath, chosen: AgentPick) {
    setPhase({ kind: 'working' });
    if (path === 'android') {
      setImageId(null);
      const drop = dropImage.current;
      dropImage.current = null;
      continueWithoutLinux(drop, chosen, { onImage: setImageId }).catch((e: unknown) =>
        setPhase({ kind: 'failed', reason: linuxFailureText(e) }),
      );
      return;
    }
    let made: ImageId | null = null;
    setUpFirstAgent('linux', chosen, {
      onImage: (id) => {
        made = id;
        setImageId(id);
      },
    }).catch((e: unknown) => {
      if (linuxErrorCode(e) === 'linux_unavailable') toAndroid('unavailable', made);
      else setPhase({ kind: 'failed', reason: linuxFailureText(e) });
    });
  }

  // Goes on with the pick already made when its kind can run on this path,
  // or the only kind there is when there is no model to ask about; else asks.
  function proceed(path: SetupPath) {
    const picked = pick.current;
    const kindId = autoPick(offersForEnv(setupOfferEnv(path, useLinuxStore.getState().envs)), picked?.kindId ?? null);
    const kept = picked && picked.kindId === kindId ? picked : null;
    const chosen = kept ?? (kindId && !asksForModel(kindId) ? { kindId, modelId: null } : null);
    if (!chosen) {
      setPhase({ kind: 'choosing' });
      return;
    }
    pick.current = chosen;
    run(path, chosen);
  }

  function toAndroid(noLinux: SetupContext['noLinux'], failedImageId: ImageId | null) {
    dropImage.current = failedImageId;
    setImageId(null);
    setCtx((c) => ({ ...c, path: 'android', noLinux }));
    proceed('android');
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useLinuxStore.getState().hydrateLinux();
    const play = getBuildChannel() === 'play';
    const available = useLinuxStore.getState().status.available;
    setCtx({ path: available ? 'linux' : 'android', play, noLinux: available ? null : 'unavailable' });
    proceed(available ? 'linux' : 'android');
    // Once, on mount (started guards a second run); the steps read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Choose agent's Continue: sets up the pick on the current path. */
  const choose = (chosen: AgentPick) => {
    pick.current = chosen;
    run(ctx.path, chosen);
  };

  const retry = () => {
    if (pick.current) run(ctx.path, pick.current);
    else proceed(ctx.path);
  };

  const skipLinux = () => toAndroid('skipped', imageId);

  return { ctx, imageId, phase, choose, retry, skipLinux };
}
