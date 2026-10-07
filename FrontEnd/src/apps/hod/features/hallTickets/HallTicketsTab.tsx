import React, { useState } from 'react';
import { HallTicketRecord, StudentEligibilityRecord } from '../../types';
import { Badge } from '@/components/ui/Badge';
import {
  QrCode,
  Search,
  Eye,
  CheckCircle2,
  Award,
  AlertTriangle,
  XCircle,
  BookOpen,
  Users,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { HallTicketPreviewModal } from './components/HallTicketPreviewModal';
import { BatchGenerateModal } from './components/BatchGenerateModal';
import { api } from '@/services/api';

interface HallTicketsTabProps {
  hallTickets: HallTicketRecord[];
  students: StudentEligibilityRecord[];
  onUpdateHallTickets: (updatedList: HallTicketRecord[]) => void;
}

const SEMESTER_SUBJECTS: Record<string, { code: string; title: string }[]> = {
  '3rd': [
    { code: 'CS201', title: 'Data Structures & Algorithms' },
    { code: 'MA201', title: 'Discrete Mathematical Structures' },
    { code: 'CS202', title: 'Digital Logic & Microprocessors' },
    { code: 'EC205', title: 'Analog Electronics Circuits' },
  ],
  '5th': [
    { code: 'CS301', title: 'Operating Systems & Kernel Design' },
    { code: 'CS302', title: 'Database Management Systems' },
    { code: 'CS303', title: 'Computer Networks' },
  ],
  '7th': [
    { code: 'CS401', title: 'Distributed Systems & Cloud Computing' },
    { code: 'CS402', title: 'Artificial Intelligence & Machine Learning' },
  ],
};

export const HallTicketsTab: React.FC<HallTicketsTabProps> = ({
  hallTickets,
  students,
  onUpdateHallTickets,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('ALL');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [selectedExamCycle, setSelectedExamCycle] = useState('ALL');
  const [selectedEligibility, setSelectedEligibility] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [previewingTicket, setPreviewingTicket] = useState<HallTicketRecord | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const [sessions, setSessions] = useState<{id: string, name: string, selected_slots: string[]}[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('NONE');

  React.useEffect(() => {
    const fetchSessions = async () => {
      try {
        const res = await api.get('/scheduling/sessions/');
        const data = res.data.results || res.data;
        setSessions(data);
      } catch (err) {}
    };
    fetchSessions();
  }, []);

  // Helper to look up student eligibility from students state
  const getStudentEligibility = (usn: string) => {
    return students.find(s => s.usn.toLowerCase() === usn.toLowerCase());
  };

  const handleSemesterChange = (newSem: string) => {
    setSelectedSemester(newSem);
    if (newSem !== 'ALL' && selectedSubject !== 'ALL') {
      const semSubjects = SEMESTER_SUBJECTS[newSem] || [];
      if (!semSubjects.some(s => s.code === selectedSubject)) {
        setSelectedSubject('ALL');
      }
    }
  };

  const availableSubjects = selectedSemester === 'ALL'
    ? Object.values(SEMESTER_SUBJECTS).flat()
    : SEMESTER_SUBJECTS[selectedSemester] || [];

  const filteredTickets = selectedSessionId === 'NONE' ? [] : hallTickets.filter(t => {
    // 0. Session Filter (Matches ID or Name)
    const selectedSession = sessions.find(s => s.id === selectedSessionId);
    if (selectedSession && t.examSession !== selectedSession.name && t.examSession !== selectedSession.id) return false;

    // 1. Semester filter
    if (selectedSemester !== 'ALL' && !t.semester.includes(selectedSemester)) return false;

    // 2. Exam / CIE Cycle filter
    if (selectedExamCycle !== 'ALL' && (t.examCycle || 'CIE-1') !== selectedExamCycle) return false;

    // 3. Subject filter (checks if student has slot for subject)
    if (selectedSubject !== 'ALL') {
      const hasSubject = t.slots.some(s => s.subjectCode === selectedSubject);
      if (!hasSubject) return false;
    }

    // 4. Card status filter
    if (selectedStatus === 'ACTIVE' && t.isRevoked) return false;
    if (selectedStatus === 'REVOKED' && !t.isRevoked) return false;

    // 5. Eligibility Gateway filter
    const std = getStudentEligibility(t.usn);
    if (selectedEligibility !== 'ALL') {
      if (!std) return false;
      if (selectedEligibility === 'CLEARED' && std.status !== 'ELIGIBLE') return false;
      if (selectedEligibility === 'CONDONED' && !(std.status === 'CONDONABLE' && std.condonationApproved)) return false;
      if (selectedEligibility === 'SHORTAGE' && !(std.status === 'CONDONABLE' && !std.condonationApproved)) return false;
      if (selectedEligibility === 'DETAINED' && std.status !== 'DETAINED') return false;
    }

    // 6. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesSlot = t.slots.some(s => s.subjectCode.toLowerCase().includes(q) || s.subjectTitle.toLowerCase().includes(q));
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.usn.toLowerCase().includes(q) ||
        t.studentName.toLowerCase().includes(q) ||
        matchesSlot
      );
    }
    return true;
  });

  // Telemetry counts
  const totalTickets = filteredTickets.length;
  const clearedCount = filteredTickets.filter(t => {
    const s = getStudentEligibility(t.usn);
    return s ? s.status === 'ELIGIBLE' : true;
  }).length;
  const condonedCount = filteredTickets.filter(t => {
    const s = getStudentEligibility(t.usn);
    return s?.condonationApproved;
  }).length;
  const revokedCount = filteredTickets.filter(t => t.isRevoked).length;

  const handleToggleRevocation = (ticketId: string) => {
    const updated = hallTickets.map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          isRevoked: !t.isRevoked,
          revokeReason: !t.isRevoked ? 'Revoked by HOD due to disciplinary review.' : undefined,
        };
      }
      return t;
    });
    onUpdateHallTickets(updated);
  };

  const handleBatchGenerateSuccess = (newTickets: HallTicketRecord[]) => {
    // Merge new tickets without duplicates
    const existingUsns = hallTickets.map(t => t.usn);
    const uniqueNew = newTickets.filter(t => !existingUsns.includes(t.usn));
    onUpdateHallTickets([...hallTickets, ...uniqueNew]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── Top Stat Ribbon for Hall Tickets & Gateway Correlation ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {/* Total Issued */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #E2E8F0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QrCode size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Hall Tickets</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A' }}>{totalTickets} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Cards</span></div>
          </div>
        </div>

        {/* Gateway Cleared */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #BBF7D0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Gateway Cleared (≥85%)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803D' }}>{clearedCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16A34A' }}>({totalTickets > 0 ? Math.round((clearedCount / totalTickets) * 100) : 0}%)</span></div>
          </div>
        </div>

        {/* Condoned Waivers */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #FDE68A',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#B45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condonation Waivers</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#B45309' }}>{condonedCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B45309' }}>Approved</span></div>
          </div>
        </div>

        {/* Revoked Cards */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #FECACA',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revoked / Withheld</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#B91C1C' }}>{revokedCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B91C1C' }}>Tickets</span></div>
          </div>
        </div>
      </div>

      {/* ── Multi-Parameter Filter Bar: Semester, Subject, Eligibility & Status ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        padding: '18px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            placeholder="Search Ticket No, USN, Name, or Subject..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1.5px solid var(--color-border)',
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* Semester Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Semester:</span>
            <select
              value={selectedSemester}
              onChange={e => handleSemesterChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#0F172A',
                background: '#F8FAFC',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Semesters</option>
              <option value="3rd">3rd Semester B.Tech</option>
              <option value="5th">5th Semester B.Tech</option>
              <option value="7th">7th Semester B.Tech</option>
            </select>
          </div>

          {/* Exam Schedule / Session Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={13} /> Exam Session:
            </span>
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #FCD34D',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#92400E',
                background: '#FFFBEB',
                cursor: 'pointer',
              }}
            >
              <option value="NONE">-- Select Exam Session --</option>
              {sessions.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Exam / CIE Series Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={13} /> Exam Series:
            </span>
            <select
              value={selectedExamCycle}
              onChange={e => setSelectedExamCycle(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #FCD34D',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#92400E',
                background: '#FFFBEB',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Exam Series (SEE Final)</option>
              <option value="SEE_FINAL">Semester End Final Examination (SEE)</option>
            </select>
          </div>

          {/* Subject Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookOpen size={13} /> Subject:
            </span>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #A5B4FC',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#1E1B4B',
                background: '#EEF2FF',
                cursor: 'pointer',
                maxWidth: '240px',
              }}
            >
              <option value="ALL">
                {selectedSemester === 'ALL' ? 'All Subjects Across Department' : `All ${selectedSemester} Sem Subjects`}
              </option>
              {availableSubjects.map(sub => (
                <option key={sub.code} value={sub.code}>
                  {sub.code}: {sub.title}
                </option>
              ))}
            </select>
          </div>

          {/* Eligibility Clearance Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> Gateway:
            </span>
            <select
              value={selectedEligibility}
              onChange={e => setSelectedEligibility(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #BBF7D0',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#14532D',
                background: '#F0FDF4',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Gateway Statuses</option>
              <option value="CLEARED">Gate Cleared (≥85% Attendance)</option>
              <option value="CONDONED">Condoned Waivers Approved</option>
              <option value="SHORTAGE">Shortage / Warning</option>
              <option value="DETAINED">Detained / Non-Eligible</option>
            </select>
          </div>

          {/* Card Status */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#0F172A',
              background: '#F8FAFC',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Card Statuses</option>
            <option value="ACTIVE">Active Admit Cards</option>
            <option value="REVOKED">Revoked Cards</option>
          </select>

          {/* Batch Generate Action */}
          <button
            onClick={() => setIsBatchModalOpen(true)}
            style={{
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(72,151,127,0.3)',
              whiteSpace: 'nowrap'
            }}
          >
            <QrCode size={15} /> Batch Generate Hall Tickets
          </button>
        </div>
      </div>

      {/* ── Hall Tickets Table with Eligibility Gateway Column ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
              Issued Examination Hall Tickets ({filteredTickets.length} Admit Cards)
            </span>
            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
              Cross-verified with Student Attendance & CIE Marks Eligibility Gateway
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Digitally Signed with Tamper-Evident QR Code
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead style={{ background: '#f8fafc', color: 'var(--color-text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '14px 20px' }}>ADMIT TICKET NO</th>
                <th style={{ padding: '14px 16px' }}>STUDENT USN & NAME</th>
                <th style={{ padding: '14px 16px' }}>SEMESTER</th>
                <th style={{ padding: '14px 16px' }}>EXAM / CIE TARGET</th>
                <th style={{ padding: '14px 16px' }}>ELIGIBILITY GATEWAY STATUS</th>
                <th style={{ padding: '14px 16px' }}>SCHEDULED SUBJECT SLOTS</th>
                <th style={{ padding: '14px 16px' }}>QR INTEGRITY</th>
                <th style={{ padding: '14px 16px' }}>ADMIT STATUS</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontSize: '0.88rem' }}>
                    No examination hall tickets found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(ticket => {
                  const student = getStudentEligibility(ticket.usn);

                  return (
                    <tr key={ticket.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                      {/* Ticket Number */}
                      <td style={{ padding: '14px 20px', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                        {ticket.ticketNumber}
                      </td>

                      {/* Student Details */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{ticket.studentName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{ticket.usn}</div>
                      </td>

                      {/* Semester */}
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                        {ticket.semester}
                      </td>

                      {/* Exam / CIE Series Target */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: ticket.examCycle === 'SEE_FINAL' ? '#DCFCE7' : ticket.examCycle === 'CIE-2' ? '#FEF3C7' : '#EEF2FF',
                          color: ticket.examCycle === 'SEE_FINAL' ? '#15803D' : ticket.examCycle === 'CIE-2' ? '#B45309' : '#4F46E5',
                          fontWeight: 900,
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-block',
                          letterSpacing: '0.5px'
                        }}>
                          {ticket.examCycle || 'CIE-1'}
                        </span>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px', whiteSpace: 'nowrap' }}>
                          {ticket.examCycle === 'SEE_FINAL' ? 'End Semester Final' : ticket.examCycle === 'CIE-2' ? 'Mid-Term Test 2' : 'Internal Test 1'}
                        </div>
                      </td>

                      {/* Eligibility Gateway Status Column */}
                      <td style={{ padding: '14px 16px' }}>
                        {student ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontWeight: 800,
                                fontSize: '0.78rem',
                                color: student.attendancePercent >= 75 ? '#15803D' : student.attendancePercent >= 65 ? '#D97706' : '#DC2626'
                              }}>
                                {student.attendancePercent}% Att.
                              </span>
                              <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
                                • CIE: <strong>{student.cieMarksAvg}/50</strong>
                              </span>
                            </div>

                            {student.status === 'ELIGIBLE' && (
                              <Badge variant="success">GATE CLEARED (≥85%)</Badge>
                            )}
                            {student.status === 'CONDONABLE' && (
                              student.condonationApproved ? (
                                <Badge variant="success">CONDONED BY HOD ✓</Badge>
                              ) : (
                                <Badge variant="warning">⚠️ CONDONATION PENDING</Badge>
                              )
                            )}
                            {student.status === 'DETAINED' && (
                              <Badge variant="danger">⛔ DETAINED (&lt;65%)</Badge>
                            )}
                            {student.status === 'FEE_BLOCKED' && (
                              <Badge variant="danger">⛔ FEE BLOCKED</Badge>
                            )}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.75rem', color: '#15803D', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={13} /> Cleared Gateway
                            </span>
                            <Badge variant="success">VERIFIED ELIGIBLE</Badge>
                          </div>
                        )}
                      </td>

                      {/* Scheduled Subject Slots */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '240px' }}>
                          {ticket.slots.map(s => (
                            <span
                              key={s.subjectCode}
                              title={`${s.subjectTitle} • ${s.examDate} (${s.roomAllocated})`}
                              style={{
                                background: selectedSubject === s.subjectCode ? '#4F46E5' : '#EEF2FF',
                                color: selectedSubject === s.subjectCode ? 'white' : '#4F46E5',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                fontFamily: 'monospace'
                              }}
                            >
                              {s.subjectCode}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '3px' }}>
                          {ticket.slots.length} Examination Papers
                        </div>
                      </td>

                      {/* QR Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}>
                          <QrCode size={11} /> Verified QR
                        </span>
                      </td>

                      {/* Admit Status */}
                      <td style={{ padding: '14px 16px' }}>
                        {ticket.isRevoked ? (
                          <Badge variant="danger">REVOKED</Badge>
                        ) : (
                          <Badge variant="success">ACTIVE ADMIT</Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => setPreviewingTicket(ticket)}
                            style={{
                              padding: '6px 12px',
                              background: '#f8fafc',
                              border: '1.5px solid var(--color-border)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Eye size={12} /> View Card
                          </button>

                          <button
                            onClick={() => handleToggleRevocation(ticket.id)}
                            style={{
                              padding: '6px 10px',
                              background: ticket.isRevoked ? '#ecfdf5' : '#fff1f2',
                              border: `1px solid ${ticket.isRevoked ? '#a7f3d0' : '#fecdd3'}`,
                              color: ticket.isRevoked ? '#059669' : '#e11d48',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {ticket.isRevoked ? 'Restore' : 'Revoke'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hall Ticket Preview Modal */}
      {previewingTicket && (
        <HallTicketPreviewModal
          ticket={previewingTicket}
          onClose={() => setPreviewingTicket(null)}
        />
      )}

      {/* Batch Generator Modal */}
      {isBatchModalOpen && (
        <BatchGenerateModal
          students={students}
          sessions={sessions}
          onBatchGenerateSuccess={handleBatchGenerateSuccess}
          onClose={() => setIsBatchModalOpen(false)}
        />
      )}
    </div>
  );
};
