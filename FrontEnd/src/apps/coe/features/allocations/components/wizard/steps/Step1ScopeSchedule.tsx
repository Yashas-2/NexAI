import React from 'react';
import { Calendar, Clock, ArrowRight, CheckSquare, Square } from 'lucide-react';
import { SessionScopeConfig, SemesterNumber, TimeSlot } from '../../../types/allocationTypes';

// Standard exam time slots (institutional configuration — not a DB entity)
const STANDARD_TIME_SLOTS: TimeSlot[] = [
  { id: 'SLOT_M1', name: 'Morning Forenoon Slot (M1)', startTime: '09:30 AM', endTime: '12:30 PM', sessionPeriod: 'FORENOON' },
  { id: 'SLOT_A1', name: 'Afternoon Post-Meridiem Slot (A1)', startTime: '02:00 PM', endTime: '05:00 PM', sessionPeriod: 'AFTERNOON' },
];

interface Step1ScopeScheduleProps {
  config: SessionScopeConfig;
  departments: any[]; // live from API
  onChange: (updated: Partial<SessionScopeConfig>) => void;
  onNext: () => void;
  saving?: boolean;
}

export const Step1ScopeSchedule: React.FC<Step1ScopeScheduleProps> = ({
  config,
  departments,
  onChange,
  onNext,
  saving = false,
}) => {
  const allDepts = departments;
  const allSemesters: SemesterNumber[] = [1, 2, 3, 4, 5, 6, 7, 8];

  const toggleDept = (deptCode: string) => {
    const isSelected = config.selectedDepartments.includes(deptCode);
    const updated = isSelected
      ? config.selectedDepartments.filter(d => d !== deptCode)
      : [...config.selectedDepartments, deptCode];
    onChange({ selectedDepartments: updated });
  };

  const selectAllDepts = () => {
    onChange({ selectedDepartments: allDepts.map(d => d.code) });
  };

  const clearAllDepts = () => {
    onChange({ selectedDepartments: [] });
  };

  const toggleSemester = (sem: SemesterNumber) => {
    const isSelected = config.selectedSemesters.includes(sem);
    const updated = isSelected
      ? config.selectedSemesters.filter(s => s !== sem)
      : [...config.selectedSemesters, sem];
    onChange({ selectedSemesters: updated });
  };

  const selectQuickSemPattern = (type: 'ODD' | 'EVEN' | 'ALL') => {
    if (type === 'ODD') onChange({ selectedSemesters: [1, 3, 5, 7] });
    else if (type === 'EVEN') onChange({ selectedSemesters: [2, 4, 6, 8] });
    else onChange({ selectedSemesters: [1, 2, 3, 4, 5, 6, 7, 8] });
  };

  const toggleSlot = (slot: TimeSlot) => {
    const exists = config.selectedSlots.some(s => s.id === slot.id);
    if (exists) {
      // Deselect
      onChange({ selectedSlots: config.selectedSlots.filter(s => s.id !== slot.id) });
    } else if (config.examsPerDay === 1) {
      // Single-session mode: replace any existing slot with the new one
      onChange({ selectedSlots: [slot] });
    } else {
      // Two-session mode: allow both
      onChange({ selectedSlots: [...config.selectedSlots, slot] });
    }
  };

  // When examsPerDay changes, enforce slot limits
  const handleExamsPerDayChange = (num: 1 | 2) => {
    onChange({
      examsPerDay: num,
      // If switching to 1/day and 2 slots selected, keep only the first
      selectedSlots: num === 1 && config.selectedSlots.length > 1
        ? [config.selectedSlots[0]]
        : config.selectedSlots,
    });
  };

  const isFormValid =
    config.sessionName.trim().length > 0 &&
    config.selectedDepartments.length > 0 &&
    config.selectedSemesters.length > 0 &&
    config.selectedSlots.length > 0;

  if (allDepts.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
        <p>Loading departments from server...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Guidance Panel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #EEF2FF 0%, #F0F9FF 100%)',
        border: '1.5px solid #C7D2FE',
        borderRadius: '14px',
        padding: '18px 22px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>📋</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#3730A3', marginBottom: '6px' }}>
            Step 1 of 5 — What to fill here
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#4338CA', fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li><strong>Session Name</strong> — e.g. <code style={{background:'#E0E7FF',padding:'1px 6px',borderRadius:'4px'}}>SEE Autumn 2026 — Core Sciences</code></li>
            <li><strong>Academic Year</strong> — e.g. <code style={{background:'#E0E7FF',padding:'1px 6px',borderRadius:'4px'}}>2026-27</code></li>
            <li><strong>Departments</strong> — Select all branches that have exams (e.g. CSE, ECE, ME)</li>
            <li><strong>Semesters</strong> — Select 3, 5, 7 for <em>Odd semester exams</em> or 2, 4, 6, 8 for Even</li>
            <li><strong>Start Date</strong> — First exam date, e.g. <code style={{background:'#E0E7FF',padding:'1px 6px',borderRadius:'4px'}}>2026-11-30</code></li>
            <li><strong>End Date</strong> — Last exam date, e.g. <code style={{background:'#E0E7FF',padding:'1px 6px',borderRadius:'4px'}}>2026-12-15</code></li>
            <li><strong>Sessions/Day</strong> — Usually <strong>1</strong> (morning only). Select 2 if both slots are used.</li>
            <li><strong>Time Slot</strong> — Select the slot that matches the exam schedule</li>
          </ul>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #4338CA 0%, #312E81 100%)',
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
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Calendar size={22} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              Step 1 of 5 • CoE Institutional Mandate
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Define Scope, Participating Branches & Timings</h2>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85, maxWidth: '680px', lineHeight: 1.5 }}>
          Select the engineering departments, target semesters, exam sessions per day, and official time slots. The AI engine will cross-interleave candidates across these selections to prevent examination malpractice.
        </p>
      </div>

      {/* Session Details Form */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '24px',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: '20px',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#1E293B' }}>
            Session Title (SEE Official Code)
          </label>
          <input
            type="text"
            value={config.sessionName}
            onChange={e => onChange({ sessionName: e.target.value })}
            placeholder="e.g. SEE Autumn 2026 — Institutional End Semester Examination"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.875rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#1E293B' }}>
            Exam Cycle Type
          </label>
          <select
            value={config.examType}
            onChange={e => onChange({ examType: e.target.value as any })}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.875rem',
              background: 'white',
              boxSizing: 'border-box',
            }}
          >
            <option value="SEE_REGULAR">SEE Regular Semester End</option>
            <option value="SEE_SUPPLEMENTARY">SEE Supplementary / Fast-Track</option>
            <option value="SEE_SPECIAL">Special Institutional Cycle</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#1E293B' }}>
            Exam Start Date
          </label>
          <input
            type="date"
            value={config.startDate}
            onChange={e => onChange({ startDate: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '6px', color: '#1E293B' }}>
            Exam End Date
          </label>
          <input
            type="date"
            value={config.endDate}
            min={config.startDate}
            onChange={e => onChange({ endDate: e.target.value })}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {/* Participating Departments */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid var(--color-border)',
        padding: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
              1. Participating Academic Departments ({config.selectedDepartments.length} Selected)
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
              Students from chosen departments will be interleaved together on the same benches across exam halls.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={selectAllDepts}
              style={{
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              Select All ({allDepts.length})
            </button>
            <button
              onClick={clearAllDepts}
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                color: '#64748B',
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {allDepts.map(dept => {
            const isSelected = config.selectedDepartments.includes(dept.code);
            return (
              <div
                key={dept.code}
                onClick={() => toggleDept(dept.code)}
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  border: isSelected ? `2px solid ${dept.color}` : '1.5px solid #E2E8F0',
                  background: isSelected ? `${dept.color}0A` : '#FAFAFA',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? `0 2px 10px ${dept.color}1A` : 'none',
                }}
              >
                <div style={{ color: dept.color, flexShrink: 0 }}>
                  {isSelected ? <CheckSquare size={20} /> : <Square size={20} color="#94A3B8" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: isSelected ? dept.color : '#1E293B',
                      background: isSelected ? `${dept.color}15` : '#E2E8F0',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}>
                      {dept.code}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>USN: {dept.prefix}...</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginTop: '4px' }}>
                    {dept.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Target Semesters & Exams Per Day */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
        {/* Semester Selection */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          padding: '24px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
              2. Target Semesters ({config.selectedSemesters.length} Selected)
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => selectQuickSemPattern('ODD')}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Odd Sems (3, 5, 7)
              </button>
              <button
                onClick={() => selectQuickSemPattern('EVEN')}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Even Sems (4, 6, 8)
              </button>
              <button
                onClick={() => selectQuickSemPattern('ALL')}
                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '4px 8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
              >
                All
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {allSemesters.map(sem => {
              const isSelected = config.selectedSemesters.includes(sem);
              return (
                <button
                  key={sem}
                  onClick={() => toggleSemester(sem)}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                    background: isSelected ? '#EEF2FF' : '#FAFAFA',
                    color: isSelected ? '#4F46E5' : '#334155',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>Semester {sem}</span>
                  <span style={{ fontSize: '0.7rem', color: isSelected ? '#6366F1' : '#94A3B8' }}>
                    {sem % 2 === 1 ? 'Odd Term' : 'Even Term'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Exams Per Day & Slots */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid var(--color-border)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Clock size={18} color="#4F46E5" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                3. Sessions & Time Slots Per Day
              </h3>
            </div>

            {/* Exams per day toggle */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                Maximum Examination Slots Per Day:
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[1, 2].map(num => (
                  <button
                    key={num}
                    onClick={() => handleExamsPerDayChange(num as 1 | 2)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: config.examsPerDay === num ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                      background: config.examsPerDay === num ? '#EEF2FF' : '#F8FAFC',
                      color: config.examsPerDay === num ? '#4F46E5' : '#334155',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    {num === 1 ? '1 Exam Session / Day' : '2 Exam Sessions / Day'}
                  </button>
                ))}
              </div>
            </div>

            {/* Slots selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                Active Time Windows:
              </span>
              {STANDARD_TIME_SLOTS.map(slot => {
                const isSelected = config.selectedSlots.some(s => s.id === slot.id);
                const isDisabled = !isSelected && config.examsPerDay === 1 && config.selectedSlots.length >= 1;
                return (
                  <div
                    key={slot.id}
                    onClick={() => toggleSlot(slot)}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #10B981' : (isDisabled ? '1.5px dashed #CBD5E1' : '1.5px solid #E2E8F0'),
                      background: isSelected ? '#ECFDF5' : (isDisabled ? '#F1F5F9' : '#FAFAFA'),
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.5 : 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.82rem', color: isSelected ? '#065F46' : '#1E293B' }}>
                        {slot.name}
                        {isDisabled && <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginLeft: '8px', fontWeight: 400 }}>(1 session/day limit)</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        {slot.startTime} – {slot.endTime} (3.0 Hours)
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      background: isSelected ? '#10B981' : '#CBD5E1',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '12px',
                    }}>
                      {slot.sessionPeriod}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
        {/* Validation hint */}
        {!isFormValid && (
          <div style={{ fontSize: '0.8rem', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️</span>
            <span>
              {!config.sessionName.trim() ? 'Enter a session name' :
               config.selectedDepartments.length === 0 ? 'Select at least 1 department' :
               config.selectedSemesters.length === 0 ? 'Select target semesters' :
               'Select a time slot'}
            </span>
          </div>
        )}
        {isFormValid && !saving && <div />}

        <button
          onClick={onNext}
          disabled={!isFormValid || saving}
          style={{
            background: (isFormValid && !saving) ? 'linear-gradient(135deg, #4F46E5, #6366F1)' : '#CBD5E1',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 28px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: (isFormValid && !saving) ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: (isFormValid && !saving) ? '0 4px 14px rgba(79,70,229,0.3)' : 'none',
            transition: 'all 0.2s ease',
          }}
        >
          {saving ? (
            <>⏳ Saving Session...</>
          ) : (
            <>Continue to Subject Matrix <ArrowRight size={18} /></>
          )}
        </button>
      </div>
    </div>
  );
};
