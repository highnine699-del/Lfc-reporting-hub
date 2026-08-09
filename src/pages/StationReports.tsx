import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { PeriodType, StationLevel } from '../types';

const LEVEL_ORDER: StationLevel[] = ['community', 'area', 'zonal', 'district', 'state', 'headquarters'];

const LEVEL_LABELS: Record<StationLevel, string> = {
  community: 'Community',
  area: 'Area',
  zonal: 'Zonal',
  district: 'District',
  state: 'State',
  headquarters: 'Headquarters',
};

const PERIOD_LABELS: Record<PeriodType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_year: 'Half-Yearly',
  yearly: 'Yearly',
};

/**
 * Recursively collect all descendant station IDs from a flat station array.
 * Stops at depth 6 (the max hierarchy depth) to guard against cycles.
 */
function collectDescendants(
  rootId: string,
  allStations: Array<{ id: string; parent_station_id: string | null }>,
  depth = 0
): string[] {
  if (depth > 6) return [];
  const children = allStations.filter(s => s.parent_station_id === rootId);
  return children.flatMap(c => [c.id, ...collectDescendants(c.id, allStations, depth + 1)]);
}

export default function StationReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedStationId, setSelectedStationId] = useState<string | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'finalized'>('all');
  const [filterPeriod, setFilterPeriod] = useState<PeriodType | 'all'>('all');

  // Step 1 — fetch the user's own station to know its level
  const { data: myStation } = useQuery({
    queryKey: ['my-station', user?.station_id],
    queryFn: async () => {
      if (!user?.station_id) return null;
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, level, parent_station_id')
        .eq('id', user.station_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.station_id,
  });

  // Step 2 — fetch ALL stations so we can build the subtree client-side
  const { data: allStations } = useQuery({
    queryKey: ['all-stations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, level, parent_station_id');
      if (error) throw error;
      return data ?? [];
    },
  });

  // Compute the full subtree of descendant station IDs
  const descendantIds = useMemo(() => {
    if (!user?.station_id || !allStations) return [];
    return collectDescendants(user.station_id, allStations);
  }, [user?.station_id, allStations]);

  // Build a map of id → station for display
  const stationMap = useMemo(() => {
    const map: Record<string, { id: string; name: string; level: StationLevel }> = {};
    (allStations ?? []).forEach((s: any) => { map[s.id] = s; });
    return map;
  }, [allStations]);

  // Direct child stations only (for the station selector dropdown)
  const directChildren = useMemo(() => {
    if (!user?.station_id || !allStations) return [];
    return (allStations as any[]).filter(s => s.parent_station_id === user.station_id);
  }, [user?.station_id, allStations]);

  // Step 3 — fetch reports for the entire subtree
  const { data: reports, isLoading, isError } = useQuery({
    queryKey: ['sub-station-reports', user?.station_id, descendantIds],
    queryFn: async () => {
      if (!descendantIds.length) return [];
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          station_id,
          period_type,
          period_start,
          period_end,
          status,
          current_version_id,
          created_at,
          templates ( name )
        `)
        .in('station_id', descendantIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: descendantIds.length > 0,
  });

  // Apply filters
  const filtered = useMemo(() => {
    if (!reports) return [];
    return reports.filter((r: any) => {
      if (selectedStationId !== 'all') {
        // If a direct child is selected, include it and all its descendants
        const target = selectedStationId;
        const subtree = allStations
          ? [target, ...collectDescendants(target, allStations)]
          : [target];
        if (!subtree.includes(r.station_id)) return false;
      }
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (filterPeriod !== 'all' && r.period_type !== filterPeriod) return false;
      return true;
    });
  }, [reports, selectedStationId, filterStatus, filterPeriod, allStations]);

  // Group by station
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((r: any) => {
      if (!groups[r.station_id]) groups[r.station_id] = [];
      groups[r.station_id].push(r);
    });
    // Sort stations by hierarchy level
    return Object.entries(groups).sort(([aId], [bId]) => {
      const aLevel = LEVEL_ORDER.indexOf(stationMap[aId]?.level ?? 'community');
      const bLevel = LEVEL_ORDER.indexOf(stationMap[bId]?.level ?? 'community');
      return aLevel - bLevel;
    });
  }, [filtered, stationMap]);

  const noHierarchy = !isLoading && descendantIds.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Sub-Station Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {myStation
              ? `Reports from all stations under ${myStation.name} (${LEVEL_LABELS[myStation.level as StationLevel] ?? myStation.level})`
              : 'Reports from stations in your hierarchy'}
          </p>
        </div>

        {noHierarchy ? (
          <div className="card p-10 text-center">
            <p className="text-gray-500 text-sm font-medium">No sub-stations found</p>
            <p className="text-gray-400 text-xs mt-2">
              Your station has no child stations in the hierarchy. Sub-station reports will appear here
              once stations are linked via <code className="bg-gray-100 px-1 rounded">parent_station_id</code>.
            </p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="card p-4 mb-6 flex flex-wrap gap-4">
              {directChildren.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Station</label>
                  <select
                    value={selectedStationId}
                    onChange={e => setSelectedStationId(e.target.value)}
                    className="input text-sm py-1.5"
                  >
                    <option value="all">All sub-stations</option>
                    {directChildren.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({LEVEL_LABELS[s.level as StationLevel] ?? s.level})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value as any)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="finalized">Finalized</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Period type</label>
                <select
                  value={filterPeriod}
                  onChange={e => setFilterPeriod(e.target.value as any)}
                  className="input text-sm py-1.5"
                >
                  <option value="all">All periods</option>
                  {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading sub-station reports...</div>
            ) : isError ? (
              <div className="card p-6 text-center text-red-500 text-sm">
                Failed to load reports. Please refresh and try again.
              </div>
            ) : grouped.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-gray-400 text-sm">No reports found for the selected filters.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {grouped.map(([stationId, stationReports]) => {
                  const station = stationMap[stationId];
                  return (
                    <div key={stationId}>
                      {/* Station header */}
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {station?.name ?? 'Unknown Station'}
                        </h3>
                        {station?.level && (
                          <span className="badge badge-neutral text-xs capitalize">
                            {LEVEL_LABELS[station.level as StationLevel] ?? station.level}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          ({stationReports.length} report{stationReports.length !== 1 ? 's' : ''})
                        </span>
                      </div>

                      <div className="space-y-2">
                        {stationReports.map((report: any) => (
                          <div
                            key={report.id}
                            onClick={() => navigate(`/report/${report.id}`)}
                            className="card p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {report.templates?.name ?? PERIOD_LABELS[report.period_type as PeriodType] ?? report.period_type} Report
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(report.period_start).toLocaleDateString()} – {new Date(report.period_end).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`badge ${report.status === 'finalized' ? 'badge-success' : 'badge-neutral'}`}>
                                  {report.status === 'finalized' ? 'Finalized' : 'Draft'}
                                </span>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
