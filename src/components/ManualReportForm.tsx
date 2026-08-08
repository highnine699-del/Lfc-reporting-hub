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
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Attendance Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Attendance</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adult Male</label>
            <input
              type="number"
              value={formData.adults_male_attendance}
              onChange={(e) => handleNumberChange('adults_male_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adult Female</label>
            <input
              type="number"
              value={formData.adults_female_attendance}
              onChange={(e) => handleNumberChange('adults_female_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Children Male</label>
            <input
              type="number"
              value={formData.children_male_attendance}
              onChange={(e) => handleNumberChange('children_male_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Children Female</label>
            <input
              type="number"
              value={formData.children_female_attendance}
              onChange={(e) => handleNumberChange('children_female_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Children (Combined)</label>
            <input
              type="number"
              value={formData.children_attendance}
              onChange={(e) => handleNumberChange('children_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Timers</label>
            <input
              type="number"
              value={formData.first_timers}
              onChange={(e) => handleNumberChange('first_timers', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Converts</label>
            <input
              type="number"
              value={formData.new_converts}
              onChange={(e) => handleNumberChange('new_converts', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Spiritual Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Spiritual Activity</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Testimonies</label>
            <input
              type="number"
              value={formData.testimonies}
              onChange={(e) => handleNumberChange('testimonies', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Altar Calls</label>
            <input
              type="number"
              value={formData.altar_calls}
              onChange={(e) => handleNumberChange('altar_calls', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WOFBI Attendance</label>
            <input
              type="number"
              value={formData.wofbi_attendance}
              onChange={(e) => handleNumberChange('wofbi_attendance', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Water Baptisms</label>
            <input
              type="number"
              value={formData.water_baptisms}
              onChange={(e) => handleNumberChange('water_baptisms', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Holy Ghost Baptisms</label>
            <input
              type="number"
              value={formData.holy_ghost_baptisms}
              onChange={(e) => handleNumberChange('holy_ghost_baptisms', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Finance Income Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Finance - Income</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tithes (₦)</label>
            <input
              type="number"
              value={formData.tithes}
              onChange={(e) => handleNumberChange('tithes', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Offerings (₦)</label>
            <input
              type="number"
              value={formData.offerings}
              onChange={(e) => handleNumberChange('offerings', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Thanksgiving (₦)</label>
            <input
              type="number"
              value={formData.thanksgiving}
              onChange={(e) => handleNumberChange('thanksgiving', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">KCC (₦)</label>
            <input
              type="number"
              value={formData.kcc}
              onChange={(e) => handleNumberChange('kcc', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shiloh Sacrifice (₦)</label>
            <input
              type="number"
              value={formData.shiloh_sacrifice}
              onChange={(e) => handleNumberChange('shiloh_sacrifice', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Funds (₦)</label>
            <input
              type="number"
              value={formData.project_funds}
              onChange={(e) => handleNumberChange('project_funds', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Expenditure Section */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Finance - Expenditure (ROF)</h3>
        <div className="space-y-3">
          {formData.expenditure_items.map((item: any, index: number) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                placeholder="Description"
                value={item.label}
                onChange={(e) => updateExpenditureItem(index, 'label', e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="number"
                placeholder="Amount (₦)"
                value={item.amount}
                onChange={(e) => updateExpenditureItem(index, 'amount', e.target.value)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              {formData.expenditure_items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExpenditureItem(index)}
                  className="px-3 py-2 text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addExpenditureItem}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            + Add Expenditure Item
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          className="flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Save Report
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
