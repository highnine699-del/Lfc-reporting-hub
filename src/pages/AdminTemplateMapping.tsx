import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function AdminTemplateMapping() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-4">This page is only accessible to administrators.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fieldMappings, setFieldMappings] = useState<Record<string, { fieldKey: string; sheetName: string }>>({});
  const [uploading, setUploading] = useState(false);

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: dataFields } = useQuery({
    queryKey: ['dataFields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('data_fields')
        .select('*')
        .order('category, display_name');
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase
        .storage
        .from('templates')
        .upload(fileName, file);
      if (error) throw error;
      return data.path;
    },
  });

  const createTemplateVersionMutation = useMutation({
    mutationFn: async ({ templateId, filePath, mappings }: { templateId: string; filePath: string; mappings: Record<string, { fieldKey: string; sheetName: string }> }) => {
      // Get current version number
      const { data: currentVersion } = await supabase
        .from('template_versions')
        .select('version_number')
        .eq('template_id', templateId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const newVersionNumber = (currentVersion?.version_number || 0) + 1;

      // Create new template version
      const { data: version, error: versionError } = await supabase
        .from('template_versions')
        .insert({
          template_id: templateId,
          file_storage_path: filePath,
          version_number: newVersionNumber,
        })
        .select()
        .single();

      if (versionError) throw versionError;

      // Create field mappings
      const mappingPromises = Object.entries(mappings).map(([cell, { fieldKey, sheetName }]) =>
        supabase.from('template_field_mappings').insert({
          template_version_id: version.id,
          sheet_name: sheetName || 'Sheet1',
          cell_reference: cell,
          data_field_key: fieldKey,
          label_text: fieldKey, // Simplified - in production would extract from Excel
        })
      );

      await Promise.all(mappingPromises);

      // Update template's current version
      await supabase
        .from('templates')
        .update({ current_version_id: version.id })
        .eq('id', templateId);

      return version;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setUploadedFile(null);
      setFieldMappings({});
      setSelectedTemplate(null);
      alert('Template uploaded and mapped successfully!');
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      // Auto-detect field mappings from the Excel file
      detectFieldMappings(file);
    }
  };

  const detectFieldMappings = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        if (!buffer) return;
        
        // Dynamic import to code-split exceljs
        const XLSX = await import('exceljs');
        const workbook = new XLSX.Workbook();
        await workbook.xlsx.load(buffer);
        
        const detectedMappings: Record<string, { fieldKey: string; sheetName: string }> = {};
        
        // Scan all sheets for field labels
        workbook.worksheets.forEach((worksheet: any) => {
          const sheetName = worksheet.name;
          console.log(`Scanning sheet: ${sheetName}`); // Debug logging
          
          worksheet.eachRow((row: any) => {
            row.eachCell((cell: any) => {
              const cellValue = cell.value?.toString().toLowerCase().trim();
              if (cellValue) {
                // Match cell value against data field labels with stricter matching
                const dataFieldsList = dataFields || [];
                const matchedField = dataFieldsList.find((field: any) => {
                  const fieldName = field.display_name.toLowerCase();
                  const fieldKey = field.key.toLowerCase().replace(/_/g, ' ');
                  
                  // Exact match or very close match
                  return cellValue === fieldName || 
                         cellValue === fieldKey ||
                         fieldName.includes(cellValue) && cellValue.length > 3 ||
                         fieldKey.includes(cellValue) && cellValue.length > 3;
                });
                
                if (matchedField) {
                  const cellAddress = cell.address;
                  detectedMappings[cellAddress] = {
                    fieldKey: matchedField.key,
                    sheetName: sheetName
                  };
                  console.log(`Found mapping: ${cellAddress} -> ${matchedField.key} in ${sheetName}`);
                }
              }
            });
          });
        });
        
        console.log('Detected mappings:', detectedMappings);
        setFieldMappings(detectedMappings);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error detecting field mappings:', error);
    }
  };

  const handlePublish = async () => {
    if (!selectedTemplate || !uploadedFile) {
      alert('Please select a template and upload a file.');
      return;
    }

    setUploading(true);
    try {
      const filePath = await uploadMutation.mutateAsync(uploadedFile);
      await createTemplateVersionMutation.mutateAsync({
        templateId: selectedTemplate,
        filePath,
        mappings: fieldMappings,
      });
    } catch (error) {
      console.error('Error publishing template:', error);
      alert('Failed to publish template. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const groupedFields = dataFields?.reduce((acc: any, field: any) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Template Mapping</h1>
          <p className="text-sm text-gray-600 mt-1">Configure Excel templates and field mappings for report generation</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Template Selection and Upload */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Select Template</h2>
              {templatesLoading ? (
                <div className="text-gray-500">Loading templates...</div>
              ) : (
                <select
                  value={selectedTemplate || ''}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select a template...</option>
                  {templates?.map((template: any) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.period_type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Template File</h2>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {uploadedFile && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {uploadedFile.name}
                </p>
              )}
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Field Mappings</h2>
              <p className="text-sm text-gray-600 mb-4">
                Field mappings are auto-detected from your Excel file. Review and edit if needed.
              </p>
              
              {Object.keys(fieldMappings).length === 0 ? (
                <p className="text-sm text-gray-500 italic">No field mappings detected. Upload a file to auto-detect.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(fieldMappings).map(([cell, { fieldKey, sheetName }]) => (
                    <div key={cell} className="flex gap-2 items-center bg-gray-50 p-3 rounded">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Cell: {cell}</p>
                        <p className="text-sm font-medium text-gray-900">{fieldKey}</p>
                        <p className="text-xs text-gray-500">Sheet: {sheetName}</p>
                      </div>
                      <button
                        onClick={() => {
                          const newMappings = { ...fieldMappings };
                          delete newMappings[cell];
                          setFieldMappings(newMappings);
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <button
                onClick={() => setFieldMappings({ ...fieldMappings, '': { fieldKey: '', sheetName: 'Sheet1' } })}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-800"
              >
                + Add Manual Mapping
              </button>
            </div>

            <button
              onClick={handlePublish}
              disabled={!selectedTemplate || !uploadedFile || uploading}
              className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Publishing...' : 'Publish Template'}
            </button>
          </div>

          {/* Right Panel - Available Data Fields */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Available Data Fields</h2>
            {groupedFields ? (
              <div className="space-y-4">
                {Object.entries(groupedFields).map(([category, fields]: [string, any]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-gray-900 capitalize mb-2">{category}</h3>
                    <div className="space-y-1">
                      {fields.map((field: any) => (
                        <div key={field.key} className="text-sm text-gray-600">
                          <code className="bg-gray-100 px-1 py-0.5 rounded">{field.key}</code>
                          <span className="ml-2">{field.display_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">Loading data fields...</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
