import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/format';
import type { StationCategory, WofbiClass, FacilityDetails } from '../types';

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackOptions) => { openIframe: () => void };
    };
  }
}
interface PaystackOptions {
  key: string; email: string; amount: number; currency: string; ref: string;
  metadata?: Record<string, any>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
}

const SUBSCRIPTION_AMOUNT_KOBO = 500_000;

// ── small collapsible section ────────────────────────────────
function Section({ title, children, defaultOpen = false }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        <svg className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── payment ───────────────────────────────────────────────
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paystackReady, setPaystackReady] = useState(false);

  // ── pastor personal fields ────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [yoe, setYoe] = useState('');
  const [dor, setDor] = useState('');
  const [savingPersonal, setSavingPersonal] = useState(false);

  // ── station profile fields ────────────────────────────────
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

  // ── feedback ──────────────────────────────────────────────
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string | undefined;

  // Load Paystack script
  useEffect(() => {
    if (!paystackPublicKey) { setPaystackReady(true); return; }
    if (window.PaystackPop) { setPaystackReady(true); return; }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setPaystackReady(true);
    script.onerror = () => setErrorMsg('Failed to load payment provider. Check your internet connection.');
    document.head.appendChild(script);
  }, [paystackPublicKey]);

  // Pre-fill personal fields from profile
  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? '');
    setPhoneNumber(user.phone_number ?? '');
    setStaffId(user.staff_id ?? '');
    setYoe(user.yoe ?? '');
    setDor(user.dor ?? '');
  }, [user]);

  // Pre-fill station fields
  useEffect(() => {
    if (!user?.station_id) return;
    supabase
      .from('stations')
      .select('*')
      .eq('id', user.station_id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setStationName(data.name ?? '');
        setStateName(data.state_name ?? '');
        setCategory((data.category as StationCategory) ?? 'cotm');
        setWofbiClass((data.wofbi_class as WofbiClass) ?? 'none');
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

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // ── save personal info ────────────────────────────────────
  const handleSavePersonal = async () => {
    if (!user) return;
    setSavingPersonal(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName, phone_number: phoneNumber || null, staff_id: staffId || null, yoe: yoe || null, dor: dor || null })
        .eq('id', user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      showSuccess('Personal details updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save personal details.');
    } finally {
      setSavingPersonal(false);
    }
  };

  // ── save station profile ──────────────────────────────────
  const handleSaveStation = async () => {
    if (!user?.station_id) return;
    setSavingStation(true);
    setErrorMsg(null);
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
      const { error } = await supabase
        .from('stations')
        .update({ name: stationName, state_name: stateName, category, wofbi_class: wofbiClass, facility_details: facilityDetails })
        .eq('id', user.station_id);
      if (error) throw error;
      showSuccess('Station profile updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save station profile.');
    } finally {
      setSavingStation(false);
    }
  };

  // ── subscription ──────────────────────────────────────────
  const activateSubscription = async (reference: string) => {
    const { error } = await supabase.from('users').update({ subscription_status: 'active' }).eq('id', user!.id);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    showSuccess(`Subscription activated! Reference: ${reference}`);
    setTimeout(() => window.location.reload(), 2000);
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setErrorMsg(null);
    if (!paystackPublicKey) {
      setProcessingPayment(true);
      try { await activateSubscription('TEST_' + Date.now()); }
      catch (err: any) { setErrorMsg(err.message || 'Failed to activate subscription.'); }
      finally { setProcessingPayment(false); }
      return;
    }
    if (!window.PaystackPop || !paystackReady) {
      setErrorMsg('Payment provider not ready. Please try again in a moment.'); return;
    }
    setProcessingPayment(true);
    let email = '';
    try {
      const { data: { user: au } } = await supabase.auth.getUser();
      email = au?.email ?? '';
      if (!email) throw new Error('Could not determine account email.');
    } catch (err: any) { setErrorMsg(err.message); setProcessingPayment(false); return; }

    const reference = `lfc_${user.id}_${Date.now()}`;
    window.PaystackPop.setup({
      key: paystackPublicKey, email, amount: SUBSCRIPTION_AMOUNT_KOBO, currency: 'NGN',
      ref: reference, metadata: { user_id: user.id, station_id: user.station_id },
      callback: async (response) => {
        try { await activateSubscription(response.reference); }
        catch (err: any) { setErrorMsg('Payment received but activation failed. Contact support with ref: ' + response.reference); }
        finally { setProcessingPayment(false); }
      },
      onClose: () => { setProcessingPayment(false); },
    }).openIframe();
  };

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
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your profile, station, and subscription</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex justify-between items-start">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="ml-3 text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{successMsg}</div>
        )}

        <div className="space-y-4">

          {/* ── Personal details ──────────────────────── */}
          <Section title="Personal Details" defaultOpen>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Staff ID</label>
                  <input type="text" value={staffId} onChange={e => setStaffId(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                  <p className="text-sm text-gray-900 capitalize pt-2.5">{user?.role}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Year of Entry (YOE)</label>
                  <input type="text" value={yoe} onChange={e => setYoe(e.target.value)} className="input" placeholder="DD/MM/YYYY" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date of Resumption (DOR)</label>
                  <input type="text" value={dor} onChange={e => setDor(e.target.value)} className="input" placeholder="DD/MM/YYYY" />
                </div>
              </div>
              <button onClick={handleSavePersonal} disabled={savingPersonal} className="btn btn-primary text-sm">
                {savingPersonal ? 'Saving…' : 'Save Personal Details'}
              </button>
            </div>
          </Section>

          {/* ── Station profile ───────────────────────── */}
          {user?.role !== 'delegate' && (
            <Section title="Station Profile">
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Station Name</label>
                    <input type="text" value={stationName} onChange={e => setStationName(e.target.value)} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                    <input type="text" value={stateName} onChange={e => setStateName(e.target.value)} className="input" />
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Station Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { val: 'mainline', label: 'Mainline' },
                      { val: 'cotm', label: 'COTM' },
                      { val: 'cpm', label: 'CPM' },
                    ] as const).map(({ val, label }) => (
                      <button key={val} type="button" onClick={() => setCategory(val)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${category === val
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* WOFBI */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">WOFBI Class</label>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { val: 'none', label: 'None' },
                      { val: 'bcc', label: 'BCC' },
                      { val: 'lcc', label: 'LCC' },
                      { val: 'ldc', label: 'LDC' },
                    ] as const).map(({ val, label }) => (
                      <button key={val} type="button" onClick={() => setWofbiClass(val)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${wofbiClass === val
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button onClick={handleSaveStation} disabled={savingStation} className="btn btn-primary text-sm">
                  {savingStation ? 'Saving…' : 'Save Station Profile'}
                </button>
              </div>
            </Section>
          )}

          {/* ── Facility details ──────────────────────── */}
          {user?.role !== 'delegate' && (
            <Section title="Facility Details">
              <div className="space-y-4">
                <p className="text-xs text-gray-500">These values appear on your generated Excel reports. Update them whenever your facility changes.</p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Facility Type</label>
                  <input type="text" value={facilityType} onChange={e => setFacilityType(e.target.value)}
                    className="input" placeholder="e.g. TEMPORARY, PERMANENT, RENTED" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Main Hall Cap.', val: mainHallCap, set: setMainHallCap },
                    { label: 'Main Hall Chairs', val: mainHallChairs, set: setMainHallChairs },
                    { label: 'Overflow Cap.', val: overflowCap, set: setOverflowCap },
                    { label: 'Overflow Chairs', val: overflowChairs, set: setOverflowChairs },
                    { label: 'Youth Hall Cap.', val: youthHallCap, set: setYouthHallCap },
                    { label: 'Youth Hall Chairs', val: youthHallChairs, set: setYouthHallChairs },
                    { label: 'Children Cap.', val: childrenHallCap, set: setChildrenHallCap },
                    { label: 'Children Chairs', val: childrenHallChairs, set: setChildrenHallChairs },
                  ].map(({ label, val, set }) => (
                    <div key={label}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                      <input type="number" min="0" value={val} onChange={e => set(e.target.value)}
                        className="input" placeholder="0" />
                    </div>
                  ))}
                </div>
                <button onClick={handleSaveStation} disabled={savingStation} className="btn btn-primary text-sm">
                  {savingStation ? 'Saving…' : 'Save Facility Details'}
                </button>
              </div>
            </Section>
          )}

          {/* ── Subscription ──────────────────────────── */}
          <Section title="Subscription">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`badge ${user?.subscription_status === 'active' ? 'badge-success' :
                  user?.subscription_status === 'trial' ? 'badge-warning' : 'badge-error'}`}>
                  {user?.subscription_status
                    ? user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1)
                    : '—'}
                </span>
              </div>
              {user?.subscription_status === 'trial' && user.trial_ends_at && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">Trial ends</p>
                  <p className="text-sm text-gray-900">{formatDate(user.trial_ends_at)}</p>
                </div>
              )}
              {(user?.subscription_status === 'trial' || user?.subscription_status === 'expired') && (
                <div className="border-t border-gray-200 pt-4 space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-900">Monthly Subscription</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {paystackPublicKey ? '₦5,000 / month — secure payment via Paystack' : 'Dev/test mode — payment will be simulated'}
                    </p>
                  </div>
                  <button onClick={handleUpgrade} disabled={processingPayment || !paystackReady} className="btn btn-primary w-full">
                    {processingPayment ? 'Processing…' : !paystackReady ? 'Loading payment…' : 'Upgrade Subscription'}
                  </button>
                </div>
              )}
            </div>
          </Section>

          {/* ── Sign out ──────────────────────────────── */}
          <div className="card p-6">
            <button onClick={signOut} className="btn btn-danger w-full">Sign Out</button>
          </div>

        </div>
      </main>
    </div>
  );
}
