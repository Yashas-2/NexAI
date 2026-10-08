import React, { useState } from 'react';
import { StudentEligibilityRecord, HallTicketRecord, ExamCycleType, TimetableSlot } from '../../../types';
import { X, QrCode, Cpu, ShieldCheck } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface BatchGenerateModalProps {
  students: StudentEligibilityRecord[];
  sessions?: {id: string, name: string}[];
  onBatchGenerateSuccess: (newTickets: HallTicketRecord[]) => void;
  onClose: () => void;
}

export const BatchGenerateModal: React.FC<BatchGenerateModalProps> = ({
  students,
  sessions = [],
  onBatchGenerateSuccess,
  onClose,
}) => {
  const [targetSemester, setTargetSemester] = useState<string>('ALL');
  const [targetExamCycle] = useState<ExamCycleType>('SEE_FINAL');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('NONE');
  const [isGenerating, setIsGenerating] = useState(false);

  // Hall tickets are issued only for Semester End (SEE) sessions
  const seeSessions = sessions.filter(s => /SEE|SEMESTER END/i.test(s.name || ''));
  const sessionOptions = seeSessions.length > 0 ? seeSessions : sessions;

  React.useEffect(() => {
    if (selectedSessionId !== 'NONE') return;
    const see = sessionOptions.find(s => /SEE|SEMESTER END/i.test(s.name || '')) || sessionOptions[0];
    if (see) setSelectedSessionId(see.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  // Group student eligibility records by USN and evaluate subject-by-subject eligibility
  const studentMap = new Map<string, { usn: string; name: string; semester: string; subjects: StudentEligibilityRecord[] }>();

  students.forEach(s => {
    if (targetSemester !== 'ALL') {
      const studentSemDigit = (s.semester || '').match(/\d+/)?.[0];
      const targetSemDigit = targetSemester.match(/\d+/)?.[0];
      if (studentSemDigit && targetSemDigit && studentSemDigit !== targetSemDigit) return;
    }

    const key = s.usn.toLowerCase().trim();
    const existing = studentMap.get(key) || { usn: s.usn, name: s.name, semester: s.semester, subjects: [] };
    existing.subjects.push(s);
    studentMap.set(key, existing);
  });

  interface CandidateTicketPlan {
    usn: string;
    name: string;
    semester: string;
    eligibleSubjects: StudentEligibilityRecord[];
    totalSubjectsCount: number;
    barredSubjectsCount: number;
  }

  const qualifiedCandidates: CandidateTicketPlan[] = [];

  studentMap.forEach(st => {
    const clearedSubs = st.subjects.filter(sub => {
      // Backend already applies the full gate (85% attendance, fee, 12/30 or 20/50 CIE)
      const isCleared = sub.status === 'ELIGIBLE' || (sub.status === 'CONDONABLE' && sub.condonationApproved);
      if (!isCleared) return false;
      if (sub.status === 'FEE_BLOCKED' || sub.hasFeeDues) return false;
      return true;
    });

    const barredCount = st.subjects.length - clearedSubs.length;

    // Student receives a Hall Ticket IF they are eligible for AT LEAST 1 subject
    if (clearedSubs.length > 0) {
      qualifiedCandidates.push({
        usn: st.usn,
        name: st.name,
        semester: st.semester,
        eligibleSubjects: clearedSubs,
        totalSubjectsCount: st.subjects.length,
        barredSubjectsCount: barredCount
      });
    }
  });

  const handleGenerateBatch = async () => {
    if (selectedSessionId === 'NONE') {
      toast.error('Please select an Exam Session before generating tickets');
      return;
    }
    
    setIsGenerating(true);
    
    try {
      const response = await api.post(`/eligibility/generate-hall-tickets/${selectedSessionId}/`);
      const result = response.data.result || {};

      if (result.status === 'error') {
        toast.error(result.message || 'Failed to generate hall tickets.');
        return;
      }
      if (result.generated_count > 0) {
        toast.success(`${result.generated_count} hall ticket(s) generated.`);
      } else {
        toast.success(response.data.message || 'Hall tickets already exist for all eligible students.');
      }
      
      // Since it's async queued or we need the actual tickets, we could either:
      // A: Wait for a webhook/poll
      // B: Just close and let the parent re-fetch
      onBatchGenerateSuccess([]); // We'll rely on the parent to re-fetch via useEffect if needed, but for now we pass empty as the task is async
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate hall tickets.');
    } finally {
      setIsGenerating(false);
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
        maxWidth: '620px',
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
                background: 'rgba(72, 151, 127, 0.25)',
                border: '1.5px solid rgba(72, 151, 127, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#48977f'
              }}>
                <QrCode size={22} />
              </div>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Cryptographic Batch Issuance
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  Batch Generate Hall Tickets
                </h3>
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
        <div style={{ padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Target Examination Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
              Target Examination Series:
            </label>
            <div style={{
              padding: '14px 18px',
              borderRadius: '12px',
              border: '2px solid #4F46E5',
              background: '#EEF2FF',
              color: '#4338CA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>
                  Semester End Examination (SEE Final)
                </div>
                <div style={{ fontSize: '0.74rem', color: '#6366F1', marginTop: '2px' }}>
                  Admit Cards / Hall Tickets are generated exclusively for Semester End Final Examinations. Internal Tests (CIE-1 & CIE-2) do not issue Hall Tickets.
                </div>
              </div>
              <span style={{
                background: '#4F46E5',
                color: 'white',
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '4px 10px',
                borderRadius: '6px',
                whiteSpace: 'nowrap'
              }}>
                SEE FINAL
              </span>
            </div>
          </div>

          {/* Gateway Eligibility Rule for SEE Final */}
          <div style={{
            background: '#F0FDF4',
            border: '1.5px solid #BBF7D0',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '0.75rem',
            color: '#14532D',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldCheck size={18} />
            <span>
              <strong>Gate Rule for SEE Final Examination:</strong>{' '}
              Requires minimum 85% Attendance (or approved condonation waiver), cleared fee dues, AND minimum 12/30 (40%) or 20/50 (40%) CIE Score.
            </span>
          </div>

          {/* Scope Configuration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Select Target Exam Session:
              </label>
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="NONE">-- Select Exam Session --</option>
                {sessionOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Select Target Semester Cohort:
              </label>
              <select
                value={targetSemester}
                onChange={e => setTargetSemester(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="ALL">All Eligible Semesters (3rd, 5th, 7th)</option>
                <option value="3rd Sem">3rd Semester B.Tech</option>
                <option value="5th Sem">5th Semester B.Tech</option>
                <option value="7th Sem">7th Semester B.Tech</option>
              </select>
            </div>
          </div>

          {/* Telemetry Summary */}
          <div style={{ background: '#f8fafc', padding: '16px 18px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Eligible Candidates Found</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>
                {qualifiedCandidates.length} Students Qualified
              </div>
            </div>

            <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '12px', fontWeight: 700 }}>
              Subject-Level Clearance Active ✓
            </span>
          </div>

          {/* Candidates Passing Gateway Preview */}
          <div style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            overflow: 'hidden',
            maxHeight: '160px',
            overflowY: 'auto'
          }}>
            <div style={{ background: '#f8fafc', padding: '8px 12px', fontSize: '0.72rem', fontWeight: 800, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
              GATEWAY QUALIFIED CANDIDATES ROSTER ({qualifiedCandidates.length})
            </div>
            {qualifiedCandidates.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                No students qualify under the current semester criteria.
              </div>
            ) : (
              qualifiedCandidates.map(c => (
                <div key={c.usn} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem' }}>
                  <div>
                    <strong style={{ fontFamily: 'monospace', color: '#1E293B' }}>{c.usn}</strong> - {c.name} ({c.semester})
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ background: '#DCFCE7', color: '#15803D', padding: '1px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 800 }}>
                      Cleared {c.eligibleSubjects.length} {c.barredSubjectsCount > 0 ? `(${c.barredSubjectsCount} Barred)` : 'Courses'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '10px', border: '1px solid #bfdbfe', fontSize: '0.75rem', color: '#1e40af', lineHeight: 1.5 }}>
            🛡️ <strong>Issuance Protocol:</strong> Generating hall tickets digitally signs each candidate's admit card with the HOD seal, embeds an encrypted verification QR code, and makes the ticket instantly downloadable on the Student Portal.
          </div>
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
            onClick={handleGenerateBatch}
            disabled={isGenerating || qualifiedCandidates.length === 0}
            style={{
              padding: '10px 24px',
              background: qualifiedCandidates.length > 0 ? 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)' : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: qualifiedCandidates.length > 0 ? (isGenerating ? 'wait' : 'pointer') : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: qualifiedCandidates.length > 0 ? '0 4px 14px rgba(72,151,127,0.35)' : 'none',
            }}
          >
            {isGenerating ? <><Cpu size={16} className="animate-spin" /> Signing & Generating Admit Cards...</> : <><QrCode size={16} /> Batch Issue {qualifiedCandidates.length} Hall Tickets</>}
          </button>
        </div>
      </div>
    </div>
  );
};
