import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Clock, CalendarDays, Users, BookOpen, ArrowRight, Eye, Pencil, CheckCircle, Trash2 } from 'lucide-react';

interface Session {
  id: string;
  name: string;
  date: string;
  time: string;
  status: 'Pending Allocation' | 'Allocated' | 'Draft';
  examType: string;
  departments: string[];
  subjects: string[];
  totalStudents: number;
  rooms: number;
}

interface SessionListProps {
  onAllocate: (id: string) => void;
  onView: (id: string) => void;
  onRefresh?: () => void;
}

import { api } from '@/services/api';

const statusMeta = {
  'Draft':                { color: '#94a3b8', gradient: 'linear-gradient(135deg, #94a3b822 0%, #94a3b808 100%)', border: '#94a3b844' },
  'Pending Allocation':   { color: '#ed7245', gradient: 'linear-gradient(135deg, #ed724522 0%, #ed724508 100%)', border: '#ed724544' },
  'Allocated':            { color: '#48977f', gradient: 'linear-gradient(135deg, #48977f22 0%, #48977f08 100%)', border: '#48977f44' },
};

export const SessionList: React.FC<SessionListProps> = ({ onAllocate, onView, onRefresh }) => {
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const fetchSessions = () => {
    setLoading(true);
    api.get('/scheduling/sessions/')
      .then(res => {
        const rawSessions = res.data.results || res.data;
        const mappedSessions = rawSessions.map((s: any) => ({
          id: s.id,
          name: s.name,
          date: s.start_date ? `${s.start_date} to ${s.end_date || s.start_date}` : 'TBD',
          time: s.semesters?.length ? `Sem ${s.semesters.join(', ')}` : (s.academic_year || 'TBD'),
          status: (s.status === 'SCHEDULED' || s.status === 'ACTIVE') ? 'Allocated' as const
                : s.status === 'DRAFT' ? 'Draft' as const
                : 'Pending Allocation' as const,
          examType: s.academic_year || 'SEE',
          departments: s.departments || [],
          subjects: s.subject_list || [],
          totalStudents: s.student_count || 0,
          rooms: s.slot_count || 0,
        }));
        setSessions(mappedSessions);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  React.useEffect(() => {
    fetchSessions();
  }, []);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    setDeleting(sessionId);
    try {
      await api.delete(`/scheduling/sessions/${sessionId}/`);
      fetchSessions();
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('Failed to delete session.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* CoE Institutional Scope Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
        border: '1.5px solid #C7D2FE',
        borderRadius: '14px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.25rem' }}>🏛️</span>
          <div>
            <div style={{ fontWeight: 800, color: '#3730A3', fontSize: '0.85rem' }}>
              CoE Institution-Wide Scope: Semester End Examinations (SEE) Across All Academic Departments
            </div>
            <div style={{ fontSize: '0.78rem', color: '#4F46E5', marginTop: '2px' }}>
              CoE centrally coordinates SEE exam dates, interleaved multi-department seating allotments, and campus-wide halls. Continuous Internal Evaluations (CIE) are conducted independently by Department HODs.
            </div>
          </div>
        </div>

        <span style={{
          background: '#4F46E5',
          color: 'white',
          fontSize: '0.72rem',
          fontWeight: 800,
          padding: '4px 10px',
          borderRadius: '20px',
          whiteSpace: 'nowrap'
        }}>
          ALL DEPARTMENTS ACTIVE
        </span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 40, height: 40, borderRadius: '10px', background: '#8b5cf615', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
          <CalendarDays size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0 }}>Upcoming SEE Institutional Sessions</h3>
          <p style={{ margin: '0 0 16px 0', color: '#64748B', fontSize: '0.9rem' }}>
            Select an institution-wide examination session to allocate rooms and invigilators
          </p>

          {loading && <p style={{ color: '#64748B', fontSize: '0.85rem' }}>Loading sessions...</p>}
          {!loading && sessions.length === 0 && (
            <div style={{
              background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
              border: '1.5px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '40px',
              textAlign: 'center',
              marginTop: '8px',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
              <h3 style={{ margin: '0 0 8px 0', color: '#1E293B' }}>No exam sessions yet</h3>
              <p style={{ color: '#64748B', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 24px auto' }}>
                Click <strong>"New Allocation Wizard"</strong> above to create your first SEE exam session.
              </p>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                border: '1px solid #E2E8F0',
                textAlign: 'left',
                maxWidth: '480px',
                margin: '0 auto',
              }}>
                <div style={{ fontWeight: 800, color: '#334155', marginBottom: '12px', fontSize: '0.85rem' }}>📌 Quick Start Guide</div>
                {[
                  { step: '1', text: 'Click New Allocation Wizard', detail: 'Top-right button' },
                  { step: '2', text: 'Name session & pick departments/semesters', detail: 'e.g. SEE Autumn 2026 | CSE, ECE | Sem 3,5,7' },
                  { step: '3', text: 'Select subjects for this session', detail: 'All enrolled subjects appear automatically' },
                  { step: '4', text: 'Pick exam halls from Resources', detail: 'Add rooms in Resources → Exam Rooms first' },
                  { step: '5', text: 'Run AI Solver → View Blueprint', detail: 'Interleaved seating map generated instantly' },
                ].map(g => (
                  <div key={g.step} style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'flex-start' }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: '#4F46E5', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 800, flexShrink: 0,
                    }}>{g.step}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#1E293B' }}>{g.text}</div>
                      <div style={{ fontSize: '0.76rem', color: '#64748B' }}>{g.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Cards */}
      {sessions.map(sess => {
        const meta = statusMeta[sess.status] || statusMeta['Pending Allocation'];
        const isPending = sess.status === 'Pending Allocation' || sess.status === 'Draft';

        return (
          <div
            key={sess.id}
            style={{
              background: 'white',
              borderRadius: '16px',
              border: `1.5px solid ${meta.border}`,
              borderTop: `5px solid ${meta.color}`,
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px ${meta.color}22`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
          >
            {/* Card body */}
            <div style={{ padding: '24px 28px', background: meta.gradient, position: 'relative', overflow: 'hidden' }}>
              <svg style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.08, pointerEvents: 'none' }} viewBox="0 0 120 120" width="120" height="120">
                <rect x="10" y="20" width="100" height="90" rx="10" fill={meta.color} />
                <rect x="10" y="20" width="100" height="28" rx="10" fill={meta.color} />
                <rect x="10" y="38" width="100" height="10" fill={meta.color} />
                <rect x="30" y="8"  width="12" height="24" rx="6" fill={meta.color} />
                <rect x="78" y="8"  width="12" height="24" rx="6" fill={meta.color} />
                {[30,50,70,90].map(x => [60,75,90,105].map(y => (
                  <rect key={`${x}${y}`} x={x} y={y} width="10" height="10" rx="2" fill="white" opacity="0.35" />
                )))}
              </svg>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Badge variant={sess.status === 'Allocated' ? 'success' : sess.status === 'Draft' ? 'warning' : 'warning'}>{sess.status}</Badge>
                    {sess.status === 'Allocated' && <CheckCircle size={16} color="#48977f" />}
                  </div>
                  <h2 style={{ margin: '0 0 12px 0', fontWeight: 800, fontSize: '1.3rem', color: 'var(--color-text-primary)', lineHeight: 1.2 }}>
                    {sess.name}
                  </h2>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      <CalendarDays size={14} color={meta.color} /> {sess.date}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      <Clock size={14} color={meta.color} /> {sess.time}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      <Users size={14} color={meta.color} /> {sess.totalStudents} Students
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                      <BookOpen size={14} color={meta.color} /> {sess.subjects.length} Subjects
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: `1px solid ${meta.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'white',
            }}>
              {/* Department & Subject chips */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                {sess.departments.length > 0 && (
                  <>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>DEPARTMENTS:</span>
                    {sess.departments.map(dept => (
                      <span key={dept} style={{
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        border: '1px solid #C7D2FE',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 900,
                      }}>
                        {dept}
                      </span>
                    ))}
                  </>
                )}
                {sess.subjects.length > 0 && (
                  <>
                    {sess.departments.length > 0 && <span style={{ color: '#CBD5E1' }}>|</span>}
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>SUBJECTS:</span>
                    {sess.subjects.slice(0, 5).map(code => (
                      <span key={code} style={{
                        background: `${meta.color}12`,
                        color: meta.color,
                        border: `1px solid ${meta.color}33`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}>
                        {code}
                      </span>
                    ))}
                    {sess.subjects.length > 5 && (
                      <span style={{ fontSize: '0.72rem', color: '#64748B' }}>+{sess.subjects.length - 5} more</span>
                    )}
                  </>
                )}
                {sess.rooms > 0 && (
                  <span style={{ background: '#8b5cf612', color: '#8b5cf6', border: '1px solid #8b5cf633', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                    {sess.rooms} Exam Halls Assigned
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', flexShrink: 0, marginLeft: '16px' }}>
                <button
                  onClick={() => onAllocate(sess.id)}
                  style={{
                    background: sess.status === 'Allocated' ? 'transparent' : `linear-gradient(135deg, ${meta.color}, #c85a30)`,
                    color: sess.status === 'Allocated' ? meta.color : 'white',
                    border: sess.status === 'Allocated' ? `1.5px solid ${meta.color}` : 'none',
                    padding: '10px 18px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.83rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Pencil size={14} /> {sess.status === 'Allocated' ? 'Edit' : 'Start Allocation'}
                </button>

                {sess.status === 'Allocated' && (
                  <button
                    onClick={() => onView(sess.id)}
                    style={{
                      background: `linear-gradient(135deg, ${meta.color}, #2f6852)`,
                      color: 'white',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: `0 4px 14px ${meta.color}44`,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Eye size={15} /> View Blueprint <ArrowRight size={15} />
                  </button>
                )}

                <button
                  onClick={() => handleDelete(sess.id)}
                  disabled={deleting === sess.id}
                  style={{
                    background: '#FEE2E2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.83rem',
                    cursor: deleting === sess.id ? 'not-allowed' : 'pointer',
                    opacity: deleting === sess.id ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
