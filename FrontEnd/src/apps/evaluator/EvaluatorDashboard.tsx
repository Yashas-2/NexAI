import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Layers,
  PenTool,
  AlertTriangle,
  Award,
  KeyRound,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

import { SEEWorklistTab, SEEBundle } from './features/worklist/SEEWorklistTab';
import { SEESubmissionsPanel } from '@/apps/faculty/features/seeValuation/SEESubmissionsPanel';
import { SEEIntegrityReviewTab, SEEValuationLedgerTab } from './features/review/SEEReviewTabs';

type EvaluatorTab = 'WORKLIST' | 'STUDIO' | 'CHIEF_REVIEW' | 'LEDGER';

export default function EvaluatorDashboard() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionKey = searchParams.get('sessionKey');

  // Read bundle info from query params (after redeem from faculty)
  const bundleIdParam = searchParams.get('bundleId');
  const bundleNameParam = searchParams.get('bundleName');
  const subjectCodeParam = searchParams.get('subjectCode');
  const subjectIdParam = searchParams.get('subjectId');
  const examSessionIdParam = searchParams.get('examSessionId');
  const evaluatorNameParam = searchParams.get('evaluatorName');

  // Master State
  const [activeTab, setActiveTab] = useState<EvaluatorTab>('WORKLIST');
  const [activeBundle, setActiveBundle] = useState<SEEBundle | null>(null);

  // Auto-select bundle from query params (after redeem)
  useEffect(() => {
    if (bundleIdParam && bundleNameParam && subjectIdParam && examSessionIdParam) {
      const bundle: SEEBundle = {
        id: bundleIdParam,
        name: bundleNameParam,
        evaluator: user?.id ?? null,
        evaluator_name: evaluatorNameParam || user?.full_name || 'Evaluator',
        subject: subjectIdParam,
        subject_code: subjectCodeParam || '',
        exam_session: examSessionIdParam,
        created_at: new Date().toISOString(),
        status: 'IN_PROGRESS',
      };
      setActiveBundle(bundle);
      setActiveTab('STUDIO');
      // Clear URL params after using them
      navigate('/evaluator', { replace: true });
    }
  }, [bundleIdParam, bundleNameParam, subjectIdParam, examSessionIdParam, user?.id, user?.full_name, navigate]);

  const sidebarItems = [
    { id: 'WORKLIST', label: 'Valuation Queue', icon: <Layers size={20} /> },
    { id: 'STUDIO', label: 'Marking Studio', icon: <PenTool size={20} /> },
    { id: 'CHIEF_REVIEW', label: 'Chief Referee Review', icon: <AlertTriangle size={20} /> },
    { id: 'LEDGER', label: 'Valuation Ledger', icon: <Award size={20} /> },
  ];

  const headerConfig: Record<EvaluatorTab, { title: string; subtitle: string; icon: React.ReactNode; accentColor: string }> = {
    WORKLIST: {
      title: 'Central Digital Valuation Workspace',
      subtitle: 'Your assigned SEE valuation bundles — open a bundle to grade the submitted digital answer scripts.',
      icon: <Layers size={26} />,
      accentColor: '#3b82f6',
    },
    STUDIO: {
      title: 'On-Screen Marking Studio',
      subtitle: 'Handwriting pages + OCR text per question with direct marks entry; totals sync into the student result ledger.',
      icon: <PenTool size={26} />,
      accentColor: '#48977f',
    },
    CHIEF_REVIEW: {
      title: 'Integrity & Completion Review',
      subtitle: 'Attempts flagged for proctor strikes or valuation still in progress.',
      icon: <AlertTriangle size={26} />,
      accentColor: '#ef4444',
    },
    LEDGER: {
      title: 'Valuation Ledger',
      subtitle: 'Everything you have graded — attempt totals, progress and a print-ready record.',
      icon: <Award size={26} />,
      accentColor: '#8b5cf6',
    },
  };

  const currentHeader = headerConfig[activeTab];

  return (
    <MainLayout
      userName={user?.full_name || 'Dr. Edsger Dijkstra'}
      userRole="Central Valuation Examiner"
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={id => setActiveTab(id as EvaluatorTab)}
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
          {/* Digital Pen & Certificate Stamp Vector */}
          <circle cx="170" cy="170" r="130" fill="none" stroke="#48977f" strokeWidth="8" strokeDasharray="12 8" />
          <polygon points="170,40 210,130 170,250 130,130" fill="#48977f" />
          <circle cx="170" cy="130" r="20" fill="white" />
          <path d="M110,210 L170,270 L230,210" fill="none" stroke="#48977f" strokeWidth="6" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Active Session Key Banner */}
          {sessionKey && (
            <div style={{
              background: 'linear-gradient(90deg, #1E293B 0%, #0F172A 100%)',
              color: 'white',
              padding: '12px 20px',
              borderRadius: '14px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 14px rgba(15,23,42,0.15)',
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  background: '#48977F',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <KeyRound size={20} color="white" />
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>SEE Valuation Session Key: <strong style={{ color: '#48977F' }}>{sessionKey}</strong></span>
                    <span style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', color: '#94A3B8' }}>
                      Active • Evaluator: {user?.full_name || 'Faculty Evaluator'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    Double-blind valuation mode. Completing evaluation batch seals marks and releases key.
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  toast.success('Valuation batch completed! Session key terminated. Returning to Faculty Workspace...');
                  navigate('/faculty');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #48977F 0%, #2F6852 100%)',
                  color: 'white',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(72,151,127,0.3)',
                }}
              >
                <CheckCircle2 size={16} /> Complete Evaluation Batch & Exit Session
              </button>
            </div>
          )}

          {/* Page Header (Rendered when not in full studio mode) */}
          {activeTab !== 'STUDIO' && (
            <PageHeader
              title={currentHeader.title}
              subtitle={currentHeader.subtitle}
              icon={currentHeader.icon}
              accentColor={currentHeader.accentColor}
            />
          )}

          {/* ── Tab Views ── */}
          {activeTab === 'WORKLIST' && (
            <SEEWorklistTab
              activeBundle={activeBundle}
              onActiveBundleChange={setActiveBundle}
            />
          )}

          {activeTab === 'STUDIO' && (
            activeBundle ? (
              <SEESubmissionsPanel
                subjectId={activeBundle.subject}
                examSessionId={activeBundle.exam_session}
                canDistribute={false}
              />
            ) : (
              <div style={{
                background: 'white', padding: '40px', borderRadius: '16px',
                textAlign: 'center', border: '1.5px dashed var(--color-border)',
              }}>
                <p style={{ fontWeight: 800, color: '#0F172A' }}>No bundle selected for marking.</p>
                <p style={{ fontSize: '0.84rem', color: '#64748B', marginTop: '4px' }}>
                  Pick a bundle from the Valuation Queue to start grading its submissions.
                </p>
                <button
                  onClick={() => setActiveTab('WORKLIST')}
                  style={{
                    marginTop: '12px', padding: '8px 18px', background: '#48977f',
                    color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  Open Valuation Queue
                </button>
              </div>
            )
          )}

          {activeTab === 'CHIEF_REVIEW' && (
            <SEEIntegrityReviewTab />
          )}

          {activeTab === 'LEDGER' && (
            <SEEValuationLedgerTab />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
