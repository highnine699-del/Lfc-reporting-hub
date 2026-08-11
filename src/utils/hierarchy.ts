/**
 * Recursively collects the IDs of all descendant stations of a given root.
 * Depth is capped at 6 levels to prevent infinite loops on bad data.
 */
export function collectDescendants(
  rootId: string,
  allStations: Array<{ id: string; parent_station_id: string | null }>,
  depth = 0,
): string[] {
  if (depth > 6) return [];
  const children = allStations.filter(s => s.parent_station_id === rootId);
  return children.flatMap(c => [c.id, ...collectDescendants(c.id, allStations, depth + 1)]);
}
