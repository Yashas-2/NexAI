import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, CalendarDays, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

import { SessionList } from './components/SessionList';
import { AllocationWizard } from './components/AllocationWizard';
import { SeatingBlueprint } from './components/SeatingBlueprint';

import {
  RoomAllocationResult,
  AITelemetryMetrics,
  SessionScopeConfig,
} from './types/allocationTypes';

type ViewState = 'LIST' | 'ALLOCATE' | 'BLUEPRINT';

export const AllocationsTab: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>('LIST');
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [blueprintResults, setBlueprintResults] = useState<RoomAllocationResult[]>([]);
  const [blueprintTelemetry, setBlueprintTelemetry] = useState<AITelemetryMetrics | null>(null);
  const [blueprintScope, setBlueprintScope] = useState<SessionScopeConfig | null>(null);

  const handleCompleteAllocation = (
    results: RoomAllocationResult[],
    telemetry: AITelemetryMetrics,
    scope: SessionScopeConfig
  ) => {
    setBlueprintResults(results);
    setBlueprintTelemetry(telemetry);
    setBlueprintScope(scope);
    setViewState('BLUEPRINT');
  };

  const goToView = (state: ViewState) => {
    if (state === 'LIST') {
      setListRefreshKey(k => k + 1);
    }
    setViewState(state);
  };

  const backBtn = (
    <button
      onClick={() => goToView('LIST')}
      style={{
        background: 'rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.3)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        padding: '8px 16px',
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: '0.85rem',
      }}
    >
      <ArrowLeft size={16} /> Back to Sessions
    </button>
  );

  const headerTitles: Record<ViewState, { title: string; subtitle: string }> = {
    LIST: {
      title: 'SEE Institutional Examination Allocations',
      subtitle: 'Institution-wide semester end examinations across all departments with anti-cheating matrix.',
    },
    ALLOCATE: {
      title: 'AI Examination Allocation Wizard',
      subtitle: 'Configure scope → subjects → halls → invigilators → run solver. All 5 steps guided.',
    },
    BLUEPRINT: {
      title: 'Interleaved Seating Blueprint & Floor Plan',
      subtitle: 'Visual hall matrix, multi-department bench interleaving, and invigilation supervision roster.',
    },
  };

  const h = headerTitles[viewState];

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Decorative vector */}
      <svg
        viewBox="0 0 300 320"
        width="400"
        height="420"
        style={{ position: 'fixed', right: -50, bottom: -60, pointerEvents: 'none', opacity: 0.08, zIndex: 0 }}
      >
        <rect x="20" y="50" width="260" height="250" rx="16" fill="#4F46E5" />
        <rect x="20" y="50" width="260" height="65" rx="16" fill="#312E81" />
        <rect x="20" y="95" width="260" height="20" fill="#312E81" />
        <rect x="80" y="30" width="20" height="42" rx="10" fill="#4F46E5" />
        <rect x="200" y="30" width="20" height="42" rx="10" fill="#4F46E5" />
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <PageHeader
          title={h.title}
          subtitle={h.subtitle}
          icon={<CalendarDays size={26} />}
          accentColor="#4F46E5"
          action={
            viewState === 'LIST' ? (
              <Button
                variant="outline-inverse"
                onClick={() => {
                  setActiveSessionId(undefined);
                  setViewState('ALLOCATE');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Sparkles size={16} /> New Allocation Wizard
              </Button>
            ) : (
              backBtn
            )
          }
        />

        {/* 1. Sessions List */}
        {viewState === 'LIST' && (
          <SessionList
            key={listRefreshKey}
            onAllocate={id => {
              setActiveSessionId(id);
              setViewState('ALLOCATE');
            }}
            onView={id => {
              setActiveSessionId(id);
              setViewState('BLUEPRINT');
            }}
            onRefresh={() => setListRefreshKey(k => k + 1)}
          />
        )}

        {/* 2. AI Allocation Wizard — 5 guided steps */}
        {viewState === 'ALLOCATE' && (
          <AllocationWizard
            sessionId={activeSessionId}
            onCompleteAllocation={handleCompleteAllocation}
            onCancel={() => goToView('LIST')}
          />
        )}

        {/* 3. Seating Blueprint */}
        {viewState === 'BLUEPRINT' && blueprintTelemetry && blueprintScope && (
          <SeatingBlueprint
            roomResults={blueprintResults}
            telemetry={blueprintTelemetry}
            scopeConfig={blueprintScope}
            sessionId={activeSessionId}
            onReturn={() => goToView('LIST')}
          />
        )}
      </div>
    </div>
  );
};
