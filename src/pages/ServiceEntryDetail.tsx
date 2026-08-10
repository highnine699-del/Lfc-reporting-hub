import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import type { AggregationType } from '../types';

interface TemplateCol {
  id: string;
  field_key: string;
  display_label: string;
  aggregation_type: AggregationType;
  is_static: boolean;
  col_index: number;
}

function isCurrency(col: TemplateCol): boolean {
  return /income|tithe|offer|thank|kcc|shiloh|project|rof|exp|wsf|amount|fund/.test(
    col.field_key.toLowerCase()
  );
}

function getGroup(col: TemplateCol): string {
  const k = col.field_key;
  if (/att|attend|first.?tim|convert|chop/.test(k)) return 'Attendance';
  if (/testimon|altar|bapti|wofbi|holy.?ghost|water|foundation/.test(k)) return 'Spiritual Activity';
  if (/tithe|offer|thank|kcc|shiloh|project|wsf|income/.test(k)) return 'Finance — Income';
  if (/rof|exp|expendit/.test(k)) return 'Finance — Expenditure';
  return 'Other';
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  whatsapp_text: 'WhatsApp',
  voice: 'Voice',
  excel_import: 'Excel Import',
  auto_compile: 'Auto',
};

const GROUP_ORDER = ['Attendance', 'Spiritual Activity', 'Finance — Income', 'Finance — Expenditure', 'Other'];

export default function ServiceEntryDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── fetch the entry ───────────────────────────────────────
  const { data: entry, isLoading } = useQuery({
    queryKey: ['service-entry', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, station_id, service_date, data, source, entered_by, created_at, updated_at, template_version_id')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── fetch template columns for the dynamic edit form ─────
  const { data: templateCols } = useQuery({
    queryKey: ['entry-template-cols', entry?.template_version_id],
    queryFn: async () => {
      if (!entry?.template_version_id) return [];
      const { data, error } = await supabase
        .from('template_columns')
        .select('id, field_key, display_label, aggregation_type, is_static, col_index')
        .eq('template_version_id', entry.template_version_id)
        .eq('is_static', false)
        .order('col_index');
      if (error) throw error;
      return (data ?? []) as TemplateCol[];
    },
    enabled: !!entry?.template_version_id,
  });

  // ── fetch entered_by user name ────────────────────────────
  const { data: enteredByUser } = useQuery({
    queryKey: ['entry-user', entry?.entered_by],
    queryFn: async () => {
      if (!entry?.entered_by) return null;
      const { data } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', entry.entered_by)
        .maybeSingle();
      return data;
    },
    enabled: !!entry?.entered_by,
  });

  // ── save edit ─────────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async (newData: Record<string, any>) => {
      if (!id || !user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('service_entries')
        .update({ data: newData, entered_by: user.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-entry', id] });
      queryClient.invalidateQueries({ queryKey: ['all-entries'] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries'] });
      setIsEditing(false);
      setSuccessMsg('Entry updated.');
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: any) => setErrorMsg(err.message || 'Failed to save.'),
  });

  // ── soft-delete ───────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const { error } = await supabase
        .from('service_entries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-entries'] });
      queryClient.invalidateQueries({ queryKey: ['recent-entries'] });
      navigate('/reports');
    },
    onError: (err: any) => {
      setShowDeleteConfirm(false);
      setErrorMsg(err.message || 'Failed to delete.');
    },
  });

  const startEdit = () => {
    setFormData({ ...(entry?.data ?? {}) });
    setIsEditing(true);
    setErrorMsg(null);
  };

  const setField = (key: string, raw: string) => {
    const num = Number(raw);
    setFormData(prev => ({ ...prev, [key]: raw === '' ? '' : isNaN(num) ? raw : num }));
  };

  // ── loading / not-found states ────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="card p-8 text-center max-w-md">
          <p className="text-gray-500 mb-4">Entry not found or has been deleted.</p>
          <button onClick={() => navigate('/reports')} className="btn btn-primary">Back to Entries</button>
        </div>
      </div>
    );
  }

  const columns = templateCols ?? [];
  const grouped: Record<string, TemplateCol[]> = {};
  for (const col of columns) {
    const g = getGroup(col);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(col);
  }
  const sortedGroups = GROUP_ORDER.filter(g => grouped[g]);

  const isOwnStation = entry.station_id === user?.station_id;
  const canEdit = isOwnStation;

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="btn btn-ghost text-sm">← Back</button>
          {canEdit && !isEditing && (
            <div className="flex gap-2">
              <button onClick={startEdit} className="btn btn-secondary text-sm">Edit Entry</button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn btn-ghost text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => editMutation.mutate(formData)}
                disabled={editMutation.isPending}
                className="btn btn-primary text-sm"
              >
                {editMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setIsEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {new Date(entry.service_date + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="badge badge-neutral text-xs">
              {SOURCE_LABELS[entry.source] ?? entry.source}
            </span>
            {enteredByUser && (
              <span className="text-xs text-gray-400">
                Entered by {enteredByUser.full_name}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(entry.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {entry.updated_at !== entry.created_at && (
              <span className="text-xs text-gray-400">
                · Edited {new Date(entry.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Feedback banners */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
            {successMsg}
          </div>
        )}

        {/* ── View mode ─────────────────────────────────── */}
        {!isEditing && (
          <>
            {columns.length > 0 ? (
              sortedGroups.map(group => (
                <div key={group} className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">{group}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {grouped[group].map(col => {
                      const val = entry.data[col.field_key];
                      if (val === undefined || val === '' || val === null) return null;
                      return (
                        <div key={col.field_key} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">{col.display_label}</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {isCurrency(col) ? '₦' : ''}{typeof val === 'number' ? val.toLocaleString() : val}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              // Fallback: no template columns — just show the raw data blob
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Data</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(entry.data)
                    .filter(([, v]) => v !== '' && v !== 0 && v != null)
                    .map(([k, v]) => (
                      <div key={k} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-400 mb-1 capitalize">{k.replace(/_/g, ' ')}</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {typeof v === 'number' ? v.toLocaleString() : String(v)}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Edit mode ─────────────────────────────────── */}
        {isEditing && (
          <>
            {/* Service date */}
            <div className="card p-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Service Date</label>
              <input
                type="date"
                value={formData._date ?? entry.service_date}
                onChange={e => setFormData(prev => ({ ...prev, _date: e.target.value }))}
                max={new Date().toISOString().slice(0, 10)}
                className="input max-w-xs"
              />
            </div>

            {columns.length > 0 ? (
              sortedGroups.map(group => (
                <div key={group} className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">{group}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {grouped[group].map(col => (
                      <div key={col.field_key}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {col.display_label}
                        </label>
                        {isCurrency(col) ? (
                          <div className="flex">
                            <span className="inline-flex items-center px-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">₦</span>
                            <input
                              type="number" min="0"
                              value={formData[col.field_key] ?? ''}
                              onChange={e => setField(col.field_key, e.target.value)}
                              className="input rounded-l-none" placeholder="0"
                            />
                          </div>
                        ) : (
                          <input
                            type="number" min="0"
                            value={formData[col.field_key] ?? ''}
                            onChange={e => setField(col.field_key, e.target.value)}
                            className="input" placeholder="0"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Fallback edit: free-form key-value
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Data</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.keys(entry.data).map(k => (
                    <div key={k}>
                      <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                        {k.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="number" min="0"
                        value={formData[k] ?? ''}
                        onChange={e => setField(k, e.target.value)}
                        className="input" placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Delete this entry?</h2>
            <p className="text-sm text-gray-500 mb-6">
              The entry will be removed from all lists. This action can be reversed by an admin if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn btn-danger flex-1"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn btn-secondary flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
