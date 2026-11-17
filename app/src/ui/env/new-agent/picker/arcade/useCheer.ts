import { useEffect, useState } from 'react';

/** How long a newly picked applicant smiles. */
const CHEER_MS = 1600;

// A pick's little celebration: each time [picked] changes to another
// applicant, its face hops once and smiles a moment (hearts and all), then
// carries on awake. Nothing for the applicant the step opens on.
export function useCheer(picked: string | null): { hop: number; cheering: boolean } {
  const [seen, setSeen] = useState(picked);
  const [hop, setHop] = useState(0);
  const [cheering, setCheering] = useState(false);
  if (picked !== seen) {
    setSeen(picked);
    if (picked != null) {
      setHop((h) => h + 1);
      setCheering(true);
    }
  }
  useEffect(() => {
    if (!cheering) return;
    const t = setTimeout(() => setCheering(false), CHEER_MS);
    return () => clearTimeout(t);
  }, [cheering, hop]);
  return { hop, cheering };
}
