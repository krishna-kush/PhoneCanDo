// What a download's parcel run says (Route.tsx): its tracker's stops, each
// reached at its share of the download and naming where the parcel comes
// from, and its one line while it waits. Pure (zero RN imports).

/** The tracker's stops, in order, each reached at its share of the download. */
export function trackingStops(from: string): readonly { at: number; line: string }[] {
  return [
    { at: 0, line: `Picked up at ${from}` },
    { at: 0.25, line: 'On the road' },
    { at: 0.5, line: 'Halfway there' },
    { at: 0.75, line: 'Turning into your street' },
    { at: 1, line: 'At your door' },
  ];
}

/** How many stops the download has reached (the first as it starts). */
export function stopsReached(fraction: number | null): number {
  const f = fraction ?? 0;
  return trackingStops('').filter((s) => f >= s.at).length;
}

/** The tracker's one line while the parcel waits to be sent for. */
export function waitingLine(from: string): string {
  return `Packed and waiting at ${from}`;
}
