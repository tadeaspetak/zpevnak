/**
 * The song to review after `id`: the one that followed it in the queue as the editor saw it,
 * if it is still waiting, else the next one after that, wrapping round to the start. A skipped
 * song comes back only once the rest have been seen. Null when nothing else is waiting.
 */
export function nextInQueue(
  seen: number[],
  waiting: number[],
  id: number,
): number | null {
  const still = new Set(waiting.filter((other) => other !== id));
  const from = seen.indexOf(id);
  const order = from === -1 ? seen : [...seen.slice(from + 1), ...seen.slice(0, from)];
  // Songs that arrived since the editor loaded the queue come after the ones they saw.
  const arrived = waiting.filter((other) => other !== id && !seen.includes(other));
  return [...order, ...arrived].find((other) => still.has(other)) ?? null;
}
