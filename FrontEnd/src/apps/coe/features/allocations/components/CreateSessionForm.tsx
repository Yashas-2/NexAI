import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Sparkles } from 'lucide-react';
import { api } from '@/services/api';

interface CreateSessionFormProps {
  onCancel: () => void;
  onSave: () => void;
  onSaveAndAllocate?: (sessionId: string) => void;
}

export const CreateSessionForm: React.FC<CreateSessionFormProps> = ({
  onCancel,
  onSave,
  onSaveAndAllocate,
}) => {
  const [sessionName, setSessionName] = useState('');
  const [examType, setExamType] = useState('SEE_REGULAR');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['CSE', 'ECE', 'ME', 'CV', 'AIML', 'ISE']);
  const [selectedSemesters, setSelectedSemesters] = useState<number[]>([3, 5]);
  const [examsPerDay, setExamsPerDay] = useState<number>(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('12:30');
  const [instructions, setInstructions] = useState('');

  const [allDepartments, setAllDepartments] = useState<any[]>([]);

  useEffect(() => {
    api.get('/auth/departments/')
      .then(res => {
        const depts = res.data.results || res.data;
        // Assign some default colors for UI flavor if not provided by backend
        const colors = ['#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981'];
        setAllDepartments(depts.map((d: any, i: number) => ({
          ...d,
          color: colors[i % colors.length]
        })));
        setSelectedDepts(depts.map((d: any) => d.code));
      })
      .catch(err => console.error('Failed to load departments', err));
  }, []);

  const allSemesters = [1, 2, 3, 4, 5, 6, 7, 8];

  const toggleDept = (code: string) => {
    setSelectedDepts(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleSemester = (sem: number) => {
    setSelectedSemesters(prev =>
      prev.includes(sem) ? prev.filter(s => s !== sem) : [...prev, sem]
    );
  };

  const formatTimeTo24 = (timeStr: string): string => {
  if (!timeStr) return "09:00";
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return trimmed;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && h < 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
};

const formatTimeTo12 = (time24: string): string => {
  if (!time24) return "09:00 AM";
  const [hStr, mStr] = time24.split(":");
  if (!hStr || !mStr) return time24;
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${String(h12).padStart(2, "0")}:${mStr} ${period}`;
};

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (allocate: boolean) => {
    if (!sessionName || !startDate || !endDate || !startTime || !endTime) {
      alert("Please fill required fields");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: sessionName,
        session_type: examType === 'SEE_REGULAR' ? 'SEE' : (examType === 'SEE_SUPPLEMENTARY' ? 'SUPPLEMENTARY' : 'INTERNAL'),
        academic_year: '2026-27',
        start_date: startDate,
        end_date: endDate,
        status: 'DRAFT',
      };
      const res = await api.post('/scheduling/sessions/', payload);
      const newSession = res.data;
      
      if (allocate && onSaveAndAllocate) {
        onSaveAndAllocate(newSession.id);
      } else {
        onSave();
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save session');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <Card variant="flat" style={{ padding: '28px' }}>
        <h3 style={{ margin: '0 0 24px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          SEE Institutional Exam Session Details
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Session Name / Title
            </label>
            <input
              style={inputStyle}
              placeholder="e.g. SEE Autumn 2026 — Core Sciences & Engineering"
              value={sessionName}
              onChange={e => setSessionName(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Examination Category (CoE Mandate)
            </label>
            <select style={inputStyle} value={examType} onChange={e => setExamType(e.target.value)}>
              <option value="SEE_REGULAR">Semester End Examination (SEE) — Regular Cycle</option>
              <option value="SEE_SUPPLEMENTARY">Semester End Examination (SEE) — Fast-Track Supplementary</option>
              <option value="SEE_SPECIAL">Special Institutional Degree Examination Cycle</option>
            </select>
          </div>
        </div>

        {/* Multi-department selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            Participating Academic Departments (Interleaved Seating):
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {allDepartments.map(d => {
              const isChecked = selectedDepts.includes(d.code);
              return (
                <div
                  key={d.code}
                  onClick={() => toggleDept(d.code)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `1.5px solid ${isChecked ? d.color : '#E2E8F0'}`,
                    background: isChecked ? `${d.color}0F` : '#F8FAFC',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input type="checkbox" checked={isChecked} onChange={() => {}} />
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.85rem', color: isChecked ? d.color : '#334155' }}>
                      {d.code}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{d.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Semester Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            Target Semesters:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {allSemesters.map(sem => {
              const isSelected = selectedSemesters.includes(sem);
              return (
                <button
                  key={sem}
                  type="button"
                  onClick={() => toggleSemester(sem)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                    background: isSelected ? '#EEF2FF' : 'white',
                    color: isSelected ? '#4F46E5' : '#475569',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  Sem {sem}
                </button>
              );
            })}
          </div>
        </div>

        {/* Exams per day and date/timing */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Exams Per Day Limit
            </label>
            <select style={inputStyle} value={examsPerDay} onChange={e => setExamsPerDay(Number(e.target.value))}>
              <option value={1}>1 Exam Session / Day</option>
              <option value={2}>2 Exam Sessions / Day</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Start Date
            </label>
            <input type="date" style={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              End Date
            </label>
            <input type="date" style={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Slot Start Time
            </label>
            <input type="time" style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
              Slot End Time
            </label>
            <input type="time" style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
            Special Instructions / Anti-Cheating Directives
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="e.g. Non-programmable calculators allowed. Cross-department interleaved seating strictly enforced."
            value={instructions}
            onChange={e => setInstructions(e.target.value)}
          />
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Draft Session'}
          </Button>
          <Button
            variant="primary"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Sparkles size={16} /> Save & Launch AI Allocator
          </Button>
        </div>
      </div>
    </div>
  );
};
