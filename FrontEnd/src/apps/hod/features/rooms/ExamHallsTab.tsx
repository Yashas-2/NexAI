import React, { useState } from 'react';
import { ExamHall } from '../../types';
import { Badge } from '@/components/ui/Badge';
import { api } from '@/services/api';
import {
  Building,
  Plus,
  Tv,
  Users,
  X,
  Calendar,
  Grid,
  Trash2,
  Pencil
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  halls: ExamHall[];
  onUpdateHalls: (halls: ExamHall[]) => void;
}

export const ExamHallsTab: React.FC<Props> = ({ halls, onUpdateHalls }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHall, setEditingHall] = useState<ExamHall | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [blockName, setBlockName] = useState('Aryabhata Academic Block - 1st Floor');
  const [rowsCount, setRowsCount] = useState(6);
  const [colsCount, setColsCount] = useState(6);
  const [benchType, setBenchType] = useState<'SINGLE_SEATER' | 'DOUBLE_SEATER'>('SINGLE_SEATER');
  const [isCCTVEnabled, setIsCCTVEnabled] = useState(true);
  const [isAC, setIsAC] = useState(true);

  const totalCapacity = halls.reduce((sum, h) => sum + (h.status === 'ACTIVE' ? h.capacity : 0), 0);
  const activeRooms = halls.filter(h => h.status === 'ACTIVE').length;
  const cctvRooms = halls.filter(h => h.isCCTVEnabled).length;

  const handleCreateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim()) {
      toast.error('Please specify a room number (e.g. Hall C-103)');
      return;
    }

    try {
      const res = await api.post('/scheduling/rooms/', {
        name: roomNumber.trim(),
        building: blockName.trim(),
        floor: 0,
        rows_count: rowsCount,
        cols_count: colsCount,
        bench_style: benchType,
        total_capacity: rowsCount * colsCount,
        exam_capacity: rowsCount * colsCount,
        has_cctv: isCCTVEnabled,
        has_wifi: isAC,
        is_lab: false,
      });

      const saved = res.data;
      const newHall: ExamHall = {
        id: saved.id,
        roomNumber: saved.name,
        blockName: `${saved.building} - Floor ${saved.floor ?? 0}`,
        rowsCount: saved.rows_count || rowsCount,
        colsCount: saved.cols_count || colsCount,
        capacity: saved.exam_capacity,
        benchType: (saved.bench_style || benchType) as 'SINGLE_SEATER' | 'DOUBLE_SEATER',
        isCCTVEnabled: saved.has_cctv,
        isAC: saved.has_wifi,
        status: 'ACTIVE',
        lastAnnualAuditDate: new Date().toISOString().split('T')[0],
      };

      onUpdateHalls([...halls, newHall]);
      toast.success(`Registered ${newHall.roomNumber} with ${saved.exam_capacity} seats!`);
      setIsModalOpen(false);
      setRoomNumber('');
    } catch (err: any) {
      // Show backend validation errors properly
      const data = err.response?.data;
      if (data) {
        const firstField = Object.keys(data)[0];
        const msg = Array.isArray(data[firstField]) ? data[firstField][0] : data[firstField];
        toast.error(msg || 'Failed to register room');
      } else {
        toast.error('Failed to register room');
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    const hall = halls.find(h => h.id === id);
    if (!hall) return;
    const nextStatus = hall.status === 'ACTIVE' ? false : true;
    try {
      await api.patch(`/scheduling/rooms/${id}/`, { is_active: nextStatus });
      const updated = halls.map(h =>
        h.id === id ? { ...h, status: nextStatus ? 'ACTIVE' : 'MAINTENANCE' as 'ACTIVE' | 'MAINTENANCE' } : h
      );
      onUpdateHalls(updated);
      toast.success(`${hall.roomNumber} ${nextStatus ? 'activated' : 'set to maintenance'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteHall = async (id: string) => {
    const hall = halls.find(h => h.id === id);
    if (!hall) return;
    if (!confirm(`Delete ${hall.roomNumber}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/scheduling/rooms/${id}/`);
      onUpdateHalls(halls.filter(h => h.id !== id));
      toast.success(`${hall.roomNumber} deleted`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete room');
    }
  };

  const openEditModal = (hall: ExamHall) => {
    setEditingHall(hall);
    setRoomNumber(hall.roomNumber);
    // Strip trailing "- Floor X" from the display blockName before editing
    setBlockName(hall.blockName.replace(/\s*-\s*Floor\s+\d+$/i, '').trim());
    setRowsCount(hall.rowsCount || 6);
    setColsCount(hall.colsCount || 6);
    setBenchType(hall.benchType || 'SINGLE_SEATER');
    setIsCCTVEnabled(hall.isCCTVEnabled);
    setIsAC(hall.isAC);
    setIsEditModalOpen(true);
  };


  const handleUpdateHall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHall) return;
    try {
      const res = await api.patch(`/scheduling/rooms/${editingHall.id}/`, {
        name: roomNumber.trim(),
        building: blockName.trim(),
        rows_count: rowsCount,
        cols_count: colsCount,
        bench_style: benchType,
        total_capacity: rowsCount * colsCount,
        exam_capacity: rowsCount * colsCount,
        has_cctv: isCCTVEnabled,
        has_wifi: isAC,
      });
      const saved = res.data;
      const updated = halls.map(h => {
        if (h.id === editingHall.id) {
          return {
            ...h,
            roomNumber: saved.name,
            blockName: `${saved.building} - Floor ${saved.floor ?? 0}`,
            rowsCount: saved.rows_count || rowsCount,
            colsCount: saved.cols_count || colsCount,
            capacity: saved.exam_capacity,
            benchType: (saved.bench_style || benchType) as 'SINGLE_SEATER' | 'DOUBLE_SEATER',
            isCCTVEnabled: saved.has_cctv,
            isAC: saved.has_wifi,
          };
        }
        return h;
      });
      onUpdateHalls(updated);
      toast.success(`${saved.name} updated`);
      setIsEditModalOpen(false);
      setEditingHall(null);
    } catch (err: any) {
      const data = err.response?.data;
      if (data) {
        const firstField = Object.keys(data)[0];
        const msg = Array.isArray(data[firstField]) ? data[firstField][0] : data[firstField];
        toast.error(msg || 'Failed to update room');
      } else {
        toast.error('Failed to update room');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── Top Telemetry Stat Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Total Campus Halls
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {halls.length} Halls
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
            {activeRooms} Operational for Examinations
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Simultaneous Seating Capacity
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#ECFDF5', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {totalCapacity} Seats
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Available per examination slot
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              CCTV AI Surveillance
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tv size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            {cctvRooms} / {halls.length} Covered
          </div>
          <div style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600, marginTop: '4px' }}>
            Anti-cheating optical streams active
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '18px 20px',
          borderRadius: '16px',
          border: '1.5px solid #E2E8F0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
              Annual Infrastructure Audit
            </span>
            <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#F3E8FF', color: '#9333EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div style={{ fontSize: '1.7rem', fontWeight: 800, color: '#0F172A' }}>
            AY 2026-27
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
            Configured once per academic year
          </div>
        </div>
      </div>

      {/* ── Action Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white',
        padding: '16px 22px',
        borderRadius: '14px',
        border: '1.5px solid #E2E8F0',
      }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
            Department Examination Halls & Room Inventory
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
            Entered annually by HOD. The AI Seating Engine uses these physical room parameters to generate multi-semester seat allocations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '9px 18px',
            borderRadius: '9px',
            border: 'none',
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(79,70,229,0.25)',
          }}
        >
          <Plus size={16} /> Register New Exam Hall
        </button>
      </div>

      {/* ── Halls Table ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid #E2E8F0',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead style={{ background: '#F8FAFC', color: '#475569', fontWeight: 800, borderBottom: '1px solid #CBD5E1' }}>
              <tr>
                <th style={{ padding: '14px 20px' }}>Hall / Room No.</th>
                <th style={{ padding: '14px 16px' }}>Campus Block & Floor</th>
                <th style={{ padding: '14px 16px' }}>Grid Layout (Rows × Cols)</th>
                <th style={{ padding: '14px 16px' }}>Capacity</th>
                <th style={{ padding: '14px 16px' }}>Bench Style</th>
                <th style={{ padding: '14px 16px' }}>Facilities</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {halls.map(hall => (
                <tr key={hall.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>
                      {hall.roomNumber}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                      Audit: {hall.lastAnnualAuditDate}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#334155' }}>
                    {hall.blockName}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: '#F1F5F9',
                      color: '#475569',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      <Grid size={12} /> {hall.rowsCount} Rows × {hall.colsCount} Cols
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#16A34A' }}>
                      {hall.capacity}
                    </strong> Candidates
                  </td>

                  <td style={{ padding: '14px 16px', color: '#475569', fontWeight: 600 }}>
                    {hall.benchType === 'SINGLE_SEATER' ? 'Single Seater' : 'Double Seater'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {hall.isCCTVEnabled && (
                        <span title="CCTV Camera" style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                          CCTV
                        </span>
                      )}
                      {hall.isAC && (
                        <span title="Air Conditioned" style={{ background: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800 }}>
                          AC
                        </span>
                      )}
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {hall.status === 'ACTIVE' ? (
                      <Badge variant="success">ACTIVE FOR EXAMS</Badge>
                    ) : (
                      <Badge variant="danger">UNDER MAINTENANCE</Badge>
                    )}
                  </td>

                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => openEditModal(hall)}
                        title="Edit Room"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: 'white',
                          color: '#4F46E5',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(hall.id)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: 'white',
                          color: hall.status === 'ACTIVE' ? '#B45309' : '#15803D',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {hall.status === 'ACTIVE' ? 'Maintenance' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDeleteHall(hall.id)}
                        title="Delete Room"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #FECDD3',
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Annual Registration Modal ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                    Annual Exam Hall Registration
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
                    Register physical examination room and bench grid dimensions
                  </p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateHall}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Hall / Room Number *
                  </label>
                  <input
                    id="room-number"
                    name="room-number"
                    type="text"
                    required
                    value={roomNumber}
                    onChange={e => setRoomNumber(e.target.value)}
                    placeholder="e.g. Hall C-103, Seminar Hall 02, Lab 04"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Campus Block & Floor Location *
                  </label>
                  <input
                    id="block-name"
                    name="block-name"
                    type="text"
                    required
                    list="building-suggestions"
                    value={blockName}
                    onChange={e => setBlockName(e.target.value)}
                    placeholder="e.g. MB Block, Aryabhata Academic Block - 1st Floor"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                  />
                  <datalist id="building-suggestions">
                    {Array.from(new Set(halls.map(h => h.blockName))).map(name => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                      Rows Count *
                    </label>
                    <input
                      id="rows-count"
                      name="rows-count"
                      type="number"
                      min="2"
                      max="20"
                      required
                      value={rowsCount}
                      onChange={e => setRowsCount(parseInt(e.target.value) || 2)}
                      style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                      Columns Count *
                    </label>
                    <input
                      id="cols-count"
                      name="cols-count"
                      type="number"
                      min="2"
                      max="20"
                      required
                      value={colsCount}
                      onChange={e => setColsCount(parseInt(e.target.value) || 2)}
                      style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                      Computed Seats
                    </label>
                    <div style={{
                      padding: '9px',
                      borderRadius: '8px',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      color: '#065F46',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      textAlign: 'center',
                    }}>
                      {rowsCount * colsCount} Seats
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Bench Style
                  </label>
                  <select
                    id="bench-type"
                    name="bench-type"
                    value={benchType}
                    onChange={e => setBenchType(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, background: 'white', boxSizing: 'border-box' }}
                  >
                    <option value="SINGLE_SEATER">Single Seater (1 candidate per bench - Anti-malpractice recommended)</option>
                    <option value="DOUBLE_SEATER">Double Seater (2 candidates with middle gap)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '20px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      id="cctv-enabled"
                      name="cctv-enabled"
                      type="checkbox"
                      checked={isCCTVEnabled}
                      onChange={e => setIsCCTVEnabled(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#4F46E5' }}
                    />
                    CCTV Proctoring Active
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input
                      id="is-ac"
                      name="is-ac"
                      type="checkbox"
                      checked={isAC}
                      onChange={e => setIsAC(e.target.checked)}
                      style={{ width: 16, height: 16, accentColor: '#4F46E5' }}
                    />
                    Air Conditioned
                  </label>
                </div>

              </div>

              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC',
              }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                  }}
                >
                  Confirm & Save Hall to Registry ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Room Modal ── */}
      {isEditModalOpen && editingHall && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '560px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
            border: '1px solid #E2E8F0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                    Edit Exam Hall
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748B' }}>
                    Update room details for {editingHall.roomNumber}
                  </p>
                </div>
              </div>
              <button onClick={() => { setIsEditModalOpen(false); setEditingHall(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateHall}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Hall / Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={roomNumber}
                    onChange={e => setRoomNumber(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Campus Block & Floor *
                  </label>
                  <input
                    type="text"
                    required
                    value={blockName}
                    onChange={e => setBlockName(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Rows</label>
                    <input type="number" min="2" max="20" required value={rowsCount} onChange={e => setRowsCount(parseInt(e.target.value) || 2)} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Columns</label>
                    <input type="number" min="2" max="20" required value={colsCount} onChange={e => setColsCount(parseInt(e.target.value) || 2)} style={{ width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>Seats</label>
                    <div style={{ padding: '9px', borderRadius: '8px', background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}>
                      {rowsCount * colsCount}
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>Bench Style</label>
                  <select value={benchType} onChange={e => setBenchType(e.target.value as any)} style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, background: 'white', boxSizing: 'border-box' }}>
                    <option value="SINGLE_SEATER">Single Seater</option>
                    <option value="DOUBLE_SEATER">Double Seater</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '20px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isCCTVEnabled} onChange={e => setIsCCTVEnabled(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#4F46E5' }} />
                    CCTV
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                    <input type="checkbox" checked={isAC} onChange={e => setIsAC(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#4F46E5' }} />
                    AC
                  </label>
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFC' }}>
                <button type="button" onClick={() => { setIsEditModalOpen(false); setEditingHall(null); }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" style={{ padding: '9px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)', color: 'white', fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
                  Save Changes ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
