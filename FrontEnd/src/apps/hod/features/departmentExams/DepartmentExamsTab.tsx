import React, { useState } from 'react';
import {
  DepartmentExamSession,
  CourseRecord,
  FacultyMember,
  ExamHall,
  AllocatedSeat,
  FacultyDutyAllocation
} from '../../types';
import { Badge } from '@/components/ui/Badge';
import {
  Calendar,
  Clock,
  Building,
  Users,
  UserCheck,
  Plus,
  Printer,
  Copy,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  BookOpen,
  FileText,
  Sparkles,
  Zap,
  Grid
} from 'lucide-react';
import { api } from '@/services/api';
import { CreateDepartmentExamModal } from './components/CreateDepartmentExamModal';
import { FacultyDutyChartModal } from './components/FacultyDutyChartModal';
import { AISeatingEngineModal } from './components/AISeatingEngineModal';
import toast from 'react-hot-toast';

interface Props {
  sessions: DepartmentExamSession[];
  courses: CourseRecord[];
  facultyMembers: FacultyMember[];
  halls: ExamHall[];
  allocatedSeats: AllocatedSeat[];
  facultyDuties: FacultyDutyAllocation[];
  students: any[]; // Or StudentEligibilityRecord[] if imported
  onUpdateSessions: (sessions: DepartmentExamSession[]) => void;
}

export const DepartmentExamsTab: React.FC<Props> = ({
  sessions,
  courses,
  facultyMembers,
  halls,
  allocatedSeats,
  facultyDuties,
  students,
  onUpdateSessions,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDutyChartOpen, setIsDutyChartOpen] = useState(false);
  const [isAISeatingOpen, setIsAISeatingOpen] = useState(false);
  const [selectedSessionForSeating, setSelectedSessionForSeating] = useState<DepartmentExamSession | null>(null);

  const [generatingTaskId, setGeneratingTaskId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Polling effect: only used if backend returns an async task_id (future Celery support)
  React.useEffect(() => {
    if (!generatingTaskId || generatingTaskId.startsWith('sync-')) return;
    const interval = setInterval(() => {
      api.get(`/scheduling/timetable/status/${generatingTaskId}/`)
        .then(res => {
          if (res.data.ready) {
            if (res.data.status === 'SUCCESS' && res.data.result?.success) {
              toast.success(`Timetable scheduled by AI solver in ${res.data.result.wall_time_secs}s!`);
              setTimeout(() => window.location.reload(), 1500);
            } else {
              toast.error(res.data.result?.error || 'Solver failed to find a valid schedule.');
            }
            setGeneratingTaskId(null);
          }
        })
        .catch(err => console.error(err));
    }, 2000);
    return () => clearInterval(interval);
  }, [generatingTaskId]);

  const filteredSessions = filterType === 'ALL'
    ? sessions
    : sessions.filter(s => s.examType === filterType);

  const totalStudentsScheduled = sessions.reduce((acc, s) => acc + s.totalStudentsExpected, 0);
  const uniqueRooms = Array.from(new Set(sessions.flatMap(s => s.roomsAllocated))).length;

  const handleCreateSessions = (newSessions: DepartmentExamSession[]) => {
    onUpdateSessions([...newSessions, ...sessions]);
  };

  const handleCopyKey = (key?: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    toast.success(`Evaluator Session Key (${key}) copied!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── Top Telemetry Stat Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Scheduled Exam Events
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {sessions.length} Sessions
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
            CIE-1, CIE-2 & Practical Labs
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Faculty on Duty
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#ECFDF5', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {sessions.length * 3} Duties
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Setters, Invigilators & Evaluators
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Examination Halls
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {uniqueRooms} Rooms
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Halls & Computing Labs Booked
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Enrolled Candidates
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {totalStudentsScheduled} Students
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Batches & Sections Allocated
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px' }}></div>

      {/* ── Action Bar & Filters ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        background: 'white',
        padding: '14px 20px',
        borderRadius: '14px',
        border: '1.5px solid #E2E8F0',
      }}>
        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#64748B', marginRight: '6px' }}>Filter:</span>
          {[
            { id: 'ALL', label: 'All Exams' },
            { id: 'CIE-1', label: 'CIE-1' },
            { id: 'CIE-2', label: 'CIE-2' },
            { id: 'LAB_INTERNAL', label: 'Lab Practicals' },
            { id: 'SEE_THEORY', label: 'SEE Theory' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                padding: '5px 12px',
                borderRadius: '8px',
                border: filterType === f.id ? '1.5px solid #4F46E5' : '1px solid #CBD5E1',
                background: filterType === f.id ? '#EEF2FF' : 'white',
                color: filterType === f.id ? '#4F46E5' : '#475569',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsDutyChartOpen(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '9px',
              border: '1px solid #CBD5E1',
              background: 'white',
              color: '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
            }}
          >
            <Printer size={15} /> View & Print Duty Chart
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            style={{
              padding: '8px 18px',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: 'white',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79,70,229,0.25)',
            }}
          >
            <Plus size={16} /> Schedule Examination Session
          </button>
        </div>
      </div>

      {/* ── Examination Sessions Master Table ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0F172A' }}>
              Active Department Examination Schedule & Duty Allotment
            </h4>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: '#64748B' }}>
              Comprehensive operational overview of time slots, room allocation, student cohorts, and assigned faculty
            </p>
          </div>
          <span style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={14} /> Official Department Records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead style={{ background: '#F8FAFC', color: '#475569', fontWeight: 800, borderBottom: '1px solid #CBD5E1' }}>
              <tr>
                <th style={{ padding: '14px 18px' }}>Exam Event & Course</th>
                <th style={{ padding: '14px 16px' }}>Date & Timetable</th>
                <th style={{ padding: '14px 16px' }}>Halls & Cohort</th>
                <th style={{ padding: '14px 16px' }}>Appointed Faculty Roles</th>
                <th style={{ padding: '14px 16px' }}>Evaluator Session Key</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'right' }}>Room Seating & Notice</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => (
                <tr key={session.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  
                  {/* Exam & Course */}
                  <td style={{ padding: '14px 18px' }}>
                    <span style={{
                      background: session.examType === 'CIE-1' ? '#EEF2FF' : session.examType === 'CIE-2' ? '#F3E8FF' : '#FEF3C7',
                      color: session.examType === 'CIE-1' ? '#4F46E5' : session.examType === 'CIE-2' ? '#9333EA' : '#B45309',
                      padding: '2px 7px',
                      borderRadius: '5px',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      display: 'inline-block',
                      marginBottom: '4px',
                    }}>
                      {session.examType}
                    </span>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                      {session.subjectCode}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                      {session.subjectTitle}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '2px' }}>
                      {session.semester}
                    </div>
                  </td>

                  {/* Date & Timetable */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={13} color="#4F46E5" /> {session.examDate}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {session.timeSlot}
                    </div>
                  </td>

                  {/* Halls & Cohort */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Building size={13} color="#D97706" /> {session.roomsAllocated.join(', ')}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#16A34A', fontWeight: 700, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} /> {session.totalStudentsExpected} Students
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
                      {session.studentBatches.join(' • ')}
                    </div>
                  </td>

                  {/* Faculty Appointments */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Setter: </span>
                      <strong style={{ color: '#0F172A' }}>{session.paperSetterName}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', marginBottom: '3px' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Invigilator: </span>
                      <strong style={{ color: '#0F172A' }}>{session.chiefInvigilatorName}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Evaluator: </span>
                      <strong style={{ color: '#0F172A' }}>{session.evaluatorName}</strong>
                    </div>
                  </td>

                  {/* Evaluator Session Key */}
                  <td style={{ padding: '14px 16px' }}>
                    {session.evaluatorSessionKey ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <code style={{
                          background: '#F1F5F9',
                          color: '#4F46E5',
                          padding: '3px 7px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          border: '1px solid #E2E8F0',
                        }}>
                          {session.evaluatorSessionKey}
                        </code>
                        <button
                          onClick={() => handleCopyKey(session.evaluatorSessionKey)}
                          title="Copy Key"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#64748B',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>No Key Generated</span>
                    )}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    {session.status === 'DRAFT' && <Badge variant="warning">DRAFT (Awaiting Generation)</Badge>}
                    {session.status === 'SCHEDULED' && <Badge variant="neutral">SCHEDULED</Badge>}
                    {session.status === 'FACULTY_APPOINTED' && <Badge variant="info">FACULTY APPOINTED</Badge>}
                    {session.status === 'QP_APPROVED' && <Badge variant="success">QP VERIFIED ✓</Badge>}
                    {session.status === 'IN_PROGRESS' && <Badge variant="warning">CONDUCTION ACTIVE</Badge>}
                    {session.status === 'COMPLETED' && <Badge variant="success">COMPLETED</Badge>}
                  </td>

                  {/* Room Seating & Notice for THIS specific exam */}
                  <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                      {session.status === 'DRAFT' ? (
                        <button
                          disabled={!!generatingTaskId || isGenerating}
                          onClick={async () => {
                            setIsGenerating(true);
                            const loadingToast = toast.loading('Running AI Timetable Solver...');
                            try {
                              const res = await api.post('/scheduling/timetable/generate/', {
                                exam_session_id: session.id,
                                time_limit_secs: 60,
                              });
                              // Synchronous path: solver finished, result is already in the response
                              if (res.data.sync && res.data.result?.success) {
                                toast.success(
                                  `Timetable generated in ${res.data.result.wall_time_secs}s — ${res.data.result.slots_created} slot(s) created!`,
                                  { id: loadingToast, duration: 4000 }
                                );
                                setTimeout(() => window.location.reload(), 1500);
                              } else {
                                // Async path (future Celery): poll for completion
                                toast.success('Solver started, waiting for result...', { id: loadingToast });
                                setGeneratingTaskId(res.data.task_id);
                              }
                            } catch (err: any) {
                              toast.error(
                                err.response?.data?.error || 'Failed to run AI generator',
                                { id: loadingToast }
                              );
                            } finally {
                              setIsGenerating(false);
                            }
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: (generatingTaskId || isGenerating) ? '#94A3B8' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                            color: 'white',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: (generatingTaskId || isGenerating) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: (generatingTaskId || isGenerating) ? 'none' : '0 2px 4px rgba(16,185,129,0.3)',
                          }}
                        >
                          <Zap size={14} /> {isGenerating ? 'Solver Running...' : generatingTaskId ? 'Awaiting Result...' : 'Run AI Generator'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSessionForSeating(session);
                            setIsAISeatingOpen(true);
                          }}
                          title="Open Room Door Seating Grid & Notice Board for this scheduled exam"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #4F46E5',
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(79,70,229,0.12)',
                          }}
                        >
                          <Grid size={13} /> Seating & Notice
                        </button>
                      )}
                      
                      <button
                        onClick={async () => {
                          if (!window.confirm('Are you sure you want to delete this session?')) return;
                          try {
                            await api.delete(`/scheduling/sessions/${session.id}/`);
                            toast.success('Session deleted successfully');
                            onUpdateSessions(sessions.filter(s => s.id !== session.id));
                          } catch (err: any) {
                            toast.error('Failed to delete session');
                          }
                        }}
                        style={{
                          background: 'transparent',
                          color: '#EF4444',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Delete Session
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isCreateOpen && (
        <CreateDepartmentExamModal
          courses={courses}
          facultyMembers={facultyMembers}
          halls={halls}
          onClose={() => setIsCreateOpen(false)}
          onCreateSessions={handleCreateSessions}
        />
      )}

      {isDutyChartOpen && (
        <FacultyDutyChartModal
          sessions={sessions}
          onClose={() => setIsDutyChartOpen(false)}
        />
      )}

      {isAISeatingOpen && (
        <AISeatingEngineModal
          halls={halls}
          courses={courses}
          facultyMembers={facultyMembers}
          allocatedSeats={allocatedSeats}
          facultyDuties={facultyDuties}
          students={students}
          targetSession={selectedSessionForSeating}
          sessions={sessions}
          onClose={() => {
            setIsAISeatingOpen(false);
            setSelectedSessionForSeating(null);
          }}
        />
      )}

    </div>
  );
};
