import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { OfficerCredential } from '../CredentialManagementTab';

interface Props {
  setter: OfficerCredential;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AssignSetterModal: React.FC<Props> = ({ setter, onClose, onSuccess }) => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subRes, sessRes] = await Promise.all([
          api.get('/scheduling/subjects/'),
          api.get('/scheduling/sessions/')
        ]);
        setSubjects(subRes.data.results || subRes.data);
        setSessions(sessRes.data.results || sessRes.data);
      } catch (e) {
        toast.error('Failed to load data for assignment');
      }
    };
    fetchData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject || !selectedSession) {
      toast.error('Please select both subject and session');
      return;
    }
    setLoading(true);
    try {
      await api.post('/vault/question-papers/assign_setter/', {
        setter_id: setter.id,
        subject_id: selectedSubject,
        session_id: selectedSession
      });
      toast.success('Paper Setter officially assigned to subject!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to assign setter');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Assign Subject to {setter.name}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Exam Session</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              value={selectedSession}
              onChange={e => setSelectedSession(e.target.value)}
            >
              <option value="">Select Session...</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Subject</label>
            <select
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #CBD5E1' }}
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option value="">Select Subject...</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px', padding: '12px', background: '#0F172A',
              color: 'white', borderRadius: '8px', fontWeight: 700,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
            }}
          >
            <Check size={18} /> {loading ? 'Assigning...' : 'Confirm Assignment'}
          </button>
        </form>
      </div>
    </div>
  );
};
