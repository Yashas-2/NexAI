import React, { useState } from 'react';
import { X, Upload, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface StudentUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const StudentUploadModal: React.FC<StudentUploadModalProps> = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file first');
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/auth/students/import/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Successfully imported ${res.data.imported} student records`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const details = err.response?.data?.details;
      const errMsg = (details && details.length > 0) ? details[0] : (err.response?.data?.error || 'Failed to import CSV');
      toast.error(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "USN,Student_Name,Email,Semester,Department\n1XX21CS001,John Doe,john.doe@nexai.com,5,Computer Science and Engineering\n1XX21CS002,Jane Smith,jane.smith@nexai.com,5,Computer Science and Engineering";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'core_student_seeding_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: '20px',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)', overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '24px 30px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.25)', border: '1px solid rgba(59, 130, 246, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
            }}>
              <Upload size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Base Student Seeding</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Import complete student data to establish foundational identities.
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#cbd5e1', cursor: 'pointer'
          }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ position: 'relative', padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Loading Overlay */}
          {isProcessing && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(4px)',
              zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              borderRadius: '0 0 20px 20px',
            }}>
              <Loader2 size={48} color="#3b82f6" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
              <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 700 }}>Processing CSV...</h3>
              <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Validating rows and establishing identities
              </p>
            </div>
          )}
          
          {/* Rules/Info Box */}
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10b981" /> Required Columns
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['USN', 'Student_Name', 'Email', 'Semester', 'Department'].map(col => (
                <span key={col} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div style={{
            border: '2px dashed #3b82f6', background: file ? '#f0f9ff' : '#f8fafc',
            borderRadius: '16px', padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
            transition: 'all 0.2s'
          }}>
            <FileText size={48} color={file ? "#10b981" : "#3b82f6"} style={{ margin: '0 auto 16px auto' }} />
            <input 
              type="file" accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: 'none' }} id="student-csv-upload"
            />
            <label htmlFor="student-csv-upload" style={{ cursor: 'pointer', display: 'block' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
                {file ? file.name : 'Click to select CSV file'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                {file ? `Size: ${(file.size / 1024).toFixed(1)} KB` : 'Upload your ERP generated student list'}
              </p>
            </label>
            <div style={{ marginTop: '20px' }}>
              <button
                type="button" onClick={handleDownloadTemplate}
                style={{
                  background: 'none', border: 'none', color: '#3b82f6',
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline'
                }}
              >
                Download CSV Template
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 30px', background: '#f8fafc', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'flex-end', gap: '12px'
        }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: 'white', border: '1px solid #cbd5e1',
            borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer'
          }}>
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || isProcessing}
            style={{
              padding: '10px 24px', background: !file || isProcessing ? '#94a3b8' : '#3b82f6',
              color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
            }}
          >
            {isProcessing && <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />}
            {isProcessing ? 'Importing...' : 'Confirm Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
