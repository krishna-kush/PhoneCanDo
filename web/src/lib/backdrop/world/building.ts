// The building: a phone cut open from the front, one floor per part of the
// page, the glass on top, the board at the back and the night under the last
// floor. World units are CSS px on the page plane (camera.ts).

/** Camera to the page plane. */
export const LENS = 900;
/** Floor to floor. */
export const PITCH = 640;
/** A floor's thickness: its cut face along the front. */
export const SLAB = 22;
/** How far back the floors run, to the board. */
export const DEEP = 1500;
/** How high over a floor the camera rides while its part of the page is read. */
export const EYE = 130;

/** World y of floor i's top, where its units stand. */
export const floorY = (i: number) => (i + 1) * PITCH;

/** Camera y for a floor number from track.ts: halfway through a part, EYE over its floor. */
export const cameraY = (floor: number) => (floor + 0.5) * PITCH - EYE;
