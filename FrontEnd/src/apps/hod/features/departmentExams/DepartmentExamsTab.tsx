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
import { EditExamSessionModal } from './components/EditExamSessionModal';
import { FacultyDutyChartModal } from './components/FacultyDutyChartModal';
import { AISeatingEngineModal } from './components/AISeatingEngineModal';
import toast from 'react-hot-toast';
import './DepartmentExamsTab.css';

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
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<DepartmentExamSession | null>(null);

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

  const filteredSessions = sessions.filter(s => {
    return filterType === 'ALL' || s.examType === filterType;
  });

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
    <div className={`dept-exam-container ${isAISeatingOpen ? 'hide-children-on-print' : ''}`}>
      
      {/* ── Top Telemetry Stat Cards ── */}
      <div className="stat-cards-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Scheduled Exam Events</span>
            <div className="stat-card-icon" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div className="stat-card-value">{sessions.length} Sessions</div>
          <div className="stat-card-subtitle" style={{ color: '#16A34A' }}>CIE-1, CIE-2 & Practical Labs</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Faculty on Duty</span>
            <div className="stat-card-icon" style={{ background: '#ECFDF5', color: '#16A34A' }}>
              <UserCheck size={20} />
            </div>
          </div>
          <div className="stat-card-value">{sessions.length * 3} Duties</div>
          <div className="stat-card-subtitle" style={{ color: '#64748B' }}>Setters, Invigilators & Evaluators</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Examination Halls</span>
            <div className="stat-card-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <Building size={20} />
            </div>
          </div>
          <div className="stat-card-value">{uniqueRooms} Rooms</div>
          <div className="stat-card-subtitle" style={{ color: '#64748B' }}>Halls & Computing Labs Booked</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-card-title">Enrolled Candidates</span>
            <div className="stat-card-icon" style={{ background: '#F3E8FF', color: '#9333EA' }}>
              <Users size={20} />
            </div>
          </div>
          <div className="stat-card-value">{totalStudentsScheduled} Students</div>
          <div className="stat-card-subtitle" style={{ color: '#64748B' }}>Batches & Sections Allocated</div>
        </div>
      </div>

      {/* ── Action Bar & Filters ── */}
      <div className="action-bar">
        <div className="filter-chips">
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#64748B' }}>Filter:</span>
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
              className={`filter-chip ${filterType === f.id ? 'active' : 'inactive'}`}
            >
              {f.label}
            </button>
          ))}

        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setIsDutyChartOpen(true)} className="action-btn secondary">
            <Printer size={16} /> View & Print Duty Chart
          </button>
          <button onClick={() => setIsCreateOpen(true)} className="action-btn primary">
            <Plus size={18} /> Schedule Examination Session
          </button>
        </div>
      </div>

      {/* ── Examination Sessions Master Table ── */}
      <div className="exam-table-container">
        <div className="exam-table-header">
          <div>
            <h4 className="exam-table-title">Active Department Examination Schedule & Duty Allotment</h4>
            <p className="exam-table-subtitle">Comprehensive operational overview of time slots, room allocation, student cohorts, and assigned faculty</p>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> Official Department Records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="exam-table">
            <thead>
              <tr>
                <th>Exam Event & Course</th>
                <th>Date & Timetable</th>
                <th>Halls & Cohort</th>
                <th>Appointed Faculty Roles</th>
                <th>Evaluator Session Key</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Room Seating & Notice</th>
              </tr>
            </thead>
            <tbody>
              {filteredSessions.map(session => (
                <tr key={session.id}>
                  
                  {/* Exam & Course */}
                  <td>
                    <span style={{
                      background: session.examType === 'CIE-1' ? '#EEF2FF' : session.examType === 'CIE-2' ? '#F3E8FF' : '#FEF3C7',
                      color: session.examType === 'CIE-1' ? '#4F46E5' : session.examType === 'CIE-2' ? '#9333EA' : '#B45309',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      display: 'inline-block',
                      marginBottom: '8px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      {session.examType}
                    </span>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                      {session.subjectCode}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: '2px', fontWeight: 600 }}>
                      {session.subjectTitle}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '4px' }}>
                      {session.semester}
                    </div>
                  </td>

                  {/* Date & Timetable */}
                  <td>
                    <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <Calendar size={14} color="#4F46E5" /> {session.examDate}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <Clock size={14} /> {session.timeSlot}
                    </div>
                  </td>

                  {/* Halls & Cohort */}
                  <td>
                    <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                      <Building size={14} color="#D97706" /> {session.roomsAllocated.join(', ')}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#16A34A', fontWeight: 700, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={14} /> {session.totalStudentsExpected} Students
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '4px' }}>
                      {session.studentBatches.join(' • ')}
                    </div>
                  </td>

                  {/* Faculty Appointments */}
                  <td>
                    <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Setter: </span>
                      <strong style={{ color: '#0F172A' }}>{session.paperSetterName}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem', marginBottom: '6px' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Invigilator: </span>
                      <strong style={{ color: '#0F172A' }}>{session.chiefInvigilatorName}</strong>
                    </div>
                    <div style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Evaluator: </span>
                      <strong style={{ color: '#0F172A' }}>{session.evaluatorName}</strong>
                    </div>
                  </td>

                  {/* Evaluator Session Key */}
                  <td>
                    {session.evaluatorSessionKey ? (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <code style={{
                          background: '#F1F5F9',
                          color: '#4F46E5',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          border: '1px solid #E2E8F0',
                          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          {session.evaluatorSessionKey}
                        </code>
                        <button
                          onClick={() => handleCopyKey(session.evaluatorSessionKey)}
                          title="Copy Key"
                          style={{
                            background: 'white',
                            border: '1px solid #E2E8F0',
                            borderRadius: '6px',
                            color: '#64748B',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: '0.78rem', fontStyle: 'italic' }}>No Key Generated</span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    {(session.status as string) === 'DRAFT' && <Badge variant="warning">DRAFT (Awaiting Generation)</Badge>}
                    {session.status === 'SCHEDULED' && <Badge variant="default">SCHEDULED</Badge>}
                    {session.status === 'FACULTY_APPOINTED' && <Badge variant="info">FACULTY APPOINTED</Badge>}
                    {session.status === 'QP_APPROVED' && <Badge variant="success">QP VERIFIED ✓</Badge>}
                    {session.status === 'IN_PROGRESS' && <Badge variant="warning">CONDUCTION ACTIVE</Badge>}
                    {session.status === 'COMPLETED' && <Badge variant="success">COMPLETED</Badge>}
                  </td>

                  {/* Room Seating & Notice */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                      {(session.status as string) === 'DRAFT' ? (
                        <button
                          disabled={!!generatingTaskId || isGenerating}
                          className="btn-generate"
                          onClick={async () => {
                            setIsGenerating(true);
                            const loadingToast = toast.loading('Running AI Timetable Solver...');
                            try {
                              const res = await api.post('/scheduling/timetable/generate/', {
                                exam_session_id: session.id,
                                time_limit_secs: 60,
                              });
                              if (res.data.sync && res.data.result?.success) {
                                toast.success(
                                  `Timetable generated in ${res.data.result.wall_time_secs}s — ${res.data.result.slots_created} slot(s) created!`,
                                  { id: loadingToast, duration: 4000 }
                                );
                                setTimeout(() => window.location.reload(), 1500);
                              } else {
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
                        >
                          <Zap size={16} /> {isGenerating ? 'Solver Running...' : generatingTaskId ? 'Awaiting Result...' : 'Run AI Generator'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedSessionForSeating(session);
                            setIsAISeatingOpen(true);
                          }}
                          className="btn-seating"
                          title="Open Room Door Seating Grid & Notice Board for this scheduled exam"
                        >
                          <Grid size={15} /> Seating & Notice
                        </button>
                      )}
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          onClick={() => { setEditingSession(session); setIsEditOpen(true); }}
                          style={{
                            background: 'transparent', color: '#4F46E5', border: 'none',
                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem',
                            fontWeight: 600, cursor: 'pointer', opacity: 0.8,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                        >
                          Edit
                        </button>
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
                            background: 'transparent', color: '#EF4444', border: 'none',
                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem',
                            fontWeight: 600, cursor: 'pointer', opacity: 0.7,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                        >
                          Delete
                        </button>
                      </div>
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

      {isEditOpen && editingSession && (
        <EditExamSessionModal
          isOpen={isEditOpen}
          session={editingSession}
          halls={halls}
          onClose={() => { setIsEditOpen(false); setEditingSession(null); }}
          onSaved={(updated) => {
            onUpdateSessions(sessions.map(s => s.id === updated.id ? { ...s, ...updated } : s));
            toast.success('Session refreshed');
          }}
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
