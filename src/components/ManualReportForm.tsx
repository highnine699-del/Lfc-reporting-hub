import { useState } from 'react';

interface ManualReportFormProps {
  periodType: string;
  startDate: string;
  endDate: string;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
}

export default function ManualReportForm({ periodType: _periodType, startDate: _startDate, endDate: _endDate, onSubmit, onCancel }: ManualReportFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    // Attendance
    adults_male_attendance: '',
    adults_female_attendance: '',
    children_male_attendance: '',
    children_female_attendance: '',
    children_attendance: '',
    first_timers: '',
    new_converts: '',
    // Spiritual
    testimonies: '',
    altar_calls: '',
    wofbi_attendance: '',
    water_baptisms: '',
    holy_ghost_baptisms: '',
    // Finance Income
    tithes: '',
    offerings: '',
    thanksgiving: '',
    kcc: '',
    shiloh_sacrifice: '',
    project_funds: '',
    // Expenditure
    expenditure_items: [{ label: '', amount: '' }],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleNumberChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value ? Number(value) : 0 }));
  };

  const addExpenditureItem = () => {
    setFormData(prev => ({
      ...prev,
      expenditure_items: [...prev.expenditure_items, { label: '', amount: '' }]
    }));
  };

  const updateExpenditureItem = (index: number, field: 'label' | 'amount', value: string) => {
    setFormData(prev => {
      const newItems = [...prev.expenditure_items];
      newItems[index] = { ...newItems[index], [field]: field === 'amount' ? (value ? Number(value) : 0) : value };
      return { ...prev, expenditure_items: newItems };
    });
  };

  const removeExpenditureItem = (index: number) => {
    setFormData(prev => {
      const newItems = prev.expenditure_items.filter((_item: any, i: number) => i !== index);
      return { ...prev, expenditure_items: newItems };
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Attendance Section */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Attendance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adult Male</label>
            <input
              type="number"
              value={formData.adults_male_attendance}
              onChange={(e) => handleNumberChange('adults_male_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adult Female</label>
            <input
              type="number"
              value={formData.adults_female_attendance}
              onChange={(e) => handleNumberChange('adults_female_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Children Male</label>
            <input
              type="number"
              value={formData.children_male_attendance}
              onChange={(e) => handleNumberChange('children_male_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Children Female</label>
            <input
              type="number"
              value={formData.children_female_attendance}
              onChange={(e) => handleNumberChange('children_female_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Children (Combined)</label>
            <input
              type="number"
              value={formData.children_attendance}
              onChange={(e) => handleNumberChange('children_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">First Timers</label>
            <input
              type="number"
              value={formData.first_timers}
              onChange={(e) => handleNumberChange('first_timers', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Converts</label>
            <input
              type="number"
              value={formData.new_converts}
              onChange={(e) => handleNumberChange('new_converts', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Spiritual Section */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Spiritual Activity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Testimonies</label>
            <input
              type="number"
              value={formData.testimonies}
              onChange={(e) => handleNumberChange('testimonies', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Altar Calls</label>
            <input
              type="number"
              value={formData.altar_calls}
              onChange={(e) => handleNumberChange('altar_calls', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">WOFBI Attendance</label>
            <input
              type="number"
              value={formData.wofbi_attendance}
              onChange={(e) => handleNumberChange('wofbi_attendance', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Water Baptisms</label>
            <input
              type="number"
              value={formData.water_baptisms}
              onChange={(e) => handleNumberChange('water_baptisms', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Holy Ghost Baptisms</label>
            <input
              type="number"
              value={formData.holy_ghost_baptisms}
              onChange={(e) => handleNumberChange('holy_ghost_baptisms', e.target.value)}
              className="input"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Finance Income Section */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Finance — Income</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tithes</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.tithes}
                onChange={(e) => handleNumberChange('tithes', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Offerings</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.offerings}
                onChange={(e) => handleNumberChange('offerings', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Thanksgiving</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.thanksgiving}
                onChange={(e) => handleNumberChange('thanksgiving', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">KCC</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.kcc}
                onChange={(e) => handleNumberChange('kcc', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shiloh Sacrifice</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.shiloh_sacrifice}
                onChange={(e) => handleNumberChange('shiloh_sacrifice', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Project Funds</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                ₦
              </span>
              <input
                type="number"
                value={formData.project_funds}
                onChange={(e) => handleNumberChange('project_funds', e.target.value)}
                className="input rounded-l-none"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Expenditure Section */}
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-6">Finance — Expenditure (ROF)</h3>
        <div className="space-y-4">
          {formData.expenditure_items.map((item: any, index: number) => (
            <div key={index} className="flex gap-3">
              <input
                type="text"
                placeholder="Description"
                value={item.label}
                onChange={(e) => updateExpenditureItem(index, 'label', e.target.value)}
                className="input flex-1"
              />
              <div className="flex w-40">
                <span className="inline-flex items-center px-3 py-2.5 text-sm text-gray-500 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder="Amount"
                  value={item.amount}
                  onChange={(e) => updateExpenditureItem(index, 'amount', e.target.value)}
                  className="input rounded-l-none"
                />
              </div>
              {formData.expenditure_items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExpenditureItem(index)}
                  className="btn btn-ghost px-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addExpenditureItem}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            + Add Expenditure Item
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          className="btn btn-primary flex-1 text-base"
        >
          Save Report
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary text-base"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}