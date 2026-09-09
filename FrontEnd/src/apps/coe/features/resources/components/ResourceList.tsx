import React, { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DoorOpen, Users, MapPin, CheckCircle, GraduationCap, Cpu, Edit3, Trash2, Plus } from 'lucide-react';
import { api } from '@/services/api';
import { CreateRoomForm } from './CreateRoomForm';
import { FacultyForm } from './FacultyForm';

interface ResourceListProps {
  activeSubTab: 'ROOMS' | 'FACULTY';
  setActiveSubTab: (tab: 'ROOMS' | 'FACULTY') => void;
}

interface Room {
  id: string;
  number: string;
  building: string;
  capacity: number;
  status: 'Available' | 'Maintenance';
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  deptId: string;
  dept: string;
  roles: string[];
  status: 'Active' | 'Inactive';
}

/* ── Inline SVG decorators ─────────────────────────────────────────── */
const RoomVector = ({ color }: { color: string }) => (
  <svg viewBox="0 0 80 80" width="80" height="80" style={{ position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none', opacity: 0.1 }}>
    {/* Door outline */}
    <rect x="18" y="20" width="28" height="44" rx="2" fill={color} />
    <rect x="20" y="22" width="24" height="40" rx="1" fill="white" opacity="0.6" />
    {/* Door knob */}
    <circle cx="39" cy="44" r="2.5" fill={color} />
    {/* Floor line */}
    <line x1="10" y1="64" x2="62" y2="64" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    {/* Window */}
    <rect x="54" y="28" width="16" height="14" rx="2" fill="none" stroke={color} strokeWidth="2" />
    <line x1="54" y1="35" x2="70" y2="35" stroke={color} strokeWidth="1" />
    <line x1="62" y1="28" x2="62" y2="42" stroke={color} strokeWidth="1" />
  </svg>
);

const FacultyVector = ({ color }: { color: string }) => (
  <svg viewBox="0 0 80 80" width="80" height="80" style={{ position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none', opacity: 0.1 }}>
    {/* Graduation cap */}
    <ellipse cx="40" cy="38" rx="22" ry="6" fill={color} />
    <polygon points="40,14 62,32 40,38 18,32" fill={color} />
    {/* Tassel */}
    <line x1="62" y1="32" x2="62" y2="52" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="62" cy="55" r="3.5" fill={color} />
    {/* Diploma scroll */}
    <rect x="22" y="54" width="36" height="20" rx="4" fill="none" stroke={color} strokeWidth="2" />
    <line x1="28" y1="61" x2="52" y2="61" stroke={color} strokeWidth="1.5" />
    <line x1="28" y1="66" x2="44" y2="66" stroke={color} strokeWidth="1.5" />
  </svg>
);

/* ── Stat Card ─────────────────────────────────────────────────────── */
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
    {/* Background blob */}
    <svg style={{ position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }} width="70" height="70" viewBox="0 0 70 70">
      <circle cx="55" cy="55" r="40" fill={color} opacity="0.06" />
      <circle cx="55" cy="55" r="24" fill="none" stroke={color} strokeWidth="1.5" opacity="0.08" />
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

export const ResourceList: React.FC<ResourceListProps> = ({ activeSubTab, setActiveSubTab }) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showFacultyForm, setShowFacultyForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editingFaculty, setEditingFaculty] = useState<Faculty | null>(null);

  const fetchRooms = () => {
    api.get('/scheduling/rooms/')
      .then(res => {
        const rawRooms = res.data.results || res.data;
        setRooms(rawRooms.map((r: any) => ({
          id: r.id,
          number: r.name,
          building: r.building,
          capacity: r.exam_capacity || r.total_capacity,
          status: r.is_active ? 'Available' : 'Maintenance'
        })));
      })
      .catch(console.error);
  };

  const fetchFaculty = () => {
    api.get('/auth/users/?role=FACULTY')
      .then(res => {
        const rawFac = res.data.results || res.data;
        setFaculty(rawFac.map((f: any) => ({
          id: f.id,
          email: f.email,
          name: f.full_name,
          deptId: f.department?.id || '',
          dept: f.department ? f.department.name : 'Central',
          roles: ['Invigilator'],
          status: f.is_active ? 'Active' : 'Inactive'
        })));
      })
      .catch(console.error);
  };

  React.useEffect(() => {
    fetchRooms();
    fetchFaculty();
  }, []);

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/scheduling/rooms/${id}/`);
      fetchRooms();
    } catch (err) {
      console.error(err);
      alert('Failed to delete room');
    }
  };

  const handleDeleteFaculty = async (id: string) => {
    if (!confirm('Are you sure you want to delete this faculty member?')) return;
    try {
      await api.delete(`/auth/users/${id}/`);
      fetchFaculty();
    } catch (err) {
      console.error(err);
      alert('Failed to delete faculty');
    }
  };

  const availableRooms = rooms.filter(r => r.status === 'Available').length;
  const totalCapacity  = rooms.reduce((sum, r) => sum + r.capacity, 0);

  return (
    <>
      {/* Segmented Control */}
      <div style={{ display: 'inline-flex', background: 'var(--color-primary-light)', padding: '6px', borderRadius: 'calc(var(--radius-md) + 2px)', marginBottom: '24px', border: '1px solid var(--color-border)' }}>
        {(['ROOMS', 'FACULTY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            style={{
              padding: '10px 28px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeSubTab === tab ? 'white' : 'transparent',
              color: activeSubTab === tab ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: activeSubTab === tab ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {tab === 'ROOMS' ? <DoorOpen size={16} /> : <GraduationCap size={16} />}
            {tab === 'ROOMS' ? 'Exam Rooms' : 'Faculty / Invigilators'}
          </button>
        ))}
      </div>

      {activeSubTab === 'ROOMS' ? (
        showRoomForm || editingRoom ? (
          <CreateRoomForm 
            initialData={editingRoom}
            onCancel={() => { setShowRoomForm(false); setEditingRoom(null); }} 
            onSave={() => { setShowRoomForm(false); setEditingRoom(null); fetchRooms(); }} 
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
              <StatCard icon={<DoorOpen size={20} />}    label="Total Rooms"      value={rooms.length}   color="#3b82f6" />
              <StatCard icon={<CheckCircle size={20} />} label="Available Rooms"  value={availableRooms} color="#48977f" />
              <StatCard icon={<Users size={20} />}       label="Total Capacity"   value={totalCapacity}  color="#8b5cf6" />
            </div>
            <div style={{ marginLeft: '16px' }}>
              <Button variant="primary" onClick={() => setShowRoomForm(true)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Plus size={16} /> Add Exam Room
              </Button>
            </div>
          </div>

          {/* Room Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {rooms.map((room) => {
              const isAvailable = room.status === 'Available';
              const color = isAvailable ? '#48977f' : '#ed7245';
              return (
                <div key={room.number} style={{
                  background: 'white',
                  borderRadius: '14px',
                  border: `1px solid ${color}22`,
                  borderTop: `4px solid ${color}`,
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 10px 28px ${color}22`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                >
                  {/* Room-themed SVG vector */}
                  <RoomVector color={color} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Room</span>
                      <h3 style={{ margin: '2px 0 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>{room.number}</h3>
                    </div>
                    <Badge variant={isAvailable ? 'success' : 'warning'}>{room.status}</Badge>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '0.83rem' }}>
                      <MapPin size={13} /> {room.building}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-text-secondary)', fontSize: '0.83rem' }}>
                      <Users size={13} />
                      <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{room.capacity}</span> Seats
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div style={{ marginTop: '14px', height: '4px', borderRadius: '4px', background: `${color}18`, position: 'relative', zIndex: 1, marginBottom: '12px' }}>
                    <div style={{ height: '100%', width: `${Math.min((room.capacity / 60) * 100, 100)}%`, background: color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                  
                  {/* Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', position: 'relative', zIndex: 1, borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                    <button onClick={() => setEditingRoom(room)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDeleteRoom(room.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      ) : (
        showFacultyForm || editingFaculty ? (
          <FacultyForm 
            initialData={editingFaculty}
            onCancel={() => { setShowFacultyForm(false); setEditingFaculty(null); }} 
            onSave={() => { setShowFacultyForm(false); setEditingFaculty(null); fetchFaculty(); }} 
          />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stats & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
              <StatCard icon={<GraduationCap size={20} />} label="Total Faculty" value={faculty.length} color="#3b82f6" />
              <StatCard icon={<CheckCircle size={20} />}   label="Active"        value={faculty.filter(f => f.status === 'Active').length} color="#48977f" />
              <StatCard icon={<Cpu size={20} />}           label="Avg. Roles"    value={(faculty.reduce((s, f) => s + f.roles.length, 0) / (faculty.length || 1)).toFixed(1)} color="#8b5cf6" />
            </div>
            <div style={{ marginLeft: '16px' }}>
              <Button variant="primary" onClick={() => setShowFacultyForm(true)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Plus size={16} /> Add Faculty
              </Button>
            </div>
          </div>

          {/* Faculty Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {faculty.map((f, i) => {
              const colors = ['#48977f', '#3b82f6', '#8b5cf6'];
              const color  = colors[i % colors.length];
              const initials = f.name.replace('Dr. ', '').split(' ').slice(0, 2).map((w: string) => w[0]).join('');
              return (
                <div key={f.name} style={{
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
                  position: 'relative',
                  overflow: 'hidden',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 24px ${color}22`; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
                >
                  {/* Faculty-themed SVG vector */}
                  <FacultyVector color={color} />

                  {/* Avatar */}
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: `${color}15`, border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontWeight: 800, fontSize: '1rem', flexShrink: 0, position: 'relative', zIndex: 1 }}>
                    {initials}
                  </div>

                  <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, fontSize: '0.95rem' }}>{f.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{f.dept}</p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', position: 'relative', zIndex: 1 }}>
                    {f.roles.map(role => (
                      <span key={role} style={{ background: `${color}15`, color, border: `1px solid ${color}33`, padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>{role}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', position: 'relative', zIndex: 1 }}>
                    <Badge variant={f.status === 'Active' ? 'success' : 'warning'}>{f.status}</Badge>
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button onClick={() => setEditingFaculty(f)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        <Edit3 size={16} />
                      </button>
                      <button onClick={() => handleDeleteFaculty(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )
      )}
    </>
  );
};
