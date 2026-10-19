/** Eigene Reihenfolge der Playlists in der Seitenleiste; der Server kennt keine. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  // Unbekannte (neue) Playlists bleiben in Serverreihenfolge hinter den einsortierten.
  return items
    .map((item, i) => ({ item, key: rank.get(item.id) ?? order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.item);
}

export function moveId(ids: string[], from: number, to: number): string[] {
  const next = [...ids];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
