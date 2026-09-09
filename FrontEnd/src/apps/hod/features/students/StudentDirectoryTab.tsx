import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Search, Upload, FileText, UserPlus, FileSpreadsheet, Badge, Eye, EyeOff, Edit2, ShieldAlert, ShieldCheck, KeyRound, Trash2 } from 'lucide-react';
import { StudentUploadModal } from './components/StudentUploadModal';
import { EditStudentModal } from './components/EditStudentModal';

interface StudentDirectoryTabProps {
  hideUploadButton?: boolean;
}

export const StudentDirectoryTab: React.FC<StudentDirectoryTabProps> = ({ hideUploadButton = false }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [editingStudent, setEditingStudent] = useState<any>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/users/?role=STUDENT');
      // The backend UserListView might return pagination or a direct list
      const data = res.data.results || res.data;
      setStudents(data);
    } catch (err: any) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSuccess = () => {
    fetchStudents();
  };

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.student_profile?.usn || '').toLowerCase().includes(q)
    );
  });

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleResetPassword = async (id: string) => {
    try {
      const freshPassword = Math.random().toString(36).slice(-8);
      await api.post(`/auth/users/${id}/reset-password/`, { new_password: freshPassword });
      toast.success('Password reset successfully');
      fetchStudents();
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await api.post(`/auth/users/${id}/suspend/`);
        toast.success('Student suspended');
      } else {
        await api.post(`/auth/users/${id}/restore/`);
        toast.success('Student restored');
      }
      fetchStudents();
    } catch (err) {
      toast.error('Failed to update student status');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this student? This action cannot be undone.')) return;
    try {
      await api.delete(`/auth/users/${id}/`);
      toast.success('Student deleted successfully');
      fetchStudents();
    } catch (err) {
      toast.error('Failed to delete student');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm('⚠️ DANGER: Are you absolutely sure you want to permanently delete ALL students? This will erase all their exams, marks, and profiles. This action CANNOT be undone!')) return;
    try {
      await api.delete('/auth/students/bulk-delete/');
      toast.success('All students and associated data deleted permanently.');
      fetchStudents();
    } catch (err) {
      toast.error('Failed to bulk delete students.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search by Name, USN, or Email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 10px 10px 40px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              outline: 'none',
              fontSize: '0.9rem'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleBulkDelete}
            style={{
              padding: '10px 18px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={18} />
            Delete All
          </button>
          {!hideUploadButton && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              style={{
                padding: '10px 18px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontWeight: 600,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)'
              }}
            >
              <Upload size={18} />
              Bulk Import CSV
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading students...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '16px 24px' }}>USN</th>
                <th style={{ padding: '16px 24px' }}>Name & Email</th>
                <th style={{ padding: '16px 24px' }}>Semester & Dept</th>
                <th style={{ padding: '16px 24px' }}>Temporary Password</th>
                <th style={{ padding: '16px 24px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map(student => {
                  const usn = student.usn || '-';
                  const sem = student.semester ? `Semester ${student.semester}` : '-';
                  const dept = student.department?.name || student.department_name || '-';
                  const isActive = student.is_active;
                  return (
                    <tr key={student.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: isActive ? 1 : 0.6 }}>
                      <td style={{ padding: '16px 24px', fontWeight: 600, color: '#0f172a' }}>{usn}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {student.full_name}
                          {!isActive && <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px' }}>Suspended</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{student.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontSize: '0.9rem', color: '#334155' }}>{sem}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{dept}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ 
                            fontFamily: 'monospace', 
                            background: '#f1f5f9', 
                            padding: '4px 8px', 
                            borderRadius: '6px',
                            color: '#334155',
                            letterSpacing: showPasswords[student.id] ? 'normal' : '2px'
                          }}>
                            {showPasswords[student.id] ? (student.plain_password || '********') : '••••••••••••'}
                          </span>
                          <button 
                            onClick={() => togglePasswordVisibility(student.id)}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
                            title="Toggle Password Visibility"
                          >
                            {showPasswords[student.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button 
                            onClick={() => handleResetPassword(student.id)}
                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', color: '#3b82f6', cursor: 'pointer' }}
                            title="Reset Password"
                          >
                            <KeyRound size={16} />
                          </button>
                          <button 
                            onClick={() => setEditingStudent(student)}
                            style={{ background: 'rgba(16, 185, 129, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', color: '#10b981', cursor: 'pointer' }}
                            title="Edit Student"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(student.id, student.is_active)}
                            style={{ background: isActive ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', color: isActive ? '#f59e0b' : '#10b981', cursor: 'pointer' }}
                            title={isActive ? "Suspend Student" : "Restore Student"}
                          >
                            {isActive ? <ShieldAlert size={16} /> : <ShieldCheck size={16} />}
                          </button>
                          <button 
                            onClick={() => handleDeleteStudent(student.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', padding: '8px', borderRadius: '8px', color: '#ef4444', cursor: 'pointer' }}
                            title="Delete Student"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    <UserPlus size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
                    <h3 style={{ margin: '0 0 8px 0', color: '#475569' }}>No Base Students Found</h3>
                    <p style={{ margin: 0 }}>
                      {hideUploadButton 
                        ? 'Switch to the "Upload Students" tab to import your CSV file and seed the directory.' 
                        : 'Click "Bulk Import CSV" to seed the foundational student directory.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isUploadModalOpen && (
        <StudentUploadModal 
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={handleImportSuccess}
        />
      )}

      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            fetchStudents();
          }}
        />
      )}
    </div>
  );
};
