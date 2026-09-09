import React from 'react';
import { StudentEligibilityRecord, HallTicketRecord, CIEMarksSheet } from '../../types';
import { Users, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, QrCode } from 'lucide-react';

interface HODOverviewTabProps {
  students: StudentEligibilityRecord[];
  hallTickets: HallTicketRecord[];
  cieSheets: CIEMarksSheet[];
  onNavigateToEligibility: () => void;
  onNavigateToHallTickets: () => void;
  onNavigateToFaculty?: () => void;
  departmentCode?: string;
  baseStudentsCount?: number;
}

export const HODOverviewTab: React.FC<HODOverviewTabProps> = ({
  students,
  hallTickets,
  cieSheets,
  onNavigateToEligibility,
  onNavigateToHallTickets,
  onNavigateToFaculty: _onNavigateToFaculty,
  departmentCode = 'CSE',
  baseStudentsCount = 0,
}) => {
  const totalStudents = students.length;
  const eligibleStudents = students.filter(s => s.status === 'ELIGIBLE' || (s.status === 'CONDONABLE' && s.condonationApproved)).length;
  const pendingCondonations = students.filter(s => s.status === 'CONDONABLE' && !s.condonationApproved).length;
  const feeBlockedStudents = students.filter(s => s.status === 'FEE_BLOCKED').length;
  const pendingCIE = cieSheets.filter(s => !s.isEndorsedByHOD).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top Telemetry Stat Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {[
          {
            label: 'Total Department Roster',
            value: `${baseStudentsCount} Students`,
            desc: `${departmentCode} 3rd, 5th & 7th Semesters`,
            icon: <Users size={20} />,
            color: '#3b82f6',
          },
          {
            label: 'Attendance Eligible',
            value: `${totalStudents > 0 ? Math.round((eligibleStudents / totalStudents) * 100) : 0}% Eligible`,
            desc: `${students.filter(s => s.status === 'DETAINED').length} Students Detained (<75%)`,
            icon: <CheckCircle2 size={20} />,
            color: '#10b981',
          },
          {
            label: 'Condonations & Dues',
            value: `${pendingCondonations} Pending`,
            desc: `${feeBlockedStudents} Accounts with Fee Dues`,
            icon: <AlertTriangle size={20} />,
            color: '#f59e0b',
          },
          {
            label: 'Hall Tickets Dispatched',
            value: `${hallTickets.length} Issued`,
            desc: 'Cryptographically Verified QR',
            icon: <QrCode size={20} />,
            color: '#8b5cf6',
          },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'white',
              borderRadius: '14px',
              border: `1px solid ${stat.color}22`,
              borderTop: `4px solid ${stat.color}`,
              padding: '18px 20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              background: `${stat.color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: stat.color,
              flexShrink: 0,
            }}>
              {stat.icon}
            </div>

            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                {stat.label}
              </p>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {stat.value}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: stat.color, fontWeight: 600 }}>
                {stat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Action Center & Urgent Approvals ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '16px',
        padding: '24px 30px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck size={18} color="#48977f" />
            <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Department Academic Operations Status
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
            Fall 2026 Examination Readiness Gateway
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            You have <strong>{pendingCondonations} condonation requests</strong> and <strong>{pendingCIE} CIE mark sheets</strong> pending HOD endorsement.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onNavigateToEligibility}
            style={{
              padding: '10px 18px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(245,158,11,0.3)',
            }}
          >
            <AlertTriangle size={15} /> Review Condonations ({pendingCondonations})
          </button>

          <button
            onClick={onNavigateToHallTickets}
            style={{
              padding: '10px 18px',
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
              boxShadow: '0 4px 14px rgba(72,151,127,0.35)',
            }}
          >
            <QrCode size={15} /> Batch Issue Hall Tickets <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Semester Cohort Readiness Matrix ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        padding: '24px 28px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800 }}>
          Semester Cohort Examination Readiness
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '18px' }}>
          {[
            { sem: '3rd Semester B.Tech', enrolled: 160, eligible: 148, condonable: 8, detained: 4, hallTicketsReady: true },
            { sem: '5th Semester B.Tech', enrolled: 160, eligible: 154, condonable: 4, detained: 2, hallTicketsReady: true },
            { sem: '7th Semester B.Tech', enrolled: 160, eligible: 158, condonable: 2, detained: 0, hallTicketsReady: true },
          ].map((c, i) => (
            <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--color-primary)' }}>{c.sem}</span>
                <span style={{ fontSize: '0.72rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
                  {Math.round((c.eligible / c.enrolled) * 100)}% Ready
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Enrolled:</span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{c.enrolled} Students</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Eligible (≥75% Attendance):</span>
                  <strong style={{ color: '#16a34a' }}>{c.eligible} Students</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Condonation Required:</span>
                  <strong style={{ color: '#d97706' }}>{c.condonable} Students</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Detained (&lt;65% Attendance):</span>
                  <strong style={{ color: '#e11d48' }}>{c.detained} Students</strong>
                </div>
              </div>

              <button
                onClick={onNavigateToEligibility}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'white',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                Inspect {c.sem} Roster <ArrowRight size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
