import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Users, BookOpen, Layers } from 'lucide-react';
import { api } from '@/services/api';

interface SubjectListProps {
  onViewStudents: (id: string, code: string, title: string) => void;
}

interface SubjectData {
  id: string;
  code: string;
  name: string;
  subject_type: string;
  department_code: string;
  department_name: string;
  semester: number;
  credits: number;
  batch_year: number;
  coordinator_name: string | null;
  is_active: boolean;
}

const palette = ['#48977f', '#3b82f6', '#8b5cf6'];

// Small inline SVG vectors per subject
const SubjectVectors = [
  // Book / curriculum vector
  <svg key="v1" viewBox="0 0 60 60" style={{ position: 'absolute', right: 12, top: 8, opacity: 0.08, width: 60, height: 60, pointerEvents: 'none' }}>
    <rect x="8"  y="10" width="30" height="40" rx="3" fill="currentColor" />
    <rect x="12" y="6"  width="30" height="40" rx="3" fill="currentColor" />
    <line x1="18" y1="18" x2="36" y2="18" stroke="white" strokeWidth="2" />
    <line x1="18" y1="24" x2="36" y2="24" stroke="white" strokeWidth="2" />
    <line x1="18" y1="30" x2="28" y2="30" stroke="white" strokeWidth="2" />
  </svg>,
  // Data / grid vector
  <svg key="v2" viewBox="0 0 60 60" style={{ position: 'absolute', right: 12, top: 8, opacity: 0.08, width: 60, height: 60, pointerEvents: 'none' }}>
    <rect x="8"  y="8"  width="18" height="18" rx="2" fill="currentColor" />
    <rect x="34" y="8"  width="18" height="18" rx="2" fill="currentColor" />
    <rect x="8"  y="34" width="18" height="18" rx="2" fill="currentColor" />
    <rect x="34" y="34" width="18" height="18" rx="2" fill="currentColor" />
  </svg>,
  // OS / layers vector
  <svg key="v3" viewBox="0 0 60 60" style={{ position: 'absolute', right: 12, top: 8, opacity: 0.08, width: 60, height: 60, pointerEvents: 'none' }}>
    <rect x="8"  y="12" width="44" height="8" rx="3" fill="currentColor" />
    <rect x="8"  y="26" width="44" height="8" rx="3" fill="currentColor" />
    <rect x="8"  y="40" width="44" height="8" rx="3" fill="currentColor" />
  </svg>,
];

const StatCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => (
  <div style={{
    flex: 1,
    background: 'white',
    border: `1px solid ${color}33`,
    borderTop: `4px solid ${color}`,
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Card background vector */}
    <svg style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.06, pointerEvents: 'none' }} width="70" height="70" viewBox="0 0 70 70">
      <circle cx="55" cy="55" r="40" fill={color} />
      <circle cx="55" cy="55" r="25" fill="none" stroke={color} strokeWidth="2" />
    </svg>
    <div style={{ width: 44, height: 44, borderRadius: '10px', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, position: 'relative', zIndex: 1 }}>
      {icon}
    </div>
    <div style={{ position: 'relative', zIndex: 1 }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</p>
    </div>
  </div>
);

export const SubjectList: React.FC<SubjectListProps> = ({ onViewStudents }) => {
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get('/scheduling/subjects/')
      .then(res => {
        if (cancelled) return;
        const data = res.data?.results || res.data;
        setSubjects(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to fetch subjects:', err);
        setError(err.response?.data?.detail || err.message || 'Failed to load subjects');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: 'var(--color-text-secondary)' }}>
        Loading subjects...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 20px', color: '#ef4444' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <StatCard icon={<BookOpen size={20} />} label="Total Subjects"  value={subjects.length} color="#48977f" />
        <StatCard icon={<Users size={20} />}    label="Coordinators"    value={subjects.filter(s => s.coordinator_name).length}  color="#3b82f6" />
        <StatCard icon={<Layers size={20} />}   label="Departments"     value={new Set(subjects.map(s => s.department_code)).size}  color="#ed7245" />
      </div>

      {/* Subject Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {subjects.map((sub, i) => {
          const color = palette[i % palette.length];
          return (
            <div key={sub.id} style={{
              background: 'white',
              borderRadius: '12px',
              border: `1px solid ${color}22`,
              borderLeft: `5px solid ${color}`,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'box-shadow 0.2s, transform 0.2s',
              cursor: 'default',
              position: 'relative',
              overflow: 'hidden',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 24px ${color}22`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
            >
              {/* Floating vector art per subject */}
              <div style={{ color, position: 'absolute', right: 0, top: 0 }}>
                {SubjectVectors[i % SubjectVectors.length]}
              </div>

              {/* Code chip */}
              <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: `${color}15`, border: `1.5px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 700, fontSize: '0.72rem', flexShrink: 0, letterSpacing: '-0.5px' }}>
                {sub.code}
              </div>

              {/* Info */}
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem' }}>{sub.name}</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                  {sub.department_name || sub.department_code} · {sub.credits} Credits · Sem {sub.semester}
                  {sub.coordinator_name && <span> · Coord: {sub.coordinator_name}</span>}
                </p>
              </div>

              <Badge variant={sub.is_active ? 'success' : 'info'}>{sub.is_active ? 'Active' : 'Inactive'}</Badge>

              {/* Action */}
              <button
                onClick={() => onViewStudents(sub.id, sub.code, sub.name)}
                style={{
                  background: `${color}15`,
                  border: `1.5px solid ${color}44`,
                  color,
                  cursor: 'pointer',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s',
                  position: 'relative',
                  zIndex: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                <Users size={14} /> View Enrolment
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
