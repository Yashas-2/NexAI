import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Layers,
  ShieldCheck,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

import { MainEvaluatorOverviewTab } from './features/overview/MainEvaluatorOverviewTab';
import { BundleManagementTab } from './features/bundles/BundleManagementTab';
import { MarksTotalingVerificationTab } from './features/verification/MarksTotalingVerificationTab';
import { CoEDispatchTab } from './features/dispatch/CoEDispatchTab';

type ScrutinizerTab = 'OVERVIEW' | 'BUNDLES' | 'VERIFY' | 'LEDGER';

export default function ScrutinizerDashboard() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const [activeTab, setActiveTab] = useState<ScrutinizerTab>('OVERVIEW');

  const sidebarItems = [
    { id: 'OVERVIEW', label: 'Main Evaluator & Bundle Custodian', icon: <Layers size={20} /> },
    { id: 'BUNDLES', label: 'Bundle Creation & Allocation', icon: <UserCheck size={20} /> },
    { id: 'VERIFY', label: 'Marks Totaling & Verification', icon: <AlertTriangle size={20} /> },
    { id: 'LEDGER', label: 'CoE Grade Ledger & Dispatch', icon: <ShieldCheck size={20} /> },
  ];

  const headerConfig: Record<ScrutinizerTab, { title: string; subtitle: string; icon: React.ReactNode; accentColor: string }> = {
    OVERVIEW: {
      title: 'Main Evaluator & Bundle Custodian',
      subtitle: 'Receive completed SEE answer booklets, create bundles, allocate evaluators, and track the valuation pipeline.',
      icon: <Layers size={26} />,
      accentColor: '#3b82f6',
    },
    BUNDLES: {
      title: 'Main Evaluator Operations — Bundles & Allocation',
      subtitle: 'File answer booklets into numbered bundles, generate bundle numbers, assign evaluators, and track bundle status.',
      icon: <UserCheck size={26} />,
      accentColor: '#48977f',
    },
    VERIFY: {
      title: 'Marks Totaling & Verification',
      subtitle: 'Verify question-wise marks, totals, missing marks, unanswered questions, and evaluator submission status.',
      icon: <AlertTriangle size={26} />,
      accentColor: '#f59e0b',
    },
    LEDGER: {
      title: 'CoE Grade Ledger & Dispatch',
      subtitle: 'Certify verified results, publish them into the CoE grade ledger, and dispatch / finalize for students.',
      icon: <ShieldCheck size={26} />,
      accentColor: '#10b981',
    },
  };

  const currentHeader = headerConfig[activeTab];

  return (
    <MainLayout
      userName={user?.full_name || 'Main Evaluator'}
      userRole="Main Evaluator"
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={id => setActiveTab(id as ScrutinizerTab)}
      onLogout={logout}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* ── Large Decorative Vector (Bottom-Right) ── */}
        <svg
          viewBox="0 0 340 340"
          width="420"
          height="420"
          style={{
            position: 'fixed',
            right: -50,
            bottom: -60,
            pointerEvents: 'none',
            opacity: 0.08,
            zIndex: 0,
          }}
        >
          <rect x="60" y="80" width="220" height="180" rx="16" fill="#48977f" />
          <line x1="60" y1="140" x2="280" y2="140" stroke="white" strokeWidth="4" />
          <circle cx="210" cy="190" r="50" fill="none" stroke="white" strokeWidth="8" />
          <line x1="245" y1="225" x2="280" y2="260" stroke="white" strokeWidth="12" strokeLinecap="round" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Page Header */}
          <PageHeader
            title={currentHeader.title}
            subtitle={currentHeader.subtitle}
            icon={currentHeader.icon}
            accentColor={currentHeader.accentColor}
          />

          {/* ── Tab Views (self-fetching, real backend data) ── */}
          {activeTab === 'OVERVIEW' && (
            <MainEvaluatorOverviewTab
              onNavigateToBundles={() => setActiveTab('BUNDLES')}
              onNavigateToVerification={() => setActiveTab('VERIFY')}
              onNavigateToLedger={() => setActiveTab('LEDGER')}
            />
          )}

          {activeTab === 'BUNDLES' && <BundleManagementTab />}

          {activeTab === 'VERIFY' && <MarksTotalingVerificationTab />}

          {activeTab === 'LEDGER' && <CoEDispatchTab />}
        </div>
      </div>
    </MainLayout>
  );
}
