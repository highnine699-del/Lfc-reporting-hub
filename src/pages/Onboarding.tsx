import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { StationCategory, WofbiClass } from '../types';

type Step = 'role' | 'personal' | 'station' | 'facility' | 'wofbi' | 'saving';

const PASTOR_STEPS: Step[] = ['role', 'personal', 'station', 'facility', 'wofbi'];

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
      {PASTOR_STEPS.filter(s => steps.includes(s)).map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            background: i < idx ? '#4F46E5' : i === idx ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.06)',
            color: i < idx ? '#fff' : i === idx ? '#A5B4FC' : '#6B7280',
            border: i === idx ? '2px solid rgba(79,70,229,0.5)' : '2px solid transparent',
            transition: 'all 0.2s',
          }}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < PASTOR_STEPS.filter(s2 => steps.includes(s2)).length - 1 && (
            <div style={{
              height: 2, width: 28, flexShrink: 0,
              background: i < idx ? '#4F46E5' : 'rgba(255,255,255,0.08)',
              borderRadius: 2, transition: 'background 0.2s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared inline styles for Onboarding form fields ─────────
const OL: React.CSSProperties = {
  display: 'block', color: '#9CA3AF', fontSize: 11, fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
};
const OI: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 10, padding: '0 12px',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.11)',
  color: '#F5F7FA', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};

export default function Onboarding() {
  const { authUser } = useAuth();
  const navigate = useNavigate();

  // ── Role ─────────────────────────────────────────────────────
  const [isDelegate, setIsDelegate] = useState(false);
  const [pairingCode, setPairingCode] = useState('');

  // ── Personal ─────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [yoe, setYoe] = useState('');
  const [dor, setDor] = useState('');

  // ── Station ──────────────────────────────────────────────────
  const [stationName, setStationName] = useState('');
  const [stateName, setStateName] = useState('');
  const [category, setCategory] = useState<StationCategory>('cotm');

  // ── Facility ─────────────────────────────────────────────────
  const [facilityType, setFacilityType] = useState('');
  const [mainHallCap, setMainHallCap] = useState('');
  const [mainHallChairs, setMainHallChairs] = useState('');
  const [overflowCap, setOverflowCap] = useState('');
  const [overflowChairs, setOverflowChairs] = useState('');
  const [youthHallCap, setYouthHallCap] = useState('');
  const [youthHallChairs, setYouthHallChairs] = useState('');
  const [childrenHallCap, setChildrenHallCap] = useState('');
  const [childrenHallChairs, setChildrenHallChairs] = useState('');

  // ── WOFBI ────────────────────────────────────────────────────
  const [wofbiClass, setWofbiClass] = useState<WofbiClass>('none');

  // ── UI state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('role');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pastorSteps: Step[] = ['role', 'personal', 'station', 'facility', 'wofbi'];
  const delegateSteps: Step[] = ['role', 'personal'];

  const activeSteps = isDelegate ? delegateSteps : pastorSteps;

  const next = () => {
    setErrorMsg(null);
    const idx = activeSteps.indexOf(step);
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
    else handleSubmit();
  };

  const back = () => {
    setErrorMsg(null);
    const idx = activeSteps.indexOf(step);
    if (idx > 0) setStep(activeSteps[idx - 1]);
  };

  // ── Validation per step ──────────────────────────────────────
  const canProceed = (): boolean => {
    switch (step) {
      case 'role':
        return isDelegate ? pairingCode.length === 6 : true;
      case 'personal':
        return fullName.trim().length > 0;
      case 'station':
        return stationName.trim().length > 0 && stateName.trim().length > 0;
      case 'facility':
        return true; // all optional
      case 'wofbi':
        return true;
      default:
        return true;
    }
  };

  // ── Final submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!authUser) return;
    setLoading(true);
    setStep('saving');
    setErrorMsg(null);

    try {
      // Guard: already onboarded
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existing) { navigate('/dashboard'); return; }

      if (isDelegate) {
        // ── Delegate flow ────────────────────────────────────
        const { data: pairing, error: pe } = await supabase
          .from('delegate_pairing_codes')
          .select('*')
          .eq('code', pairingCode)
          .eq('used', false)
          .maybeSingle();

        if (pe) throw pe;
        if (!pairing) throw new Error('Invalid or expired pairing code. Ask your pastor for a new one.');
        if (new Date(pairing.expires_at) < new Date())
          throw new Error('This pairing code has expired. Ask your pastor to generate a new one.');

        const { data: pastor, error: pastorErr } = await supabase
          .from('users')
          .select('station_id')
          .eq('id', pairing.pastor_id)
          .maybeSingle();

        if (pastorErr) throw pastorErr;
        if (!pastor?.station_id) throw new Error('Could not find the pastor\'s station.');

        const { error: insertErr } = await supabase.from('users').insert({
          id: authUser.id,
          full_name: fullName,
          phone_number: phoneNumber || null,
          staff_id: staffId || null,
          yoe: yoe || null,
          dor: dor || null,
          role: 'delegate',
          linked_pastor_id: pairing.pastor_id,
          station_id: pastor.station_id,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (insertErr) throw insertErr;

        await supabase
          .from('delegate_pairing_codes')
          .update({ used: true })
          .eq('id', pairing.id);

      } else {
        // ── Pastor flow ──────────────────────────────────────
        const facilityDetails = {
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

        const { data: station, error: stationErr } = await supabase
          .from('stations')
          .insert({
            name: stationName,
            state_name: stateName,
            level: 'community',
            category,
            facility_details: facilityDetails,
            wofbi_class: wofbiClass,
          })
          .select()
          .single();

        if (stationErr) throw stationErr;

        const { error: userErr } = await supabase.from('users').insert({
          id: authUser.id,
          full_name: fullName,
          phone_number: phoneNumber || null,
          staff_id: staffId || null,
          yoe: yoe || null,
          dor: dor || null,
          role: 'pastor',
          station_id: station.id,
          subscription_status: 'trial',
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (userErr) throw userErr;
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setErrorMsg(err.message || 'Failed to complete onboarding. Please try again.');
      // Go back to last real step so the user can fix things
      setStep(activeSteps[activeSteps.length - 1]);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  const isLastStep = activeSteps.indexOf(step) === activeSteps.length - 1;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080A0F', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        <div style={{ background: 'rgba(18,21,28,0.85)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: 20, padding: '32px 28px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>

          {/* Logo / Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ color: '#F5F7FA', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>Complete Your Profile</h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>LFC Reporting Hub setup</p>
          </div>

          {step !== 'saving' && (
            <StepIndicator current={step} steps={activeSteps} />
          )}

          {errorMsg && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#FCA5A5', fontSize: 13 }}>
              {errorMsg}
            </div>
          )}

          {/* ── STEP: role ─────────────────────────────── */}
          {step === 'role' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h2 style={{ color: '#F5F7FA', fontSize: 15, fontWeight: 600 }}>Are you a pastor or a delegate?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { val: false, label: 'Pastor', desc: 'Setting up a new station' },
                  { val: true, label: 'Delegate', desc: 'Joining an existing station' },
                ].map(({ val, label, desc }) => (
                  <button key={label} type="button" onClick={() => setIsDelegate(val)}
                    style={{
                      padding: '14px 16px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                      background: isDelegate === val ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)',
                      border: isDelegate === val ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      transition: 'all 0.15s',
                    }}>
                    <p style={{ color: '#F5F7FA', fontSize: 14, fontWeight: 600 }}>{label}</p>
                    <p style={{ color: '#6B7280', fontSize: 12, marginTop: 3 }}>{desc}</p>
                  </button>
                ))}
              </div>
              {isDelegate && (
                <div>
                  <label style={{ display: 'block', color: '#9CA3AF', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    6-digit pairing code from your pastor
                  </label>
                  <input type="text" value={pairingCode}
                    onChange={e => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000" maxLength={6}
                    style={{ width: '100%', height: 52, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.11)', color: '#F5F7FA', fontSize: 28, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center', letterSpacing: '0.3em', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: personal ─────────────────────────── */}
          {step === 'personal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ color: '#F5F7FA', fontSize: 15, fontWeight: 600 }}>Your details</h2>
              {[
                { lbl: 'Full Name *', val: fullName, set: setFullName, type: 'text', ph: 'e.g. Pastor John Doe' },
                { lbl: 'Phone Number', val: phoneNumber, set: setPhoneNumber, type: 'tel', ph: '08012345678' },
              ].map(({ lbl, val, set, type, ph }) => (
                <div key={lbl}>
                  <label style={OL}>{lbl}</label>
                  <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph} style={OI} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={OL}>Staff ID</label><input type="text" value={staffId} onChange={e => setStaffId(e.target.value)} placeholder="Optional" style={OI} /></div>
                <div />
                <div><label style={OL}>Year of Entry (YOE)</label><input type="text" value={yoe} onChange={e => setYoe(e.target.value)} placeholder="DD/MM/YYYY" style={OI} /></div>
                <div><label style={OL}>Date of Resumption (DOR)</label><input type="text" value={dor} onChange={e => setDor(e.target.value)} placeholder="DD/MM/YYYY" style={OI} /></div>
              </div>
            </div>
          )}

          {/* ── STEP: station ──────────────────────────── */}
          {step === 'station' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <h2 style={{ color: '#F5F7FA', fontSize: 15, fontWeight: 600 }}>Station details</h2>
              <div><label style={OL}>Station Name *</label><input type="text" value={stationName} onChange={e => setStationName(e.target.value)} placeholder="e.g. Piwoyi" style={OI} /></div>
              <div><label style={OL}>State *</label><input type="text" value={stateName} onChange={e => setStateName(e.target.value)} placeholder="e.g. FCT" style={OI} /></div>
              <div>
                <label style={OL}>Station Category *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {([{ val: 'mainline', label: 'Mainline', desc: 'Established' }, { val: 'cotm', label: 'COTM', desc: '5,000 prog.' }, { val: 'cpm', label: 'CPM', desc: '10,000 prog.' }] as const).map(({ val, label, desc }) => (
                    <button key={val} type="button" onClick={() => setCategory(val)}
                      style={{ padding: '10px 8px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', background: category === val ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)', border: category === val ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s' }}>
                      <p style={{ color: '#F5F7FA', fontSize: 13, fontWeight: 600 }}>{label}</p>
                      <p style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: facility ─────────────────────────── */}
          {step === 'facility' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={{ color: '#F5F7FA', fontSize: 15, fontWeight: 600 }}>Facility details</h2>
                <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Fixed details about your church building. Update later in Settings.</p>
              </div>
              <div><label style={OL}>Facility Type</label><input type="text" value={facilityType} onChange={e => setFacilityType(e.target.value)} placeholder="e.g. TEMPORARY, PERMANENT, RENTED" style={OI} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { l: 'Main Hall Capacity', v: mainHallCap, s: setMainHallCap },
                  { l: 'Main Hall Chairs', v: mainHallChairs, s: setMainHallChairs },
                  { l: 'Overflow Capacity', v: overflowCap, s: setOverflowCap },
                  { l: 'Overflow Chairs', v: overflowChairs, s: setOverflowChairs },
                  { l: 'Youth Hall Capacity', v: youthHallCap, s: setYouthHallCap },
                  { l: 'Youth Hall Chairs', v: youthHallChairs, s: setYouthHallChairs },
                  { l: 'Children Capacity', v: childrenHallCap, s: setChildrenHallCap },
                  { l: 'Children Chairs', v: childrenHallChairs, s: setChildrenHallChairs },
                ].map(({ l, v, s }) => (
                  <div key={l}><label style={OL}>{l}</label><input type="number" min="0" value={v} onChange={e => s(e.target.value)} placeholder="0" style={OI} /></div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: wofbi ────────────────────────────── */}
          {step === 'wofbi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h2 style={{ color: '#F5F7FA', fontSize: 15, fontWeight: 600 }}>WOFBI (Bible School)</h2>
                <p style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>Does your station run a Word of Faith Bible Institute class?</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {([{ val: 'none', label: 'None', desc: 'No WOFBI class' }, { val: 'bcc', label: 'BCC', desc: 'Basic Christian Course' }, { val: 'lcc', label: 'LCC', desc: 'Leadership Christian Course' }, { val: 'ldc', label: 'LDC', desc: 'Leadership Dev. Course' }] as const).map(({ val, label, desc }) => (
                  <button key={val} type="button" onClick={() => setWofbiClass(val)}
                    style={{ padding: '12px 14px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', background: wofbiClass === val ? 'rgba(79,70,229,0.15)' : 'rgba(255,255,255,0.04)', border: wofbiClass === val ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.1)', transition: 'all 0.15s' }}>
                    <p style={{ color: '#F5F7FA', fontSize: 14, fontWeight: 600 }}>{label}</p>
                    <p style={{ color: '#6B7280', fontSize: 12, marginTop: 3 }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: saving ───────────────────────────── */}
          {step === 'saving' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(79,70,229,0.2)', borderTopColor: '#4F46E5', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <p style={{ color: '#9CA3AF', fontSize: 14 }}>Setting up your account…</p>
            </div>
          )}

          {/* ── Navigation buttons ──────────────────────── */}
          {step !== 'saving' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              {activeSteps.indexOf(step) > 0 && (
                <button type="button" onClick={back}
                  style={{ flex: 1, height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.11)', color: '#9CA3AF', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                  Back
                </button>
              )}
              <button type="button" onClick={next} disabled={!canProceed() || loading}
                style={{ flex: 1, height: 46, borderRadius: 12, background: (!canProceed() || loading) ? 'rgba(79,70,229,0.4)' : '#4F46E5', border: 'none', color: '#fff', fontSize: 15, fontWeight: 600, cursor: (!canProceed() || loading) ? 'not-allowed' : 'pointer', transition: 'all 0.15s' }}>
                {loading ? 'Saving…' : isLastStep ? 'Complete Setup' : 'Continue'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
