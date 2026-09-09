import React from 'react';
import { DoorOpen, MapPin, UserCheck, ShieldCheck, Accessibility, BookOpen } from 'lucide-react';
import { RoomAllocationResult } from '../../types/allocationTypes';
import { BenchSeat } from './BenchSeat';
import { MOCK_DEPARTMENTS } from '../../mock/allocationMockData';

interface RoomFloorPlanProps {
  roomResult: RoomAllocationResult;
}

export const RoomFloorPlan: React.FC<RoomFloorPlanProps> = ({ roomResult }) => {
  const {
    roomNumber,
    building,
    floor,
    capacity,
    cols,
    seatedCandidates,
    occupiedCount,
    chiefInvigilator,
    relieverInvigilator,
    departmentTallies,
  } = roomResult;

  const deptMap = new Map(MOCK_DEPARTMENTS.map(d => [d.code, d]));

  // Subject distribution
  const subjectTallies: Record<string, { count: number; color: string }> = {};
  seatedCandidates.forEach(c => {
    if (!subjectTallies[c.subjectCode]) {
      subjectTallies[c.subjectCode] = { count: 0, color: c.color };
    }
    subjectTallies[c.subjectCode].count++;
  });

  const seatSlots = Array.from({ length: capacity }, (_, i) => seatedCandidates[i] || null);
  const aisleColIndex = Math.floor(cols / 2) - 1;

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      border: '1.5px solid var(--color-border)',
      overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      {/* Room Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        padding: '20px 28px',
        color: 'white',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <DoorOpen size={22} color="#38BDF8" />
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'white' }}>
                Examination Hall {roomNumber}
              </h3>
              {floor === 0 && (
                <span style={{
                  background: 'rgba(16,185,129,0.2)',
                  color: '#34D399',
                  border: '1px solid rgba(16,185,129,0.4)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}>
                  <Accessibility size={12} /> Ground Floor
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#94A3B8', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} /> {building} (Floor {floor})
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38BDF8' }}>
                <UserCheck size={13} /> Chief: {chiefInvigilator?.name}
              </span>
              {relieverInvigilator && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#A78BFA' }}>
                  <ShieldCheck size={13} /> Reliever: {relieverInvigilator.name}
                </span>
              )}
            </div>
          </div>

          {/* Occupancy Indicator */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '10px',
            padding: '10px 16px',
            border: '1px solid rgba(255,255,255,0.15)',
            textAlign: 'right',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', display: 'block' }}>
              HALL OCCUPANCY
            </span>
            <span style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white' }}>
              {occupiedCount} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#94A3B8' }}>/ {capacity}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Department + Subject Legend */}
      <div style={{
        padding: '12px 24px',
        background: '#F8FAFC',
        borderBottom: '1px solid #E2E8F0',
      }}>
        {/* Department chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            Departments:
          </span>
          {Object.entries(departmentTallies).map(([deptCode, count]) => {
            const dept = deptMap.get(deptCode);
            const color = dept?.color || '#64748B';
            return (
              <div key={deptCode} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'white',
                border: `1.5px solid ${color}33`,
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '0.72rem',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '2px', background: color }} />
                <span style={{ fontWeight: 800, color }}>{deptCode}</span>
                <span style={{ color: '#64748B', fontWeight: 600 }}>({count})</span>
              </div>
            );
          })}
        </div>

        {/* Subject chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <BookOpen size={12} /> Subjects:
          </span>
          {Object.entries(subjectTallies).map(([code, { count, color }]) => (
            <div key={code} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: `${color}10`,
              border: `1px solid ${color}30`,
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '0.68rem',
            }}>
              <span style={{ fontWeight: 800, color }}>{code}</span>
              <span style={{ color: '#64748B' }}>({count} candidates)</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', fontSize: '0.72rem', color: '#64748B' }}>
            <div style={{ width: 12, height: 12, borderRadius: '2px', border: '1.5px dashed #CBD5E1', background: '#F1F5F9' }} />
            <span>Buffer ({capacity - occupiedCount})</span>
          </div>
        </div>
      </div>

      {/* Floor Plan Seating Grid */}
      <div style={{ padding: '24px 28px' }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '20px',
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)',
          border: '1.5px dashed #86EFAC',
          borderRadius: '8px',
          fontSize: '0.78rem',
          color: '#15803D',
          fontWeight: 800,
          letterSpacing: '1px',
        }}>
          ▲ FRONT PODIUM • CHIEF INVIGILATOR DESK & SCRIPT SUBMISSION BOX
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '8px',
          justifyContent: 'center',
        }}>
          {seatSlots.map((candidate, idx) => {
            const colIndex = idx % cols;
            const isAisle = colIndex === aisleColIndex;
            return (
              <BenchSeat
                key={idx}
                candidate={candidate}
                seatNumber={idx + 1}
                hasAisleGap={isAisle}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
