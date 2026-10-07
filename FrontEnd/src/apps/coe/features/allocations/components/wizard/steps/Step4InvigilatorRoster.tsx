import React, { useState } from 'react';
import { Scale, ShieldCheck, ArrowRight, ArrowLeft, RotateCcw } from 'lucide-react';
import { FacultyInvigilator } from '../../../types/allocationTypes';

interface Step4InvigilatorRosterProps {
  availableFaculty: FacultyInvigilator[];
  requiredInvigilators: number;
  facultyRoster: FacultyInvigilator[];
  onRosterChange: (roster: FacultyInvigilator[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step4InvigilatorRoster: React.FC<Step4InvigilatorRosterProps> = ({
  availableFaculty,
  requiredInvigilators,
  facultyRoster,
  onRosterChange,
  onNext,
  onBack,
}) => {
  const [avoidDeptBias, setAvoidDeptBias] = useState(true);

  // Compute required invigilators based on rooms count (simple estimate: 1 per room, or 2 for large rooms. We'll just use the passed prop for now).
  const totalDutySlots = requiredInvigilators * 2; // Assuming 2 invigilators per room on average
  
  // Initialize faculty roster if empty
  React.useEffect(() => {
    if (facultyRoster.length === 0 && availableFaculty.length > 0) {
      onRosterChange(availableFaculty.map(f => ({
        ...f,
        isAvailable: true,
        historicalDutyCount: f.historicalDutyCount || 0, // Mocking historical data for now
        currentCycleDuties: 0,
        tags: []
      })));
    }
  }, [availableFaculty, facultyRoster.length, onRosterChange]);

  const activeFacultyCount = facultyRoster.filter(f => f.isAvailable).length;
  const targetDutiesPerFaculty = activeFacultyCount > 0 ? (totalDutySlots / activeFacultyCount).toFixed(1) : '1.0';

  // Workload Equalizer button: automatically prioritizes faculty with lowest historical duties
  const handleAutoEqualize = () => {
    // Reset all current cycle duties
    const updated = facultyRoster.map(f => ({ ...f, currentCycleDuties: 0 }));

    // Sort by historical duty count ascending (lowest first)
    const sortedAvailable = [...updated]
      .filter(f => f.isAvailable)
      .sort((a, b) => a.historicalDutyCount - b.historicalDutyCount);

    // Distribute the duty slots one by one to the lowest burdened faculty
    for (let slot = 0; slot < totalDutySlots; slot++) {
      // Pick faculty with lowest total
      sortedAvailable.sort((a, b) => {
        const aTotal = a.historicalDutyCount + a.currentCycleDuties;
        const bTotal = b.historicalDutyCount + b.currentCycleDuties;
        return aTotal - bTotal;
      });

      if (sortedAvailable[0]) {
        sortedAvailable[0].currentCycleDuties += 1;
      }
    }

    // Merge back to main roster
    const map = new Map(sortedAvailable.map(f => [f.id, f]));
    const finalRoster = updated.map(f => map.get(f.id) || f);
    onRosterChange(finalRoster);
  };

  const handleToggleAvailability = (facId: string) => {
    onRosterChange(
      facultyRoster.map(f => f.id === facId ? { ...f, isAvailable: !f.isAvailable } : f)
    );
  };

  const handleManualDutyAdjust = (facId: string, delta: number) => {
    onRosterChange(
      facultyRoster.map(f => {
        if (f.id === facId) {
          const newVal = Math.max(0, f.currentCycleDuties + delta);
          return { ...f, currentCycleDuties: newVal };
        }
        return f;
      })
    );
  };

  // Calculate fairness index (variance)
  const totalDuties = facultyRoster.map(f => f.historicalDutyCount + f.currentCycleDuties);
  const avg = totalDuties.reduce((a, b) => a + b, 0) / (totalDuties.length || 1);
  const variance = totalDuties.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / (totalDuties.length || 1);
  const stdDev = Math.sqrt(variance).toFixed(2);
  const isWellBalanced = parseFloat(stdDev) < 1.2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Guidance Panel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
        border: '1.5px solid #DDD6FE',
        borderRadius: '14px',
        padding: '18px 22px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>🧑‍🏫</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#5B21B6', marginBottom: '6px' }}>
            Step 4 of 5 — Assign Invigilators
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#6D28D9', fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li>All faculty loaded from <strong>User Access</strong> with role FACULTY are shown here</li>
            <li>Toggle a faculty member's <strong>Available</strong> switch OFF if they are on leave</li>
            <li>Click <strong>⚡ Auto-Equalize Duty Load</strong> to distribute duties fairly based on past history</li>
            <li>The <strong>Fairness Index σ</strong> shows workload variance — aim for σ &lt; 1.2 (green badge)</li>
            <li>You can manually ➕/➖ adjust duty count per faculty if needed</li>
            <li>Minimum 1 invigilator per hall required. The solver assigns Chief + Reliever roles.</li>
          </ul>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Scale size={22} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              Step 4 of 5 • Faculty Invigilation Workload Equalizer
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Fair Invigilator Duty Allocation & Conflict Avoidance</h2>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85, maxWidth: '680px' }}>
          Institutional SEE exam duties are dynamically balanced so every faculty member carries an equal workload. The algorithm assigns 1 Chief + 1 Reliever for halls exceeding 35 seats and strictly avoids single-department bias.
        </p>
      </div>

      {/* Fairness Dashboard & Action Bar */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '20px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Duty Slots Required</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1E293B', marginTop: '2px' }}>
            {totalDutySlots} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748B' }}>({requiredInvigilators} Halls)</span>
          </div>
        </div>

        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Available Faculty</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1E293B', marginTop: '2px' }}>
            {activeFacultyCount} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748B' }}>/ {facultyRoster.length} Total</span>
          </div>
        </div>

        <div style={{ borderRight: '1px solid #F1F5F9', paddingRight: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Target Quota / Faculty</span>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#7C3AED', marginTop: '2px' }}>
            ~{targetDutiesPerFaculty} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748B' }}>duties</span>
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Fairness Index (σ)</span>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 900,
            color: isWellBalanced ? '#10B981' : '#F59E0B',
            marginTop: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            ±{stdDev}
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              background: isWellBalanced ? '#ECFDF5' : '#FFFBEB',
              color: isWellBalanced ? '#047857' : '#B45309',
              padding: '2px 6px',
              borderRadius: '4px',
            }}>
              {isWellBalanced ? 'Balanced' : 'Skewed'}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div style={{
        background: '#F8FAFC',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '14px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={20} color="#7C3AED" />
          <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={avoidDeptBias}
              onChange={e => setAvoidDeptBias(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#7C3AED' }}
            />
            Anti-Bias Constraint: Strictly forbid faculty from solo-invigilating their own department
          </label>
        </div>

        <button
          onClick={handleAutoEqualize}
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 18px',
            fontSize: '0.82rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
          }}
        >
          <RotateCcw size={15} /> Equalize Workload Automatically
        </button>
      </div>

      {/* Faculty Table */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '14px 20px' }}>Faculty Member</th>
              <th style={{ padding: '14px 16px' }}>Department</th>
              <th style={{ padding: '14px 16px' }}>Designation</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>Historical Duties</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>This Session</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>Total Load</th>
              <th style={{ padding: '14px 16px', textAlign: 'center' }}>Duty Balance Status</th>
              <th style={{ padding: '14px 20px', textAlign: 'right' }}>Availability</th>
            </tr>
          </thead>
          <tbody>
            {facultyRoster.map(fac => {
              const total = fac.historicalDutyCount + fac.currentCycleDuties;
              const diffFromTarget = total - parseFloat(targetDutiesPerFaculty);
              let statusLabel = 'Balanced';
              let statusBg = '#ECFDF5';
              let statusColor = '#047857';

              if (diffFromTarget > 1.5) {
                statusLabel = 'High Load';
                statusBg = '#FEF2F2';
                statusColor = '#B91C1C';
              } else if (diffFromTarget < -1.5) {
                statusLabel = 'Low Load';
                statusBg = '#FFFBEB';
                statusColor = '#B45309';
              }

              return (
                <tr
                  key={fac.id}
                  style={{
                    borderBottom: '1px solid #F1F5F9',
                    opacity: fac.isAvailable ? 1 : 0.5,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 800, color: '#1E293B' }}>{fac.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>{fac.email}</div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: '#F1F5F9',
                      color: '#334155',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}>
                      {fac.department}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', color: '#64748B' }}>
                    {fac.designation}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                    {fac.historicalDutyCount}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => handleManualDutyAdjust(fac.id, -1)}
                        disabled={!fac.isAvailable || fac.currentCycleDuties === 0}
                        style={{
                          width: 24, height: 24, borderRadius: '4px', border: '1px solid #CBD5E1',
                          background: 'white', cursor: 'pointer', fontWeight: 800,
                        }}
                      >
                        -
                      </button>
                      <span style={{
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        color: fac.currentCycleDuties > 0 ? '#7C3AED' : '#94A3B8',
                        minWidth: '20px',
                        textAlign: 'center',
                      }}>
                        {fac.currentCycleDuties}
                      </span>
                      <button
                        onClick={() => handleManualDutyAdjust(fac.id, 1)}
                        disabled={!fac.isAvailable}
                        style={{
                          width: 24, height: 24, borderRadius: '4px', border: '1px solid #CBD5E1',
                          background: 'white', cursor: 'pointer', fontWeight: 800,
                        }}
                      >
                        +
                      </button>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>
                    {total}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      background: statusBg,
                      color: statusColor,
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                    }}>
                      {statusLabel}
                    </span>
                  </td>

                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleToggleAvailability(fac.id)}
                      style={{
                        background: fac.isAvailable ? '#ECFDF5' : '#F1F5F9',
                        color: fac.isAvailable ? '#059669' : '#64748B',
                        border: `1px solid ${fac.isAvailable ? '#A7F3D0' : '#CBD5E1'}`,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {fac.isAvailable ? 'Available' : 'On Leave'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'white',
            border: '1.5px solid #CBD5E1',
            borderRadius: '10px',
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ArrowLeft size={16} /> Back to Exam Halls
        </button>

        <button
          onClick={onNext}
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 28px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
          }}
        >
          Launch AI Optimization Console <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
