import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/format';
import { C, pageStyle, glassCard, glassHeader } from '../lib/theme';
import type { StationCategory, WofbiClass, FacilityDetails } from '../types';

declare global {
  interface Window {
    PaystackPop?: { setup: (o: any) => { openIframe: () => void } };
  }
}

const SUBSCRIPTION_AMOUNT_KOBO = 500_000;

// ── Shared input style ────────────────────────────────────────
const inp: React.CSSProperties = {
  width: '100%', height: 42, borderRadius: 10, padding: '0 12px',
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
  color: C.textPrimary, fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: C.textMuted, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: '0.06em',
};

// ── Collapsible section ───────────────────────────────────────
function Section({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ ...glassCard, padding: 0, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer',
          color: C.textPrimary,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {/* tiny inline chevron — no Tailwind, no huge SVG */}
        <span style={{
          display: 'inline-block', width: 18, height: 18, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s',
          color: C.textMuted,
        }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 8 10 13 15 8" />
          </svg>
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 24px 24px', borderTop: `1px solid ${C.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Toggle pill for category / WOFBI ─────────────────────────
function Pill({ options, value, onChange }: {
  options: { val: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.val} type="button" onClick={() => onChange(o.val)}
          style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s', border: '1px solid',
            background: value === o.val ? 'rgba(79,70,229,0.2)' : 'rgba(255,255,255,0.04)',
            borderColor: value === o.val ? 'rgba(79,70,229,0.5)' : C.border,
            color: value === o.val ? '#A5B4FC' : C.textSecondary,
          }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [processingPayment, setProcessingPayment] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [yoe, setYoe] = useState('');
  const [dor, setDor] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  const [stationName, setStationName] = useState('');
  const [stateName, setStateName] = useState('');
  const [category, setCategory] = useState<StationCategory>('cotm');
  const [wofbiClass, setWofbiClass] = useState<WofbiClass>('none');
  const [facilityType, setFacilityType] = useState('');
  const [mainHallCap, setMainHallCap] = useState('');
  const [mainHallChairs, setMainHallChairs] = useState('');
  const [overflowCap, setOverflowCap] = useState('');
  const [overflowChairs, setOverflowChairs] = useState('');
  const [youthHallCap, setYouthHallCap] = useState('');
  const [youthHallChairs, setYouthHallChairs] = useState('');
  const [childrenHallCap, setChildrenHallCap] = useState('');
  const [childrenHallChairs, setChildrenHallChairs] = useState('');
  const [savingStation, setSavingStation] = useState(false);

  // ── parent station ────────────────────────────────────────
  const [parentStationId, setParentStationId] = useState<string>('');

  // All stations for the parent selector (exclude own station)
  const { data: allStations } = useQuery({
    queryKey: ['all-stations-for-parent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stations')
        .select('id, name, level, state_name')
        .order('name');
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.id !== user?.station_id);
    },
    enabled: !!user?.station_id && user?.role !== 'delegate',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  useEffect(() => {
    if (!paystackPublicKey) { setPaystackReady(true); return; }
    if (window.PaystackPop) { setPaystackReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://js.paystack.co/v1/inline.js';
    s.async = true;
    s.onload = () => setPaystackReady(true);
    s.onerror = () => setErrorMsg('Failed to load payment provider. Please check your connection and refresh.');
    document.head.appendChild(s);
    // Timeout fallback — if script hasn't loaded in 10s, show an error
    const timeout = setTimeout(() => {
      if (!window.PaystackPop) {
        setErrorMsg('Payment provider is taking too long to load. Please check your connection and try again.');
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [paystackPublicKey]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? '');
    setPhoneNumber(user.phone_number ?? '');
    setStaffId(user.staff_id ?? '');
    setYoe((user as any).yoe ?? '');
    setDor((user as any).dor ?? '');
  }, [user]);

  useEffect(() => {
    if (!user?.station_id) return;
    supabase.from('stations').select('*, parent_station_id').eq('id', user.station_id).single().then(({ data }) => {
      if (!data) return;
      setStationName(data.name ?? '');
      setStateName(data.state_name ?? '');
      setCategory((data.category as StationCategory) ?? 'cotm');
      setWofbiClass((data.wofbi_class as WofbiClass) ?? 'none');
      setParentStationId(data.parent_station_id ?? '');
      const fd: FacilityDetails = data.facility_details ?? {};
      setFacilityType(fd.facility_type ?? '');
      setMainHallCap(fd.main_hall_capacity?.toString() ?? '');
      setMainHallChairs(fd.main_hall_chairs?.toString() ?? '');
      setOverflowCap(fd.overflow_capacity?.toString() ?? '');
      setOverflowChairs(fd.overflow_chairs?.toString() ?? '');
      setYouthHallCap(fd.youth_hall_capacity?.toString() ?? '');
      setYouthHallChairs(fd.youth_hall_chairs?.toString() ?? '');
      setChildrenHallCap(fd.children_hall_capacity?.toString() ?? '');
      setChildrenHallChairs(fd.children_hall_chairs?.toString() ?? '');
    });
  }, [user?.station_id]);

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 4000); };

  const handleSavePersonal = async () => {
    if (!user) return;
    setSavingPersonal(true); setErrorMsg(null);
    try {
      const { error } = await supabase.from('users')
        .update({ full_name: fullName, phone_number: phoneNumber || null, staff_id: staffId || null, yoe: yoe || null, dor: dor || null })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      showSuccess('Personal details updated.');
    } catch (err: any) { setErrorMsg(err.message || 'Failed to save.'); }
    finally { setSavingPersonal(false); }
  };

  const handleSaveStation = async () => {
    if (!user?.station_id) return;
    setSavingStation(true); setErrorMsg(null);
    try {
      const facilityDetails: FacilityDetails = {
        facility_type: facilityType || null,
        main_hall_capacity: mainHallCap ? Number(mainHallCap) : null,
        main_hall_chairs: mainHallChairs ? Number(mainHallChairs) : null,
        overflow_capacity: overflowCap ? Number(overflowCap) : null,
        overflow_chairs: overflowChairs ? Number(overflowChairs) : null,
        youth_hall_capacity: youthHallCap ? Number(youthHallCap) : null,
        youth_hall_chairs: youthHallChairs ? Number(youthHallChairs) : null,
        children_hall_capacity: childrenHallCap ? Number(childrenHallCap) : null,
        children_hall_chairs: childrenHallChairs ? Number(childrenHallChairs) : null,
      };
      const { error } = await supabase.from('stations')
        .update({ name: stationName, state_name: stateName, category, wofbi_class: wofbiClass, facility_details: facilityDetails, parent_station_id: parentStationId || null })
        .eq('id', user.station_id);
      if (error) throw error;
      showSuccess('Station profile updated.');
    } catch (err: any) { setErrorMsg(err.message || 'Failed to save.'); }
    finally { setSavingStation(false); }
  };

  const activateSubscription = async (reference: string) => {
    const { error } = await supabase.from('users').update({ subscription_status: 'active' }).eq('id', user!.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    showSuccess(`Subscription activated! Ref: ${reference}`);
    setTimeout(() => window.location.reload(), 2000);
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setErrorMsg(null);
    if (!paystackPublicKey) {
      setProcessingPayment(true);
      try { await activateSubscription('TEST_' + Date.now()); }
      catch (err: any) { setErrorMsg(err.message); }
      finally { setProcessingPayment(false); }
      return;
    }
    if (!window.PaystackPop || !paystackReady) { setErrorMsg('Payment provider not ready.'); return; }
    setProcessingPayment(true);
    let email = '';
    try {
      const { data: { user: au } } = await supabase.auth.getUser();
      email = au?.email ?? '';
      if (!email) throw new Error('Could not determine account email.');
    } catch (err: any) { setErrorMsg(err.message); setProcessingPayment(false); return; }
    window.PaystackPop.setup({
      key: paystackPublicKey, email, amount: SUBSCRIPTION_AMOUNT_KOBO, currency: 'NGN',
      ref: `lfc_${user.id}_${Date.now()}`,
      metadata: { user_id: user.id, station_id: user.station_id },
      callback: async (res: { reference: string }) => {
        try { await activateSubscription(res.reference); }
        catch (err: any) { setErrorMsg('Payment received but activation failed. Ref: ' + res.reference); }
        finally { setProcessingPayment(false); }
      },
      onClose: () => setProcessingPayment(false),
    }).openIframe();
  };

  // ── shared save button ────────────────────────────────────
  const SaveBtn = ({ onClick, saving, label: lbl }: { onClick: () => void; saving: boolean; label: string }) => (
    <button onClick={onClick} disabled={saving}
      style={{ marginTop: 20, height: 42, padding: '0 24px', background: C.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, transition: 'all 0.15s' }}>
      {saving ? 'Saving…' : lbl}
    </button>
  );

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginTop: 16 }}>
      {children}
    </div>
  );

  const Field = ({ lbl, children }: { lbl: string; children: React.ReactNode }) => (
    <div><span style={fieldLabel}>{lbl}</span>{children}</div>
  );

  const subStatus = user?.subscription_status;
  const subBadgeColor = subStatus === 'active' ? '#4ADE80' : subStatus === 'trial' ? '#FDE68A' : '#FCA5A5';
  const subBadgeBg = subStatus === 'active' ? 'rgba(34,197,94,0.12)' : subStatus === 'trial' ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)';

  return (
    <div style={pageStyle}>
      {/* ambient glow */}
      <div style={{ position: 'fixed', top: 0, right: 0, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.06) 0%, transparent 70%)', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header style={{ ...glassHeader, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center' }}>
          <button onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => (e.currentTarget.style.color = C.textPrimary)}
            onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
            ← Dashboard
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 24px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ color: C.textPrimary, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>Manage your profile, station and subscription</p>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', color: '#FCA5A5', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontSize: 16, lineHeight: 1, marginLeft: 12 }}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ADE80', fontSize: 13 }}>
            {successMsg}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Personal Details ─────────────────────── */}
          <Section title="Personal Details" defaultOpen>
            <Row>
              <Field lbl="Full Name"><input style={inp} type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" /></Field>
              <Field lbl="Phone Number"><input style={inp} type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="08012345678" /></Field>
              <Field lbl="Staff ID"><input style={inp} type="text" value={staffId} onChange={e => setStaffId(e.target.value)} placeholder="Optional" /></Field>
              <Field lbl="Role">
                <div style={{ height: 42, display: 'flex', alignItems: 'center' }}>
                  <span style={{ color: C.textPrimary, fontSize: 14, textTransform: 'capitalize' }}>{user?.role ?? '—'}</span>
                </div>
              </Field>
              <Field lbl="Year of Entry (YOE)"><input style={inp} type="text" value={yoe} onChange={e => setYoe(e.target.value)} placeholder="DD/MM/YYYY" /></Field>
              <Field lbl="Date of Resumption (DOR)"><input style={inp} type="text" value={dor} onChange={e => setDor(e.target.value)} placeholder="DD/MM/YYYY" /></Field>
            </Row>
            <SaveBtn onClick={handleSavePersonal} saving={savingPersonal} label="Save Personal Details" />
          </Section>

          {/* ── Station Profile ──────────────────────── */}
          {user?.role !== 'delegate' && (
            <Section title="Station Profile">
              <Row>
                <Field lbl="Station Name"><input style={inp} type="text" value={stationName} onChange={e => setStationName(e.target.value)} /></Field>
                <Field lbl="State"><input style={inp} type="text" value={stateName} onChange={e => setStateName(e.target.value)} /></Field>
              </Row>
              <div style={{ marginTop: 20 }}>
                <span style={fieldLabel}>Station Category</span>
                <Pill
                  options={[{ val: 'mainline', label: 'Mainline' }, { val: 'cotm', label: 'COTM' }, { val: 'cpm', label: 'CPM' }]}
                  value={category} onChange={v => setCategory(v as StationCategory)}
                />
              </div>
              <div style={{ marginTop: 20 }}>
                <span style={fieldLabel}>WOFBI Class</span>
                <Pill
                  options={[{ val: 'none', label: 'None' }, { val: 'bcc', label: 'BCC' }, { val: 'lcc', label: 'LCC' }, { val: 'ldc', label: 'LDC' }]}
                  value={wofbiClass} onChange={v => setWofbiClass(v as WofbiClass)}
                />
              </div>
              <div style={{ marginTop: 20 }}>
                <span style={fieldLabel}>Supervisor Station (parent)</span>
                <p style={{ color: C.textMuted, fontSize: 12, marginBottom: 8 }}>
                  Link your station under a supervisor's station so they can see your entries.
                </p>
                <select
                  value={parentStationId}
                  onChange={e => setParentStationId(e.target.value)}
                  style={{ ...inp, height: 44 }}
                >
                  <option value="">— None (root station) —</option>
                  {(allStations ?? []).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.state_name ? ` · ${s.state_name}` : ''} ({s.level})
                    </option>
                  ))}
                </select>
              </div>
              <SaveBtn onClick={handleSaveStation} saving={savingStation} label="Save Station Profile" />
            </Section>
          )}

          {/* ── Facility Details ─────────────────────── */}
          {user?.role !== 'delegate' && (
            <Section title="Facility Details">
              <p style={{ color: C.textMuted, fontSize: 13, marginTop: 16 }}>These values appear on generated Excel reports. Update whenever your facility changes.</p>
              <div style={{ marginTop: 16 }}>
                <Field lbl="Facility Type"><input style={inp} type="text" value={facilityType} onChange={e => setFacilityType(e.target.value)} placeholder="e.g. TEMPORARY, PERMANENT, RENTED" /></Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginTop: 16 }}>
                {[
                  { lbl: 'Main Hall Cap.', val: mainHallCap, set: setMainHallCap },
                  { lbl: 'Main Hall Chairs', val: mainHallChairs, set: setMainHallChairs },
                  { lbl: 'Overflow Cap.', val: overflowCap, set: setOverflowCap },
                  { lbl: 'Overflow Chairs', val: overflowChairs, set: setOverflowChairs },
                  { lbl: 'Youth Hall Cap.', val: youthHallCap, set: setYouthHallCap },
                  { lbl: 'Youth Chairs', val: youthHallChairs, set: setYouthHallChairs },
                  { lbl: 'Children Cap.', val: childrenHallCap, set: setChildrenHallCap },
                  { lbl: 'Children Chairs', val: childrenHallChairs, set: setChildrenHallChairs },
                ].map(({ lbl, val, set }) => (
                  <Field key={lbl} lbl={lbl}>
                    <input style={inp} type="number" min="0" value={val} onChange={e => set(e.target.value)} placeholder="0" />
                  </Field>
                ))}
              </div>
              <SaveBtn onClick={handleSaveStation} saving={savingStation} label="Save Facility Details" />
            </Section>
          )}

          {/* ── Subscription ─────────────────────────── */}
          <Section title="Subscription">
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: C.textMuted, fontSize: 13 }}>Status</span>
                <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: subBadgeBg, color: subBadgeColor, border: `1px solid ${subBadgeColor}30` }}>
                  {subStatus ? subStatus.charAt(0).toUpperCase() + subStatus.slice(1) : '—'}
                </span>
              </div>
              {subStatus === 'trial' && user?.trial_ends_at && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                  <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Trial ends</p>
                  <p style={{ color: C.textPrimary, fontSize: 14 }}>{formatDate(user.trial_ends_at)}</p>
                </div>
              )}
              {(subStatus === 'trial' || subStatus === 'expired') && (
                <div style={{ padding: '16px', borderRadius: 10, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)' }}>
                  <p style={{ color: C.textPrimary, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Monthly Subscription</p>
                  <p style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>
                    {paystackPublicKey ? '₦5,000 / month — secure payment via Paystack' : 'Dev mode — payment will be simulated'}
                  </p>
                  <button onClick={handleUpgrade} disabled={processingPayment || !paystackReady}
                    style={{ height: 42, padding: '0 24px', background: C.accent, border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (processingPayment || !paystackReady) ? 0.6 : 1 }}>
                    {processingPayment ? 'Processing…' : !paystackReady ? 'Loading…' : 'Upgrade Subscription'}
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* ── Sign Out ─────────────────────────────── */}
          <div style={{ ...glassCard, padding: '20px 24px' }}>
            <button onClick={signOut}
              style={{ width: '100%', height: 42, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, color: '#FCA5A5', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}>
              Sign Out
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
