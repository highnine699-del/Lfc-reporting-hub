import { useState } from 'react';

interface ParsePreviewProps {
  originalInput: string;
  extractedData: Record<string, any>;
  onConfirm: (data: Record<string, any>) => void;
  onCancel: () => void;
  source: 'whatsapp' | 'voice' | 'handwriting';
}

export default function ParsePreview({ originalInput, extractedData, onConfirm, onCancel, source }: ParsePreviewProps) {
  const [editableData, setEditableData] = useState<Record<string, any>>(extractedData);

  const handleFieldChange = (field: string, value: string) => {
    setEditableData(prev => ({
      ...prev,
      [field]: isNaN(Number(value)) ? value : Number(value)
    }));
  };

  const handleConfirm = () => {
    onConfirm(editableData);
  };

  const getSourceLabel = () => {
    switch (source) {
      case 'whatsapp': return 'WhatsApp Text';
      case 'voice': return 'Voice Transcription';
      case 'handwriting': return 'Handwriting Recognition';
      default: return 'Parsed Input';
    }
  };

  return (
    <div className="space-y-6">
      {/* Original Input */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Original {getSourceLabel()}</h3>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border">
          {originalInput}
        </pre>
      </div>

      {/* Extracted Data */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Extracted Data - Please Review and Edit</h3>
        
        <div className="space-y-4">
          {/* Attendance Section */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Attendance</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'adults_male_attendance', label: 'Adult Male' },
                { key: 'adults_female_attendance', label: 'Adult Female' },
                { key: 'children_male_attendance', label: 'Children Male' },
                { key: 'children_female_attendance', label: 'Children Female' },
                { key: 'children_attendance', label: 'Children (Combined)' },
                { key: 'first_timers', label: 'First Timers' },
                { key: 'new_converts', label: 'New Converts' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-1">{label}</label>
                  <input
                    type="number"
                    value={editableData[key] || ''}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Spiritual Section */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Spiritual Activity</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'testimonies', label: 'Testimonies' },
                { key: 'altar_calls', label: 'Altar Calls' },
                { key: 'wofbi_attendance', label: 'WOFBI Attendance' },
                { key: 'water_baptisms', label: 'Water Baptisms' },
                { key: 'holy_ghost_baptisms', label: 'Holy Ghost Baptisms' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-1">{label}</label>
                  <input
                    type="number"
                    value={editableData[key] || ''}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Finance Section */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Finance - Income (₦)</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'tithes', label: 'Tithes' },
                { key: 'offerings', label: 'Offerings' },
                { key: 'thanksgiving', label: 'Thanksgiving' },
                { key: 'kcc', label: 'KCC' },
                { key: 'shiloh_sacrifice', label: 'Shiloh Sacrifice' },
                { key: 'project_funds', label: 'Project Funds' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-1">{label}</label>
                  <input
                    type="number"
                    value={editableData[key] || ''}
                    onChange={(e) => handleFieldChange(key, e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Custom/Unmapped Fields */}
          {Object.keys(editableData).filter(key => 
            !['adults_male_attendance', 'adults_female_attendance', 'children_male_attendance', 
              'children_female_attendance', 'first_timers', 'new_converts', 'testimonies', 
              'altar_calls', 'wofbi_attendance', 'water_baptisms', 'holy_ghost_baptisms',
              'tithes', 'offerings', 'thanksgiving', 'kcc', 'shiloh_sacrifice', 'project_funds',
              'total', 'total_attendance'].includes(key)
          ).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Additional Fields</h4>
              <div className="space-y-2">
                {Object.keys(editableData).filter(key => 
                  !['adults_male_attendance', 'adults_female_attendance', 'children_male_attendance', 
                    'children_female_attendance', 'first_timers', 'new_converts', 'testimonies', 
                    'altar_calls', 'wofbi_attendance', 'water_baptisms', 'holy_ghost_baptisms',
                    'tithes', 'offerings', 'thanksgiving', 'kcc', 'shiloh_sacrifice', 'project_funds',
                    'total', 'total_attendance'].includes(key)
                ).map(key => (
                  <div key={key}>
                    <label className="block text-xs text-gray-600 mb-1">{key}</label>
                    <input
                      type="text"
                      value={editableData[key] || ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleConfirm}
          className="flex-1 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
        >
          Confirm & Save
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Please review all extracted data before confirming. This data will be saved as a report version.
      </p>
    </div>
  );
}
