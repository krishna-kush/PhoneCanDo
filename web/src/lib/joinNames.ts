// Names in a sentence: "A", "A and B", "A, B and C". Pure.

export function joinNames(names: string[]): string {
  if (names.length < 2) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
