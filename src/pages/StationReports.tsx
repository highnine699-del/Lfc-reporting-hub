import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { StationLevel } from '../types';

import { collectDescendants } from '../utils/hierarchy';

const LEVEL_LABELS: Record<StationLevel, string> = {
  community: 'Community',
  area: 'Area',
  zonal: 'Zonal',
  district: 'District',
  state: 'State',
  headquarters: 'Headquarters',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  whatsapp_text: 'WhatsApp',
  voice: 'Voice',
  excel_import: 'Excel Import',
  auto_compile: 'Auto',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function StationReports() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth());
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [selectedStationId, setSelectedStationId] = useState<string | 'all'>('all');
  const [filterSource, setFilterSource] = useState('all');

  // ── fetch all stations ────────────────────────────────────
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

  // Descendants of the user's station (supervisor view)
  const descendantIds = useMemo(() => {
    if (!user?.station_id || !allStations) return [];
    return collectDescendants(user.station_id, allStations);
  }, [user?.station_id, allStations]);

  const stationMap = useMemo(() => {
    const m: Record<string, { id: string; name: string; level: StationLevel }> = {};
    (allStations ?? []).forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [allStations]);

  const directChildren = useMemo(() => {
    if (!user?.station_id || !allStations) return [];
    return (allStations as any[]).filter(s => s.parent_station_id === user.station_id);
  }, [user?.station_id, allStations]);

  // Date range for the selected month
  const periodStart = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(filterYear, filterMonth + 1, 0).getDate();
  const periodEnd = `${filterYear}-${String(filterMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // ── fetch service entries for all descendant stations ─────
  const { data: entries, isLoading, isError } = useQuery({
    queryKey: ['sub-station-entries', descendantIds, periodStart, periodEnd],
    queryFn: async () => {
      if (!descendantIds.length) return [];
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, station_id, service_date, data, source, created_at')
        .in('station_id', descendantIds)
        .gte('service_date', periodStart)
        .lte('service_date', periodEnd)
        .is('deleted_at', null)
        .order('service_date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: descendantIds.length > 0,
  });

  // ── filter + group ────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e: any) => {
      if (selectedStationId !== 'all') {
        const subtree = allStations
          ? [selectedStationId, ...collectDescendants(selectedStationId, allStations)]
          : [selectedStationId];
        if (!subtree.includes(e.station_id)) return false;
      }
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      return true;
    });
  }, [entries, selectedStationId, filterSource, allStations]);

  // Group entries by station_id
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((e: any) => {
      if (!groups[e.station_id]) groups[e.station_id] = [];
      groups[e.station_id].push(e);
    });
    return Object.entries(groups);
  }, [filtered]);

  const summarise = (data: Record<string, any>): string => {
    const pairs = Object.entries(data)
      .filter(([, v]) => v !== '' && v !== 0 && v != null)
      .slice(0, 3)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toLocaleString() : v}`);
    return pairs.join(' · ') || 'No data';
  };

  const noHierarchy = !isLoading && descendantIds.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="btn btn-ghost text-sm">← Back to Dashboard</button>
          <button onClick={() => navigate('/generate-report')} className="btn btn-secondary text-sm">Generate Report</button>
        </div>
      </header>

      <main className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Sub-Station Entries</h1>
          <p className="text-sm text-gray-500 mt-1">
            Service entries from all stations under yours
          </p>
        </div>

        {noHierarchy ? (
          <div className="card p-10 text-center">
            <p className="text-gray-500 text-sm font-medium">No sub-stations found</p>
            <p className="text-gray-400 text-xs mt-2">
              Your station has no child stations. Sub-station entries appear here once stations
              are linked via their parent.
            </p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="card p-4 mb-6 flex flex-wrap gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Month</label>
                <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="input text-sm py-1.5">
                  {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Year</label>
                <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="input text-sm py-1.5">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              {directChildren.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Station</label>
                  <select value={selectedStationId} onChange={e => setSelectedStationId(e.target.value)} className="input text-sm py-1.5">
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
                <label className="block text-xs text-gray-500 mb-1">Source</label>
                <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="input text-sm py-1.5">
                  <option value="all">All sources</option>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-400">Loading entries…</div>
            ) : isError ? (
              <div className="card p-6 text-center text-red-500 text-sm">Failed to load. Please refresh.</div>
            ) : grouped.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-gray-400 text-sm">
                  No service entries found for {MONTHS[filterMonth]} {filterYear}.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {grouped.map(([stationId, stationEntries]) => {
                  const station = stationMap[stationId];
                  return (
                    <div key={stationId}>
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
                          ({stationEntries.length} entr{stationEntries.length !== 1 ? 'ies' : 'y'})
                        </span>
                      </div>

                      <div className="space-y-2">
                        {stationEntries.map((entry: any) => (
                          <div
                            key={entry.id}
                            onClick={() => navigate(`/entry/${entry.id}`)}
                            className="card p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-gray-900">
                                    {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', {
                                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                                    })}
                                  </p>
                                  <span className="badge badge-neutral text-xs">
                                    {SOURCE_LABELS[entry.source] ?? entry.source}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {summarise(entry.data)}
                                </p>
                              </div>
                              <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
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
