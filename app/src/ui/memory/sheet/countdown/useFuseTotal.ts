import { useState } from 'react';

/**
 * How long the fuse is: the seconds left when this countdown was first
 * seen here, so it burns down from full whenever you look. A new countdown
 * (a new `stopAt`, as when memory turns critical) lays a new fuse.
 */
export function useFuseTotal(stopAt: number | null, seconds: number | null): number {
  const [fuse, setFuse] = useState({ stopAt, total: seconds ?? 0 });
  if (fuse.stopAt !== stopAt) {
    const next = { stopAt, total: seconds ?? 0 };
    setFuse(next);
    return next.total;
  }
  return fuse.total;
}
