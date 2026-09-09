import React, { useState } from 'react';
import { RoomAllocationResult, AITelemetryMetrics, SessionScopeConfig } from '../types/allocationTypes';
import { BlueprintHeader } from './blueprint/BlueprintHeader';
import { RoomFloorPlan } from './blueprint/RoomFloorPlan';
import { InvigilatorDutyRoster } from './blueprint/InvigilatorDutyRoster';
import { SeatingNoticeModal } from './blueprint/SeatingNoticeModal';
import { Search, Filter, ArrowLeft } from 'lucide-react';

interface SeatingBlueprintProps {
  roomResults: RoomAllocationResult[];
  telemetry?: AITelemetryMetrics;
  scopeConfig?: SessionScopeConfig;
  sessionId?: string;
  onReturn: () => void;
}

export const SeatingBlueprint: React.FC<SeatingBlueprintProps> = ({
  roomResults,
  telemetry,
  scopeConfig,
  sessionId,
  onReturn,
}) => {
  const [activeTab, setActiveTab] = useState<'FLOOR_PLANS' | 'INVIGILATORS'>('FLOOR_PLANS');
  const [selectedHallFilter, setSelectedHallFilter] = useState<string>('ALL');
  const [searchUsn, setSearchUsn] = useState('');
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Filter halls if user selects a specific hall from dropdown
  const filteredRooms = selectedHallFilter === 'ALL'
    ? roomResults
    : roomResults.filter(r => r.roomId === selectedHallFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner & Telemetry */}
      <BlueprintHeader
        roomResults={roomResults}
        telemetry={telemetry}
        scopeConfig={scopeConfig}
        sessionId={sessionId}
        onOpenNotice={() => setShowNoticeModal(true)}
        onReturn={onReturn}
      />

      {/* Navigation Sub-Tabs and Search/Filter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'white',
        borderRadius: '14px',
        border: '1px solid var(--color-border)',
        padding: '14px 20px',
      }}>
        {/* View Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('FLOOR_PLANS')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'FLOOR_PLANS' ? '#4F46E5' : '#F1F5F9',
              color: activeTab === 'FLOOR_PLANS' ? 'white' : '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            🗺️ Interactive Floor Plans ({roomResults.length})
          </button>
          <button
            onClick={() => setActiveTab('INVIGILATORS')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'INVIGILATORS' ? '#7C3AED' : '#F1F5F9',
              color: activeTab === 'INVIGILATORS' ? 'white' : '#475569',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ⚖️ Invigilator Duty Roster
          </button>
        </div>

        {/* Filter by Hall & Search USN */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {activeTab === 'FLOOR_PLANS' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="#64748B" />
              <select
                value={selectedHallFilter}
                onChange={e => setSelectedHallFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '0.82rem',
                  background: 'white',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                <option value="ALL">All Examination Halls ({roomResults.length})</option>
                {roomResults.map(r => (
                  <option key={r.roomId} value={r.roomId}>
                    Hall {r.roomNumber} ({r.occupiedCount} Candidates)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              value={searchUsn}
              onChange={e => setSearchUsn(e.target.value)}
              placeholder="Locate student by USN..."
              style={{
                padding: '8px 12px 8px 34px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.82rem',
                outline: 'none',
                width: '180px',
              }}
            />
          </div>

          <button
            onClick={onReturn}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              background: 'white',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft size={14} /> Back to Sessions
          </button>
        </div>
      </div>

      {/* Main View Display */}
      {activeTab === 'FLOOR_PLANS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {filteredRooms.map(room => (
            <RoomFloorPlan key={room.roomId} roomResult={room} />
          ))}
        </div>
      )}

      {activeTab === 'INVIGILATORS' && (
        <InvigilatorDutyRoster roomResults={roomResults} />
      )}

      {/* Printable Notice Modal */}
      {showNoticeModal && (
        <SeatingNoticeModal
          roomResults={roomResults}
          scopeConfig={scopeConfig}
          onClose={() => setShowNoticeModal(false)}
        />
      )}
    </div>
  );
};
