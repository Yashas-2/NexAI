import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface FacultyFormProps {
  initialData?: any;
  onCancel: () => void;
  onSave: () => void;
}

export const FacultyForm: React.FC<FacultyFormProps> = ({ initialData, onCancel, onSave }) => {
  const [fullName, setFullName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [departmentId, setDepartmentId] = useState(initialData?.deptId || '');
  const [status, setStatus] = useState(initialData?.status || 'Active');
  
  const [departments, setDepartments] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch departments for dropdown
    api.get('/auth/departments/')
      .then(res => setDepartments(res.data.results || res.data))
      .catch(console.error);
  }, []);

  const handleSaveInternal = async () => {
    if (!fullName || (!initialData && !email)) {
      alert("Please fill required fields (Name, Email)");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload: any = {
        full_name: fullName,
        is_active: status === 'Active',
        department: departmentId || null,
        role: 'FACULTY'
      };
      
      if (!initialData?.id) {
        payload.email = email;
        payload.password = "password123"; // default temp password
        await api.post('/auth/users/create/', payload);
      } else {
        // user detail view expects email as well, though it might be readonly
        payload.email = initialData.email;
        await api.put(`/auth/users/${initialData.id}/`, payload);
      }
      onSave(); // Close form and refresh
    } catch (err: any) {
      console.error(err);
      alert("Failed to save faculty: " + (err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <Card variant="flat">
        <h3 style={{ margin: '0 0 24px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          {initialData ? 'Edit Faculty Details' : 'Register Faculty'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Full Name *</label>
            <input style={inputStyle} placeholder="e.g. Dr. Alan Smith" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Email Address *</label>
            <input style={inputStyle} type="email" placeholder="e.g. alan@univ.edu" value={email} onChange={e => setEmail(e.target.value)} disabled={!!initialData} />
            {initialData && <span style={{fontSize:'0.75rem', color:'gray'}}>Email cannot be changed after creation</span>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Department</label>
            <select style={inputStyle} value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
              <option value="">Central / No Department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Status</label>
            <select style={inputStyle} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive / Suspended</option>
            </select>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button variant="primary" onClick={handleSaveInternal} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Faculty'}
        </Button>
      </div>
    </div>
  );
};
