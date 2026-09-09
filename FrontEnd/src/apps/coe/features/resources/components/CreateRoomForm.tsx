import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/services/api';

interface RoomFormProps {
  initialData?: any;
  onCancel: () => void;
  onSave: () => void;
}

export const CreateRoomForm: React.FC<RoomFormProps> = ({ initialData, onCancel, onSave }) => {
  const [roomNumber, setRoomNumber] = useState(initialData?.number || '');
  const [building, setBuilding] = useState(initialData?.building || '');
  const [capacity, setCapacity] = useState(initialData?.capacity ? String(initialData.capacity) : '');
  const [roomStatus, setRoomStatus] = useState(initialData?.status || 'Available');
  const [existingBuildings, setExistingBuildings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch existing rooms to get unique building names
    api.get('/scheduling/rooms/')
      .then(res => {
        const rooms = res.data.results || res.data;
        const buildings = Array.from(new Set(rooms.map((r: any) => r.building).filter(Boolean))) as string[];
        setExistingBuildings(buildings);
      })
      .catch(console.error);
  }, []);

  const handleSaveInternal = async () => {
    if (!roomNumber || !building || !capacity) {
      alert("Please fill all fields");
      return;
    }
    
    setIsSaving(true);
    try {
      const payload = {
        name: roomNumber,
        building: building,
        total_capacity: parseInt(capacity, 10),
        exam_capacity: Math.floor(parseInt(capacity, 10) * 0.7), // rough estimate for exam capacity
        is_active: roomStatus === 'Available'
      };
      
      if (initialData?.id) {
        await api.put(`/scheduling/rooms/${initialData.id}/`, payload);
      } else {
        await api.post('/scheduling/rooms/', payload);
      }
      onSave(); // Close the form and refresh list upstream if needed
    } catch (err: any) {
      console.error(err);
      alert("Failed to save room: " + (err.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-bg-surface)',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <Card variant="flat">
        <h3 style={{ margin: '0 0 24px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>
          {initialData ? 'Edit Room Details' : 'Room Details'}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Room Number</label>
            <input style={inputStyle} placeholder="e.g. B-205" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Building / Block</label>
            <input 
              style={inputStyle} 
              placeholder="e.g. South Wing" 
              value={building} 
              onChange={e => setBuilding(e.target.value)}
              list="building-list" 
            />
            <datalist id="building-list">
              {existingBuildings.map((bldg) => (
                <option key={bldg} value={bldg} />
              ))}
            </datalist>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Seating Capacity</label>
            <input type="number" style={inputStyle} placeholder="e.g. 40" value={capacity} onChange={e => setCapacity(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.875rem', fontWeight: 500 }}>Status</label>
            <select style={inputStyle} value={roomStatus} onChange={e => setRoomStatus(e.target.value)}>
              <option value="Available">Available</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button variant="primary" onClick={handleSaveInternal} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Room'}
        </Button>
      </div>
    </div>
  );
};
