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
    <div className="flex items-center gap-2 mb-8">
      {PASTOR_STEPS.filter(s => steps.includes(s)).map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
            ${i < idx ? 'bg-indigo-600 text-white' : i === idx ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400' : 'bg-gray-100 text-gray-400'}`}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < PASTOR_STEPS.filter(s2 => steps.includes(s2)).length - 1 && (
            <div className={`h-0.5 w-8 ${i < idx ? 'bg-indigo-400' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="card p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Complete Your Profile</h1>
            <p className="text-sm text-gray-500 mt-1">LFC Reporting Hub setup</p>
          </div>

          {step !== 'saving' && (
            <StepIndicator current={step} steps={activeSteps} />
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* ── STEP: role ─────────────────────────────── */}
          {step === 'role' && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-gray-900">Are you a pastor or a delegate?</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { val: false, label: 'Pastor', desc: 'Setting up a new station' },
                  { val: true, label: 'Delegate', desc: 'Joining an existing station' },
                ].map(({ val, label, desc }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setIsDelegate(val)}
                    className={`card p-4 text-left transition-colors ${isDelegate === val
                      ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50'
                      : 'hover:bg-gray-50'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 mt-1">{desc}</p>
                  </button>
                ))}
              </div>

              {isDelegate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    6-digit pairing code from your pastor
                  </label>
                  <input
                    type="text"
                    value={pairingCode}
                    onChange={e => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="input text-center text-2xl tracking-widest font-mono"
                    maxLength={6}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── STEP: personal ─────────────────────────── */}
          {step === 'personal' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Your details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  className="input" placeholder="e.g. Pastor John Doe" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)}
                  className="input" placeholder="e.g. 08012345678" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff ID</label>
                  <input type="text" value={staffId} onChange={e => setStaffId(e.target.value)}
                    className="input" placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Year of Entry (YOE)
                    <span className="ml-1 text-xs font-normal text-gray-400">e.g. 11/01/2012</span>
                  </label>
                  <input type="text" value={yoe} onChange={e => setYoe(e.target.value)}
                    className="input" placeholder="DD/MM/YYYY" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Resumption (DOR)
                    <span className="ml-1 text-xs font-normal text-gray-400">e.g. 21/09/2025</span>
                  </label>
                  <input type="text" value={dor} onChange={e => setDor(e.target.value)}
                    className="input" placeholder="DD/MM/YYYY" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: station ──────────────────────────── */}
          {step === 'station' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900">Station details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Station Name *</label>
                <input type="text" value={stationName} onChange={e => setStationName(e.target.value)}
                  className="input" placeholder="e.g. Piwoyi" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" value={stateName} onChange={e => setStateName(e.target.value)}
                  className="input" placeholder="e.g. FCT" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Station Category *</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { val: 'mainline', label: 'Mainline', desc: 'Established church' },
                    { val: 'cotm', label: 'COTM', desc: '5,000 churches' },
                    { val: 'cpm', label: 'CPM', desc: '10,000 churches' },
                  ] as const).map(({ val, label, desc }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setCategory(val)}
                      className={`card p-3 text-left transition-colors ${category === val
                        ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50'
                        : 'hover:bg-gray-50'}`}
                    >
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: facility ─────────────────────────── */}
          {step === 'facility' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Facility details</h2>
                <p className="text-sm text-gray-500 mt-1">These are fixed details about your church building. You can update them later in Settings.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facility Type</label>
                <input type="text" value={facilityType} onChange={e => setFacilityType(e.target.value)}
                  className="input" placeholder="e.g. TEMPORARY, PERMANENT, RENTED" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Main Hall Capacity', val: mainHallCap, set: setMainHallCap },
                  { label: 'Main Hall Chairs', val: mainHallChairs, set: setMainHallChairs },
                  { label: 'Overflow Capacity', val: overflowCap, set: setOverflowCap },
                  { label: 'Overflow Chairs', val: overflowChairs, set: setOverflowChairs },
                  { label: 'Youth Hall Capacity', val: youthHallCap, set: setYouthHallCap },
                  { label: 'Youth Hall Chairs', val: youthHallChairs, set: setYouthHallChairs },
                  { label: 'Children Capacity', val: childrenHallCap, set: setChildrenHallCap },
                  { label: 'Children Chairs', val: childrenHallChairs, set: setChildrenHallChairs },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
                      className="input" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: wofbi ────────────────────────────── */}
          {step === 'wofbi' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">WOFBI (Bible School)</h2>
                <p className="text-sm text-gray-500 mt-1">Does your station run a Word of Faith Bible Institute class?</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { val: 'none', label: 'None', desc: 'No WOFBI class' },
                  { val: 'bcc', label: 'BCC', desc: 'Basic Christian Course' },
                  { val: 'lcc', label: 'LCC', desc: 'Leadership Christian Course' },
                  { val: 'ldc', label: 'LDC', desc: 'Leadership Development Course' },
                ] as const).map(({ val, label, desc }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setWofbiClass(val)}
                    className={`card p-3 text-left transition-colors ${wofbiClass === val
                      ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50'
                      : 'hover:bg-gray-50'}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: saving ───────────────────────────── */}
          {step === 'saving' && (
            <div className="py-8 text-center">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-gray-600">Setting up your account…</p>
            </div>
          )}

          {/* ── Navigation buttons ──────────────────────── */}
          {step !== 'saving' && (
            <div className="flex gap-3 mt-8">
              {activeSteps.indexOf(step) > 0 && (
                <button type="button" onClick={back} className="btn btn-secondary flex-1">
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={next}
                disabled={!canProceed() || loading}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Saving…' : isLastStep ? 'Complete Setup' : 'Continue'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
