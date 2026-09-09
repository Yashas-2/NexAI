import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Search, UserPlus, BookOpen, CheckCircle, AlertTriangle } from 'lucide-react';

interface Subject {
  id: string;
  code: string;
  name: string;
  semester: number;
}

interface Student {
  id: string;
  full_name: string;
  email: string;
  student_profile?: {
    usn: string;
    semester: number;
    section: string;
  };
}

export const StudentEnrollmentTab: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [sessionOptions, setSessionOptions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load subjects for HOD department
    api.get('/scheduling/subjects/').then(res => setSubjects(res.data.results || res.data)).catch(console.error);
    api.get('/scheduling/sessions/').then(res => setSessionOptions(res.data.results || res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedSubject && selectedSession) {
      fetchEnrollments();
      fetchAvailableStudents();
    }
  }, [selectedSubject, selectedSession]);

  const fetchEnrollments = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/scheduling/subjects/${selectedSubject}/students/`);
      const allEnrolled = res.data.results || res.data;
      // Filter for this session locally if API returns all
      setEnrolledStudents(allEnrolled.filter((e: any) => e.exam_session === selectedSession));
    } catch (err) {
      toast.error('Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableStudents = async () => {
    try {
      const subj = subjects.find(s => s.id === selectedSubject);
      if (!subj) return;
      
      const res = await api.get(`/auth/users/?role=STUDENT`);
      const allStudents = res.data.results || res.data;
      
      // Filter students who are matching semester and NOT already enrolled
      const enrolledIds = enrolledStudents.map((e: any) => e.student);
      const eligible = allStudents.filter((s: any) => 
        s.semester === subj.semester && 
        !enrolledIds.includes(s.id)
      );
      setAvailableStudents(eligible);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEnroll = async (studentId: string, usn: string) => {
    try {
      await api.post(`/scheduling/subjects/${selectedSubject}/enroll/`, {
        usn: usn,
        exam_session_id: selectedSession
      });
      toast.success('Student enrolled successfully');
      fetchEnrollments();
      fetchAvailableStudents();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to enroll student');
    }
  };

  const handleBulkEnroll = async () => {
    if (availableStudents.length === 0) return;
    const toastId = toast.loading(`Enrolling ${availableStudents.length} students...`);
    let successCount = 0;
    
    // Simplistic bulk enroll loop (could be optimized with a real bulk endpoint)
    for (const student of availableStudents) {
      try {
        await api.post(`/scheduling/subjects/${selectedSubject}/enroll/`, {
          usn: student.usn,
          exam_session_id: selectedSession
        });
        successCount++;
      } catch (err) {}
    }
    
    toast.success(`Enrolled ${successCount} students`, { id: toastId });
    fetchEnrollments();
    fetchAvailableStudents();
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 0, color: '#1e293b' }}>
        <BookOpen size={24} color="#4F46E5" /> Course Enrollment Management
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Select Subject</label>
          <select 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          >
            <option value="">-- Choose Subject --</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name} (Sem {s.semester})</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>Select Exam Session</label>
          <select 
            value={selectedSession} 
            onChange={e => setSelectedSession(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #cbd5e1' }}
          >
            <option value="">-- Choose Session --</option>
            {sessionOptions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.academic_year})</option>)}
          </select>
        </div>
      </div>

      {selectedSubject && selectedSession ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Enrolled Students */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <span>Enrolled Students</span>
              <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem' }}>{enrolledStudents.length}</span>
            </div>
            <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
              {loading ? <div>Loading...</div> : enrolledStudents.length === 0 ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No students enrolled</div> : (
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <tbody>
                    {enrolledStudents.map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 0', fontWeight: 600 }}>{e.student_usn}</td>
                        <td style={{ padding: '10px 0', color: '#475569' }}>{e.student_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Available Students */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', padding: '12px 16px', fontWeight: 700, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Available to Enroll</span>
              <button 
                onClick={handleBulkEnroll}
                disabled={availableStudents.length === 0}
                style={{ background: '#10b981', color: 'white', border: 'none', padding: '4px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: availableStudents.length > 0 ? 'pointer' : 'not-allowed', opacity: availableStudents.length > 0 ? 1 : 0.5 }}
              >
                Enroll All Eligible
              </button>
            </div>
            <div style={{ padding: 16, maxHeight: 400, overflowY: 'auto' }}>
              {availableStudents.length === 0 ? <div style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No matching students found</div> : (
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <tbody>
                    {availableStudents.map((s: any) => (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 0', fontWeight: 600 }}>{s.usn}</td>
                        <td style={{ padding: '10px 0', color: '#475569' }}>{s.full_name}</td>
                        <td style={{ padding: '10px 0', textAlign: 'right' }}>
                          <button 
                            onClick={() => handleEnroll(s.id, s.usn)}
                            style={{ background: 'transparent', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5' }}
                          >
                            Enroll
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <AlertTriangle size={32} style={{ opacity: 0.5, marginBottom: 12 }} />
          <div>Please select both a subject and an exam session to manage enrollments.</div>
        </div>
      )}
    </div>
  );
};
