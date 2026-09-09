import React, { useState } from 'react';
import { X, Save, User, Hash, Mail, GraduationCap } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface EditStudentModalProps {
  student: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({ student, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    full_name: student.full_name || '',
    email: student.email || '',
    usn: student.usn || '',
    semester: student.semester || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.patch(`/auth/users/${student.id}/`, {
        full_name: formData.full_name,
        email: formData.email,
        write_usn: formData.usn,
        write_semester: parseInt(formData.semester.toString(), 10) || null
      });
      toast.success('Student details updated successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update student');
    } finally {
      setIsSaving(false);
    }
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
        background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px',
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
              background: 'rgba(16, 185, 129, 0.25)', border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981'
            }}>
              <User size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Edit Student</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                Update demographics and identity records
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
        <form onSubmit={handleSubmit} style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} /> Full Name
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Hash size={16} /> USN
            </label>
            <input
              type="text"
              value={formData.usn}
              onChange={e => setFormData({ ...formData, usn: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={16} /> Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GraduationCap size={16} /> Semester
            </label>
            <input
              type="number"
              min="1" max="8"
              value={formData.semester}
              onChange={e => setFormData({ ...formData, semester: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
            />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px'
          }}>
            <button type="button" onClick={onClose} style={{
              padding: '10px 20px', background: 'white', border: '1px solid #cbd5e1',
              borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer'
            }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '10px 24px', background: isSaving ? '#94a3b8' : '#10b981',
                color: 'white', border: 'none', borderRadius: '10px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
