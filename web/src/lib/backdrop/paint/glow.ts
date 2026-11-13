// A soft round light: a radial fade from a colour to nothing, drawn once per
// colour into a small canvas and stretched wherever it shines. Cheaper than
// making a gradient fresh every frame, and the same light everywhere.

const SIZE = 256;
const sprites = new Map<string, HTMLCanvasElement>();

/** The light in [color], SIZE px across, made the first time it is asked for. */
export function glowSprite(color: string): HTMLCanvasElement {
  let sprite = sprites.get(color);
  if (sprite) return sprite;
  sprite = document.createElement('canvas');
  sprite.width = sprite.height = SIZE;
  const g = sprite.getContext('2d');
  if (g) {
    const r = SIZE / 2;
    const fade = g.createRadialGradient(r, r, 0, r, r, r);
    fade.addColorStop(0, color);
    fade.addColorStop(1, 'transparent');
    g.fillStyle = fade;
    g.fillRect(0, 0, SIZE, SIZE);
  }
  // A theme's colours come and go; a handful is all that is ever in use.
  if (sprites.size > 12) sprites.clear();
  sprites.set(color, sprite);
  return sprite;
}

/** Lays the light in [color] on [ctx], centred on screen point (x, y), [r] px round. */
export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number) {
  if (r <= 0.5) return;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
}
