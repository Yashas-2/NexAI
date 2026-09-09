import React, { useState, useRef, useEffect } from 'react';
import {
  Upload, Users, CheckCircle2, AlertTriangle, X, Download,
  FileText, Building2, Clock, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import toast, { Toaster } from 'react-hot-toast';

interface ImportedStudent {
  id: string;
  usn: string;
  name: string;
  email: string;
  semester: number;
  department: string;
  department_code: string;
  section: string;
  temp_password: string;
}

interface ImportBatch {
  id: string;
  timestamp: string;
  department: string;
  imported: number;
  skipped: number;
  errors: string[];
  students: ImportedStudent[];
}

interface HistoryEntry {
  imported_by: string;
  imported_at: string;
  total_imported: number;
  total_skipped: number;
  total_errors: number;
}

import { StudentDirectoryTab } from '@/apps/hod/features/students/StudentDirectoryTab';

type TabId = 'upload' | 'history' | 'directory';

export default function AdmissionDashboard() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [stats, setStats] = useState<{ total_students: number; departments: { name: string; code: string; count: number }[]; department_count: number; import_batches: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/auth/departments/').then(res => setDepartments(res.data || [])).catch(() => {});
    api.get('/auth/students/import/history/').then(res => setHistory(res.data.history || [])).catch(() => {});
    api.get('/auth/students/stats/').then(res => setStats(res.data)).catch(() => {});
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    const toastId = toast.loading(`Importing students from ${file.name}...`);

    try {
      const res = await api.post('/auth/students/import/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;

      const batch: ImportBatch = {
        id: `batch_${Date.now()}`,
        timestamp: new Date().toISOString(),
        department: data.students?.[0]?.department || 'Mixed',
        imported: data.imported,
        skipped: data.skipped || 0,
        errors: data.errors || [],
        students: data.students || [],
      };

      setBatches(prev => [batch, ...prev]);

      // Refresh history and stats
      api.get('/auth/students/import/history/').then(r => setHistory(r.data.history || [])).catch(() => {});
      api.get('/auth/students/stats/').then(r => setStats(r.data)).catch(() => {});

      toast.success(`✅ ${data.imported} students imported successfully!`, { id: toastId });

      if (data.errors?.length > 0) {
        toast.error(`⚠️ ${data.errors.length} warnings during import`, { duration: 5000 });
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.error || 'Import failed. Check file format.';
      toast.error(`❌ ${errMsg}`, { id: toastId });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const csv = `USN,Student_Name,Email,Password,Department,Semester,Section\n4MC23CS001,Arun Kumar,arun.kumar@student.nexai.edu,Pass@1234,Computer Science and Engineering,5,A\n4MC23ME001,Priya Sharma,priya.sharma@student.nexai.edu,,Mechanical Engineering,5,A\n4MC23EC001,Ravi Patel,ravi.patel@student.nexai.edu,,Electronics and Communication,3,B`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nexai_student_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Template downloaded!');
  };

  const totalImported = stats?.total_students ?? batches.reduce((sum, b) => sum + b.imported, 0);
  const totalErrors = batches.reduce((sum, b) => sum + b.errors.length, 0);
  const deptsUploaded = stats?.department_count ?? departments.length;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <Toaster position="top-right" />

      {/* Header */}
      <header style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
          }}>🎓</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>NexAI Admission Portal</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Student Onboarding & Management</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0' }}>{user?.full_name}</div>
            <div style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: 700 }}>ADMISSION OFFICER</div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', borderRadius: 8, padding: '6px 12px',
              fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats Ribbon */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          {[
            { icon: '👥', label: 'Total Imported (Session)', value: totalImported, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)' },
            { icon: '🏛️', label: 'Departments Uploaded', value: deptsUploaded, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
            { icon: '📋', label: 'Import Batches', value: stats?.import_batches ?? batches.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
            { icon: '⚠️', label: 'Warnings / Errors', value: totalErrors, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)' },
          ].map((s) => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 16, padding: '18px 20px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ fontSize: '1.6rem' }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {(['upload', 'history', 'directory'] as TabId[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 20px',
                background: activeTab === tab ? 'rgba(99,102,241,0.9)' : 'transparent',
                color: activeTab === tab ? 'white' : '#94a3b8',
                border: 'none', borderRadius: 8,
                fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                textTransform: 'capitalize', letterSpacing: '0.3px',
              }}
            >
              {tab === 'upload' ? '📤 Upload Students' : tab === 'history' ? '📜 Import History' : '👥 Student Directory'}
            </button>
          ))}
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            
            {/* Upload Panel */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={18} color="#6366f1" /> Bulk Student Import
              </h2>

              {/* CSV Format Info */}
              <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: '0.78rem', color: '#a5b4fc' }}>
                <div style={{ fontWeight: 800, marginBottom: 6, color: '#818cf8' }}>Required CSV Columns:</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                  {['USN ✅ Required', 'Student_Name ✅ Required', 'Email ✅ Required', 'Password (auto-gen if blank)', 'Department (or HOD dept)', 'Semester (default: 1)', 'Section (default: A)'].map(c => (
                    <div key={c} style={{ color: c.includes('✅') ? '#6ee7b7' : '#94a3b8' }}>• {c}</div>
                  ))}
                </div>
              </div>

              {/* Drop Zone */}
              <input type="file" ref={fileInputRef} accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isUploading ? 'rgba(99,102,241,0.6)' : 'rgba(99,102,241,0.4)'}`,
                  borderRadius: 16, padding: '40px 20px', textAlign: 'center',
                  cursor: isUploading ? 'default' : 'pointer',
                  background: isUploading ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.04)',
                  transition: 'all 0.2s',
                }}
              >
                {isUploading ? (
                  <>
                    <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                    <div style={{ color: '#a5b4fc', fontWeight: 700 }}>Processing import...</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: 4 }}>Please wait while we validate and create student accounts</div>
                  </>
                ) : (
                  <>
                    <FileText size={40} color="#6366f1" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                    <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: '0.95rem', marginBottom: 4 }}>Drop CSV file here or click to browse</div>
                    <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: 16 }}>Supports: name, usn, email, password, department, semester, section</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
                      style={{
                        padding: '7px 18px', background: 'rgba(99,102,241,0.2)',
                        border: '1px solid rgba(99,102,241,0.5)', color: '#a5b4fc',
                        borderRadius: 8, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <Download size={13} style={{ marginRight: 6 }} /> Download Template
                    </button>
                  </>
                )}
              </div>

              {/* Important rules */}
              <div style={{ marginTop: 16, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: '0.74rem', color: '#fbbf24' }}>
                <strong>⚠️ Important:</strong> Duplicate USNs and emails are automatically skipped (not overwritten).
                Existing student records from other departments are never deleted.
              </div>
            </div>

            {/* Recent Batches */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28, overflowY: 'auto', maxHeight: 520 }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={18} color="#10b981" /> This Session's Imports
              </h2>

              {batches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#475569' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📂</div>
                  <div style={{ fontWeight: 700 }}>No imports yet this session</div>
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Upload a CSV file to get started</div>
                </div>
              ) : batches.map(batch => (
                <div key={batch.id} style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                  {/* Batch Header */}
                  <div
                    style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    onClick={() => setExpandedBatch(expandedBatch === batch.id ? null : batch.id)}
                  >
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={14} color="#6366f1" /> {batch.department}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 2 }}>
                        {new Date(batch.timestamp).toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
                        ✅ {batch.imported} imported
                      </span>
                      {batch.skipped > 0 && (
                        <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
                          ⏭ {batch.skipped} skipped
                        </span>
                      )}
                      {expandedBatch === batch.id ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                    </div>
                  </div>

                  {/* Expanded student list */}
                  {expandedBatch === batch.id && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0 18px 18px' }}>
                      {batch.errors.length > 0 && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', margin: '14px 0', fontSize: '0.74rem' }}>
                          <div style={{ color: '#f87171', fontWeight: 800, marginBottom: 6 }}>⚠️ Warnings ({batch.errors.length})</div>
                          {batch.errors.slice(0, 5).map((err, i) => <div key={i} style={{ color: '#fca5a5', marginBottom: 2 }}>• {err}</div>)}
                          {batch.errors.length > 5 && <div style={{ color: '#64748b' }}>...and {batch.errors.length - 5} more</div>}
                        </div>
                      )}
                      <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 12 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                          <thead>
                            <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              {['USN', 'Name', 'Email', 'Sem', 'Dept', 'Temp Password'].map(h => (
                                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {batch.students.map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#e2e8f0' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 800, color: '#a5b4fc' }}>{s.usn}</td>
                                <td style={{ padding: '6px 8px' }}>{s.name}</td>
                                <td style={{ padding: '6px 8px', color: '#94a3b8', fontSize: '0.7rem' }}>{s.email}</td>
                                <td style={{ padding: '6px 8px' }}>{s.semester}</td>
                                <td style={{ padding: '6px 8px' }}>{s.department_code}</td>
                                <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.7rem' }}>{s.temp_password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 28 }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="#f59e0b" /> Import History Log
            </h2>

            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#475569' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📜</div>
                <div style={{ fontWeight: 700 }}>No import history available</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ color: '#64748b', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Imported By', 'Timestamp', 'Students Imported', 'Skipped', 'Errors'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                      <td style={{ padding: '10px 14px' }}>{h.imported_by}</td>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: '0.76rem' }}>{new Date(h.imported_at).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 10px', borderRadius: 20, fontWeight: 800, fontSize: '0.78rem' }}>
                          {h.total_imported}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#fbbf24', fontWeight: 700 }}>{h.total_skipped}</td>
                      <td style={{ padding: '10px 14px', color: h.total_errors > 0 ? '#f87171' : '#6ee7b7', fontWeight: 700 }}>{h.total_errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {/* Directory Tab */}
        {activeTab === 'directory' && (
          <div style={{ background: 'white', borderRadius: 16, padding: '24px' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Global Student Directory</h2>
            <StudentDirectoryTab hideUploadButton={true} />
          </div>
        )}

      </div>
    </div>
  );
}
