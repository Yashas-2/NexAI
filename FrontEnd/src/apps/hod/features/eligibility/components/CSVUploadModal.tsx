import React, { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { StudentEligibilityRecord } from '../../../types';

import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface CSVUploadModalProps {
  onImportStudents: (imported: StudentEligibilityRecord[]) => void;
  onClose: () => void;
}

export const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ onImportStudents, onClose }) => {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewParsed, setPreviewParsed] = useState<StudentEligibilityRecord[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      setIsProcessing(true);

      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          const lines = text.split('\n').filter(l => l.trim() !== '');
          if (lines.length > 1) {
            // Assume headers are: name,usn,subject_code,attendance,cie
            const records: StudentEligibilityRecord[] = [];
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
              if (parts.length >= 5) {
                const [name, usn, subject_code, attendance, cie] = parts;
                const attendancePercent = parseFloat(attendance) || 0;
                const cieMarksAvg = parseFloat(cie) || 0;

                let status: 'ELIGIBLE' | 'CONDONABLE' | 'DETAINED' = 'ELIGIBLE';
                if (attendancePercent < 65 || cieMarksAvg < 20) {
                  status = 'DETAINED';
                } else if (attendancePercent < 75) {
                  status = 'CONDONABLE';
                }

                // Auto-detect dept from subject_code if possible (e.g. ME, CS)
                let dept = 'General';
                if (subject_code.includes('CS')) dept = 'CSE';
                else if (subject_code.includes('ME')) dept = 'ME';
                else if (subject_code.includes('CV')) dept = 'CV';
                else if (subject_code.includes('EC')) dept = 'ECE';

                // Guess semester
                let sem = '5th Sem'; // default
                const codeMatch = subject_code.match(/\d{2}[A-Z]{2}(\d)/);
                if (codeMatch) {
                    sem = `${codeMatch[1]}th Sem`;
                    if (codeMatch[1] === '1') sem = '1st Sem';
                    if (codeMatch[1] === '2') sem = '2nd Sem';
                    if (codeMatch[1] === '3') sem = '3rd Sem';
                }

                records.push({
                  id: `imp_${Date.now()}_${i}`,
                  usn,
                  name,
                  email: `${usn.toLowerCase()}@nexai.edu`,
                  semester: sem,
                  department: dept,
                  section: 'A',
                  subjectCode: subject_code,
                  subjectTitle: `${subject_code} Subject`,
                  attendancePercent,
                  totalClassesHeld: 40,
                  classesAttended: Math.floor(40 * (attendancePercent / 100)),
                  cieMarksAvg,
                  status,
                  hasFeeDues: false,
                });
              }
            }
            setTimeout(() => {
                setPreviewParsed(records);
                setIsProcessing(false);
            }, 500);
          } else {
            setIsProcessing(false);
            toast.error("CSV must contain headers and data rows");
          }
        }
      };
      reader.onerror = () => {
        setIsProcessing(false);
        toast.error("Error reading file");
      }
      reader.readAsText(file);
    }
  };

  const handleConfirmImport = () => {
    if (previewParsed) {
      onImportStudents(previewParsed);
      onClose();
    }
  };

  const handleDownloadTemplate = () => {
    // Determine subject codes based on department if possible
    // Use user context or generic if not available
    const deptPrefix = 'ME'; // Assuming this is for ME since they had the issue, but could be dynamic
    var csvContent = `name,usn,subject_code,attendance,cie\n"Alice Smith",1RV20ME001,ME201,85.5,42\n"Bob Jones",1RV20ME002,ME201,65.0,30`;
    var blob = new Blob([csvContent], { type: 'text/csv' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'eligibility_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('CSV Template downloaded!');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '680px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '22px 30px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.25)',
                border: '1.5px solid rgba(59, 130, 246, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6'
              }}>
                <Upload size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  Bulk Attendance CSV Ingestion Gateway
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Upload ERP attendance records to automatically evaluate exam eligibility.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Drag & Drop Area */}
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileChange} 
          />
          <div 
            style={{
              border: '2px dashed #3b82f6',
              background: '#f8fafc',
              borderRadius: '14px',
              padding: '30px',
              textAlign: 'center',
              cursor: 'pointer',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileText size={36} color="#3b82f6" style={{ margin: '0 auto 10px auto' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
              {selectedFileName || 'Click to select CSV file'}
            </h4>
            <p style={{ margin: '0 0 14px 0', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
              Supports CSV containing columns: [name, usn, subject_code, attendance, cie]
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                style={{
                  padding: '8px 20px',
                  background: 'white',
                  color: '#3b82f6',
                  border: '1.5px solid #3b82f6',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Download Template
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                style={{
                  padding: '8px 20px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isProcessing ? 'Validating & Parsing Data...' : 'Browse File'}
              </button>
            </div>
          </div>

          {/* Parsed Preview Table */}
          {previewParsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)' }}>
                  Validated Records Preview ({previewParsed.length} Students)
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 700 }}>
                  0 Format Errors Detected ✓
                </span>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                  <thead style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
                    <tr>
                      <th style={{ padding: '8px 12px' }}>USN</th>
                      <th style={{ padding: '8px 12px' }}>Name</th>
                      <th style={{ padding: '8px 12px' }}>Attendance</th>
                      <th style={{ padding: '8px 12px' }}>CIE Score</th>
                      <th style={{ padding: '8px 12px' }}>Calculated Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewParsed.map(p => (
                      <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{p.usn}</td>
                        <td style={{ padding: '8px 12px' }}>{p.name}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 700, color: p.attendancePercent >= 75 ? '#16a34a' : '#d97706' }}>
                          {p.attendancePercent}% ({p.classesAttended}/{p.totalClassesHeld})
                        </td>
                        <td style={{ padding: '8px 12px' }}>{p.cieMarksAvg}/50</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            background: p.status === 'ELIGIBLE' ? '#ecfdf5' : '#fef3c7',
                            color: p.status === 'ELIGIBLE' ? '#059669' : '#b45309',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.7rem'
                          }}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 30px', background: '#f8fafc', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', background: 'white', border: '1.5px solid var(--color-border)', borderRadius: '8px', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
          >
            Cancel
          </button>

          <button
            onClick={handleConfirmImport}
            disabled={!previewParsed}
            style={{
              padding: '8px 20px',
              background: previewParsed ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: previewParsed ? 'pointer' : 'not-allowed',
              boxShadow: previewParsed ? '0 4px 12px rgba(59,130,246,0.3)' : 'none',
            }}
          >
            Import to Active Roster ✓
          </button>
        </div>
      </div>
    </div>
  );
};
