import React from 'react';
import { Building2, DoorOpen, Users, Accessibility, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { ExamHall } from '../../../types/allocationTypes';

interface Step3HallConfigurationProps {
  totalCandidates: number;
  availableRooms: ExamHall[];
  selectedRooms: ExamHall[];
  onRoomsChange: (rooms: ExamHall[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step3HallConfiguration: React.FC<Step3HallConfigurationProps> = ({
  totalCandidates,
  availableRooms,
  selectedRooms,
  onRoomsChange,
  onNext,
  onBack,
}) => {
  const allHalls = availableRooms;

  const toggleRoom = (hall: ExamHall) => {
    const exists = selectedRooms.some(r => r.id === hall.id);
    if (exists) {
      onRoomsChange(selectedRooms.filter(r => r.id !== hall.id));
    } else {
      onRoomsChange([...selectedRooms, hall]);
    }
  };

  const autoSelectOptimal = () => {
    // Greedy heuristic: pick largest rooms until capacity + 5% buffer is met
    const sorted = [...allHalls].sort((a, b) => b.capacity - a.capacity);
    const target = Math.ceil(totalCandidates * 1.05);
    let accum = 0;
    const chosen: ExamHall[] = [];
    for (const r of sorted) {
      chosen.push(r);
      accum += r.capacity || 0;
      if (accum >= target) break;
    }
    onRoomsChange(chosen);
  };

  const selectAll = () => onRoomsChange(allHalls);
  const clearAll = () => onRoomsChange([]);

  const currentCapacity = selectedRooms.reduce((sum, r) => sum + (r.capacity || 0), 0);
  const targetWithBuffer = Math.ceil(totalCandidates * 1.05);
  const isCapacityMet = currentCapacity >= totalCandidates;
  const isBufferMet = currentCapacity >= targetWithBuffer;
  const progressPercent = Math.min(100, Math.round((currentCapacity / (totalCandidates || 1)) * 100));

  const groundFloorRooms = selectedRooms.filter(r => r.floor === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Guidance Panel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
        border: '1.5px solid #BFDBFE',
        borderRadius: '14px',
        padding: '18px 22px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>🏛️</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1E40AF', marginBottom: '6px' }}>
            Step 3 of 5 — Assign Examination Halls
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#1D4ED8', fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li>All rooms are loaded from <strong>Resources → Exam Rooms</strong> that you have already configured</li>
            <li>Click a hall card to <strong>include it</strong> in this session (blue border = selected)</li>
            <li>The <strong>Capacity Meter</strong> shows total seats vs required — aim for 100%+ with 5% buffer</li>
            <li>Use <strong>⚡ Auto-Select Optimal</strong> to auto-pick the fewest halls covering all candidates</li>
            <li><strong>Ground-floor rooms</strong> are auto-tagged for PWD/accessibility students</li>
            <li>If no rooms appear here, go to <strong>Resources</strong> and add exam rooms first</li>
          </ul>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
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
            <Building2 size={22} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              Step 3 of 5 • Infrastructure & Center Configuration
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Select Examination Halls & Capacity Management</h2>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85, maxWidth: '680px' }}>
          Allocate lecture theatres and examination halls to accommodate {totalCandidates} candidates. Ground-floor halls are automatically tagged for students requiring physical accommodations.
        </p>
      </div>

      {/* Live Capacity Fulfillment Meter */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isCapacityMet ? (
              <CheckCircle2 size={20} color="#10B981" />
            ) : (
              <AlertCircle size={20} color="#F59E0B" />
            )}
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1E293B' }}>
              Center Capacity Fulfillment: {currentCapacity} / {totalCandidates} Seats ({progressPercent}%)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={autoSelectOptimal}
              style={{
                background: '#F0FDF4',
                border: '1.5px solid #BBF7D0',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#15803D',
                cursor: 'pointer',
              }}
            >
              ⚡ Auto-Select Optimal ({targetWithBuffer} Seats)
            </button>
            <button
              onClick={selectAll}
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Select All ({allHalls.length})
            </button>
            <button
              onClick={clearAll}
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#64748B',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '10px',
          background: '#F1F5F9',
          borderRadius: '6px',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: isCapacityMet ? 'linear-gradient(90deg, #10B981, #059669)' : 'linear-gradient(90deg, #F59E0B, #D97706)',
            transition: 'width 0.3s ease',
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748B' }}>
          <span>Selected Halls: {selectedRooms.length} • Ground-Floor Halls: {groundFloorRooms.length}</span>
          <span>
            {isBufferMet
              ? '✓ Target + 5% emergency buffer fully satisfied'
              : isCapacityMet
              ? 'Satisfied, but recommend adding 1 more room for 5% buffer'
              : `Deficit: ${totalCandidates - currentCapacity} additional seats required`}
          </span>
        </div>
      </div>

      {/* Exam Halls Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '16px',
      }}>
        {allHalls.map(hall => {
          const isSelected = selectedRooms.some(r => r.id === hall.id);
          return (
            <div
              key={hall.id}
              onClick={() => toggleRoom(hall)}
              style={{
                background: 'white',
                borderRadius: '14px',
                border: isSelected ? '2px solid #0284C7' : '1.5px solid #E2E8F0',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? '0 4px 16px rgba(2,132,199,0.18)' : '0 1px 4px rgba(0,0,0,0.03)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DoorOpen size={20} color={isSelected ? '#0284C7' : '#64748B'} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#1E293B' }}>
                    Hall {hall.roomNumber}
                  </h3>
                </div>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ width: '18px', height: '18px', accentColor: '#0284C7' }}
                />
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '14px' }}>
                {hall.building} • {hall.floor === 0 ? 'Ground Floor' : `Floor ${hall.floor}`}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} color="#0284C7" />
                  <span style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0284C7' }}>
                    {hall.capacity}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Seats</span>
                </div>

                {hall.isAccessiblePWD && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#ECFDF5',
                    color: '#047857',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                  }}>
                    <Accessibility size={13} /> PWD Ground Floor
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
          <ArrowLeft size={16} /> Back to Subjects
        </button>

        <button
          onClick={onNext}
          disabled={!isCapacityMet}
          style={{
            background: isCapacityMet ? 'linear-gradient(135deg, #0284C7, #0369A1)' : '#CBD5E1',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 28px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: isCapacityMet ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: isCapacityMet ? '0 4px 14px rgba(2,132,199,0.3)' : 'none',
          }}
        >
          Proceed to Invigilator Balancing ({selectedRooms.length} Halls) <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
