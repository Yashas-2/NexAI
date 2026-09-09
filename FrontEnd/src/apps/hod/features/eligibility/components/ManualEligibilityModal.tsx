import React, { useState } from 'react';
import { X, CheckCircle2, User, BookOpen, Percent, TrendingUp } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

import { StudentEligibilityRecord } from '../../../types';

interface ManualEligibilityModalProps {
  activeSessionId: string;
  onAddStudent?: (student: StudentEligibilityRecord) => void;
  onClose: () => void;
}

export const ManualEligibilityModal: React.FC<ManualEligibilityModalProps> = ({ activeSessionId, onAddStudent, onClose }) => {
  const [usn, setUsn] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [attendance, setAttendance] = useState('');
  const [cie, setCie] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  React.useEffect(() => {
    Promise.all([
      api.get('/auth/users/', { params: { role: 'STUDENT' } }),
      api.get('/scheduling/subjects/')
    ]).then(([studentsRes, subjectsRes]) => {
      setStudentsList(studentsRes.data.results || studentsRes.data);
      setSubjectsList(subjectsRes.data.results || subjectsRes.data);
    }).catch(err => {
      console.error('Failed to load form data', err);
    }).finally(() => setIsLoadingData(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usn || !subjectCode || !attendance || !cie) {
      toast.error('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    
try {
        const att = parseFloat(attendance);
        const cieScore = parseFloat(cie);

        const selectedSub = subjectsList.find(s => s.code === subjectCode);

        // POST to backend
      const res = await api.post('/eligibility/records/', {
        student_usn: usn,
        subject_code: subjectCode,
        exam_session_id: activeSessionId,
        attendance_percentage: att,
        cie_marks: cieScore,
      });

      const r = res.data;
      const newRecord: StudentEligibilityRecord = {
        id: r.id,
        usn: r.usn,
        name: r.name,
        email: r.email,
        semester: r.semester,
        department: r.department,
        section: r.section,
        subjectCode: r.subject_code,
        subjectTitle: r.subject_title,
        facultyInCharge: r.facultyInCharge || selectedSub?.coordinator_name || '',
        attendancePercent: parseFloat(r.attendance_percentage || '0'),
        totalClassesHeld: r.totalClassesHeld || 40,
        classesAttended: r.classesAttended || Math.round(40 * (att / 100)),
        cieMarksAvg: parseFloat(r.cie_marks || '0'),
        status: r.is_eligible ? 'ELIGIBLE' : 'DETAINED',
        hasFeeDues: false,
        condonationApproved: false,
      };

      if (onAddStudent) {
        onAddStudent(newRecord);
      }
      toast.success(`Successfully added eligibility entry for ${usn}`);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to add entry';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
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
        maxWidth: '480px',
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
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.25)', border: '1.5px solid rgba(245, 158, 11, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b'
              }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Manual Entry</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Evaluate single student eligibility</p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#cbd5e1', cursor: 'pointer',
            }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '30px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Select Student</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                <select 
                  value={usn} 
                  onChange={e => setUsn(e.target.value)} 
                  style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: 'white', appearance: 'none' }}
                  disabled={isLoadingData}
                >
                  <option value="">-- Select a Student --</option>
                  {studentsList.map(s => (
                    <option key={s.usn || s.id} value={s.usn || s.id}>
                      {s.usn || s.id} - {s.full_name || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Select Subject</label>
              <div style={{ position: 'relative' }}>
                <BookOpen size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                <select 
                  value={subjectCode} 
                  onChange={e => setSubjectCode(e.target.value)} 
                  style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: 'white', appearance: 'none' }}
                  disabled={isLoadingData}
                >
                  <option value="">-- Select a Subject --</option>
                  {subjectsList.map(sub => (
                    <option key={sub.code} value={sub.code}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Attendance %</label>
                <div style={{ position: 'relative' }}>
                  <Percent size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  <input 
                    type="number" 
                    step="0.01"
                    value={attendance} 
                    onChange={e => setAttendance(e.target.value)} 
                    placeholder="75.0" 
                    style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>CIE Marks</label>
                <div style={{ position: 'relative' }}>
                  <TrendingUp size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                  <input 
                    type="number" 
                    step="0.01"
                    value={cie} 
                    onChange={e => setCie(e.target.value)} 
                    placeholder="40.0" 
                    style={{ width: '100%', padding: '10px 10px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                type="button" 
                onClick={onClose}
                style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Entry'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
