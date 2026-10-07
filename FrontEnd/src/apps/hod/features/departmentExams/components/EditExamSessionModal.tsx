import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calendar, Clock, Building } from 'lucide-react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  session: any;
  halls: { id: string; roomNumber: string; capacity: number }[];
  onClose: () => void;
  onSaved: (updated: any) => void;
}

export const EditExamSessionModal: React.FC<Props> = ({ isOpen, session, halls, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [examsPerDay, setExamsPerDay] = useState(2);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [slot1Start, setSlot1Start] = useState('09:30');
  const [slot1End, setSlot1End] = useState('11:00');
  const [slot2Start, setSlot2Start] = useState('14:00');
  const [slot2End, setSlot2End] = useState('15:30');
  const [slot3Start, setSlot3Start] = useState('16:00');
  const [slot3End, setSlot3End] = useState('17:30');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return;
    setName(session.name || session.title || '');
    setStartDate(session.start_date || session.examDate || '');
    setEndDate(session.end_date || session.endDate || session.start_date || session.examDate || '');
    setExamsPerDay(session.exams_per_day || session.examsPerDay || 2);
    setSelectedRooms(session.selected_rooms || session.roomsAllocated || []);

    // Parse time slots — could be array from backend, or comma-separated string, or single timeSlot string
    let slots: string[] = [];
    if (session.selected_slots && session.selected_slots.length > 0) {
      slots = session.selected_slots;
    } else if (session.timeSlot && typeof session.timeSlot === 'string') {
      // timeSlot is a date range string like "2026-09-14 to 2026-09-14" — not actual time slots
      // Try to split by comma if it contains multiple slots
      slots = session.timeSlot.includes(',') ? session.timeSlot.split(',').map((s: string) => s.trim()) : [];
    }

    if (slots.length >= 1) {
      const parts1 = slots[0].split(/\s*[-–]\s*/);
      setSlot1Start(parts1[0]?.trim() || '09:30');
      setSlot1End(parts1[1]?.trim() || '11:00');
    }
    if (slots.length >= 2) {
      const parts2 = slots[1].split(/\s*[-–]\s*/);
      setSlot2Start(parts2[0]?.trim() || '14:00');
      setSlot2End(parts2[1]?.trim() || '15:30');
    }
    if (slots.length >= 3) {
      const parts3 = slots[2].split(/\s*[-–]\s*/);
      setSlot3Start(parts3[0]?.trim() || '16:00');
      setSlot3End(parts3[1]?.trim() || '17:30');
    }
  }, [isOpen, session]);

  const buildSlots = () => {
    const slots = [`${slot1Start} - ${slot1End}`];
    if (examsPerDay >= 2) slots.push(`${slot2Start} - ${slot2End}`);
    if (examsPerDay >= 3) slots.push(`${slot3Start} - ${slot3End}`);
    return slots;
  };

  const toggleRoom = (roomName: string) => {
    setSelectedRooms(prev =>
      prev.includes(roomName) ? prev.filter(r => r !== roomName) : [...prev, roomName]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Session name is required'); return; }
    if (!startDate) { toast.error('Start date is required'); return; }
    if (selectedRooms.length === 0) { toast.error('Select at least one room'); return; }

    setSaving(true);
    try {
      const payload: any = {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate || startDate,
        exams_per_day: examsPerDay,
        selected_slots: buildSlots(),
        selected_rooms: selectedRooms,
      };

      const res = await api.patch(`/scheduling/sessions/${session.id}/`, payload);
      toast.success('Session updated successfully');
      onSaved(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to update session');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: '1.2rem',
    }}>
      <div style={{
        background: '#FFF', borderRadius: '20px', maxWidth: '720px', width: '100%',
        maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)',
        border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #E2E8F0',
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E293B 100%)',
          color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#A5B4FC', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Edit Examination Session
            </div>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.15rem', fontWeight: 800 }}>{name || 'Session'}</h3>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Session Name */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
              <Calendar size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Session Name
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>Start Date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>End Date</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '10px', fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Exams Per Day */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '4px' }}>
              <Clock size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Exams Per Day
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setExamsPerDay(n)}
                  style={{
                    padding: '8px 20px', borderRadius: '10px', border: examsPerDay === n ? '2px solid #4F46E5' : '1px solid #D1D5DB',
                    background: examsPerDay === n ? '#EEF2FF' : '#F9FAFB', color: examsPerDay === n ? '#4F46E5' : '#6B7280',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                  }}>
                  {n} Exam{n > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slots */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
              <Clock size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Time Slots
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Slot 1</span>
                <input value={slot1Start} onChange={e => setSlot1Start(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                <input value={slot1End} onChange={e => setSlot1End(e.target.value)}
                  style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
              </div>
              {examsPerDay >= 2 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Slot 2</span>
                  <input value={slot2Start} onChange={e => setSlot2Start(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                  <input value={slot2End} onChange={e => setSlot2End(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}
              {examsPerDay >= 3 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600 }}>Slot 3</span>
                  <input value={slot3Start} onChange={e => setSlot3Start(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                  <input value={slot3End} onChange={e => setSlot3End(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '0.82rem', width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
          </div>

          {/* Rooms */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '8px' }}>
              <Building size={13} style={{ marginRight: 4, verticalAlign: -2 }} />Rooms / Halls
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {halls.map(hall => {
                const isSelected = selectedRooms.includes(hall.roomNumber);
                return (
                  <button key={hall.id} onClick={() => toggleRoom(hall.roomNumber)}
                    style={{
                      padding: '8px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      border: isSelected ? '2px solid #4F46E5' : '1px solid #D1D5DB',
                      background: isSelected ? '#EEF2FF' : '#F9FAFB',
                      color: isSelected ? '#4F46E5' : '#6B7280',
                      transition: 'all 0.15s',
                    }}>
                    {hall.roomNumber} ({hall.capacity})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC',
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
        }}>
          <button onClick={onClose}
            style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #D1D5DB', background: '#FFF', color: '#6B7280', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#4F46E5', color: '#FFF', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem', opacity: saving ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
