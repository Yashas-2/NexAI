import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Layers,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Package,
  Inbox,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { fetchOverview, errText } from '../../api';
import type { OverviewData } from '../../types';

interface MainEvaluatorOverviewTabProps {
  onNavigateToBundles: () => void;
  onNavigateToVerification: () => void;
  onNavigateToLedger: () => void;
}

export const MainEvaluatorOverviewTab: React.FC<MainEvaluatorOverviewTabProps> = ({
  onNavigateToBundles,
  onNavigateToVerification,
  onNavigateToLedger,
}) => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchOverview());
    } catch (err) {
      const msg = errText(err, 'Failed to load Main Evaluator overview');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
        Loading answer-booklet intake…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: 'white', borderRadius: '14px', border: '1.5px solid #FECDD3',
        padding: '32px', textAlign: 'center',
      }}>
        <AlertTriangle size={28} color="#E11D48" />
        <div style={{ fontWeight: 800, marginTop: '8px', color: '#E11D48' }}>
          {error || 'No data available'}
        </div>
        <button
          onClick={load}
          style={{
            marginTop: '14px', padding: '9px 18px', borderRadius: '9px', border: 'none',
            background: '#48977F', color: 'white', fontWeight: 800, cursor: 'pointer',
            display: 'inline-flex', gap: '6px', alignItems: 'center',
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const s = data.stats;

  const cards = [
    { label: 'Answer Booklets Received', value: s.booklets_received, desc: 'Locked SEE submissions', icon: <Inbox size={20} />, color: '#3b82f6' },
    { label: 'Unbundled Booklets', value: s.booklets_unbundled, desc: 'Not yet filed into bundles', icon: <Package size={20} />, color: '#eab308' },
    { label: 'Bundles Created', value: s.bundles_created, desc: `${s.bundles_assigned} with evaluator assigned`, icon: <Layers size={20} />, color: '#8b5cf6' },
    { label: 'Evaluators Assigned', value: s.bundles_assigned, desc: `${s.evaluators_active} active evaluators`, icon: <UserCheck size={20} />, color: '#48977f' },
    { label: 'Awaiting Evaluation', value: s.awaiting_evaluation, desc: 'Created / assigned / in progress', icon: <AlertTriangle size={20} />, color: '#f59e0b' },
    { label: 'Awaiting Verification', value: s.awaiting_verification, desc: 'Marks Totaling & Verification', icon: <CheckCircle2 size={20} />, color: '#0ea5e9' },
    { label: 'Awaiting Certification', value: s.awaiting_certification, desc: 'Verified, awaiting CoE', icon: <ShieldCheck size={20} />, color: '#6366f1' },
    { label: 'Certified Bundles', value: s.certified, desc: 'Ready for CoE grade ledger', icon: <ShieldCheck size={20} />, color: '#16a34a' },
    { label: 'Dispatched / Finalized', value: s.dispatched, desc: 'Published to grade ledger', icon: <CheckCircle2 size={20} />, color: '#10b981' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Intake Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        {cards.map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'white', borderRadius: '14px',
              border: `1px solid ${stat.color}22`, borderTop: `4px solid ${stat.color}`,
              padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              display: 'flex', alignItems: 'center', gap: '16px',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '10px', background: `${stat.color}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: stat.color, flexShrink: 0,
            }}>
              {stat.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                {stat.label}
              </p>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                {stat.value}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: stat.color, fontWeight: 600 }}>
                {stat.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Action Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: '16px', padding: '24px 30px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck size={18} color="#4ade80" />
            <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              Main Evaluator Operations
            </span>
          </div>
          <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
            Answer Booklets Received & Bundle Custodian Gateway
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
            <strong>{s.booklets_unbundled} booklet(s)</strong> awaiting bundling and{' '}
            <strong>{s.awaiting_verification} bundle(s)</strong> awaiting Marks Totaling &amp; Verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {s.booklets_unbundled > 0 && (
            <button
              onClick={onNavigateToBundles}
              style={{
                padding: '10px 18px', background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700,
                fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                gap: '6px', boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
              }}
            >
              <Package size={15} /> Create Bundles ({s.booklets_unbundled})
            </button>
          )}

          <button
            onClick={onNavigateToVerification}
            style={{
              padding: '10px 18px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800,
              fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '6px', boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
            }}
          >
            <AlertTriangle size={15} /> Marks Totaling &amp; Verification <ArrowRight size={15} />
          </button>

          <button
            onClick={onNavigateToLedger}
            style={{
              padding: '10px 18px', background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
              color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800,
              fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              gap: '6px', boxShadow: '0 4px 14px rgba(72,151,127,0.3)',
            }}
          >
            <ShieldCheck size={15} /> CoE Grade Ledger
          </button>
        </div>
      </div>

      {/* ── Answer Booklet Intake Table ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.95rem' }}>Answer Booklet Intake — Completed SEE Records</strong>
          <button
            onClick={load}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px',
              borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'white',
              color: '#48977F', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {data.subjects.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', color: '#64748B' }}>
            <Inbox size={26} style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 800 }}>No SEE answer booklets received yet</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
              Booklets appear here once students submit the SEE and their attempts are locked.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead style={{ background: '#f8fafc', color: 'var(--color-text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '13px 20px' }}>Course</th>
                  <th style={{ padding: '13px 16px' }}>SEE Session</th>
                  <th style={{ padding: '13px 16px' }}>Booklets Received</th>
                  <th style={{ padding: '13px 16px' }}>Unbundled</th>
                  <th style={{ padding: '13px 16px' }}>Grading Progress</th>
                  <th style={{ padding: '13px 16px' }}>Bundles</th>
                  <th style={{ padding: '13px 20px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map(row => (
                  <tr key={`${row.subject_id}-${row.exam_session_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--color-text-primary)' }}>{row.subject_code}</div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--color-text-secondary)' }}>{row.subject_name}</div>
                    </td>
                    <td style={{ padding: '13px 16px', color: '#475569', fontWeight: 600 }}>{row.exam_session_name}</td>
                    <td style={{ padding: '13px 16px', fontWeight: 800 }}>{row.received}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '999px', fontWeight: 800, fontSize: '0.74rem',
                        background: row.unbundled > 0 ? '#FFF7ED' : '#ECFDF5',
                        color: row.unbundled > 0 ? '#C2410C' : '#047857',
                        border: `1px solid ${row.unbundled > 0 ? '#FED7AA' : '#A7F3D0'}`,
                      }}>
                        {row.unbundled}
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px', fontWeight: 700 }}>
                      <span style={{ color: row.total_answers > 0 && row.graded_answers === row.total_answers ? '#047857' : '#C2410C' }}>
                        {row.graded_answers}/{row.total_answers} answers
                      </span>
                    </td>
                    <td style={{ padding: '13px 16px', fontWeight: 800 }}>{row.bundles}</td>
                    <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                      {row.unbundled > 0 && (
                        <button
                          onClick={onNavigateToBundles}
                          style={{
                            padding: '6px 14px', background: '#EFF6FF', border: '1.5px solid #BFDBFE',
                            color: '#1D4ED8', borderRadius: '7px', fontWeight: 800, fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Create Bundle
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Workflow Pipeline ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        padding: '24px 28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 800 }}>
          Post-SEE Valuation Workflow Pipeline (live counts)
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px' }}>
          {[
            { step: '1. Answer Booklet Intake', desc: 'Completed SEE attempts received and locked', count: `${s.booklets_received} Booklets`, color: '#3b82f6' },
            { step: '2. Create Bundles & Assign', desc: 'File booklets into numbered bundles, allocate evaluators', count: `${s.bundles_created} Bundles`, color: '#8b5cf6' },
            { step: '3. Evaluation', desc: 'Evaluators grade answer-by-answer; marks submitted', count: `${s.awaiting_evaluation} Active`, color: '#f59e0b' },
            { step: '4. Marks Totaling & Verification', desc: 'Question-wise totals, missing marks, evaluator status checked', count: `${s.awaiting_verification + s.awaiting_certification} In Pipeline`, color: '#0ea5e9' },
            { step: '5. Certification → CoE Ledger → Dispatch', desc: 'Certified results enter the CoE grade ledger and are finalized', count: `${s.dispatched} Dispatched`, color: '#10b981' },
          ].map((st, i) => (
            <div key={i} style={{ background: '#f8fafc', border: `1px solid ${st.color}33`, borderTop: `3px solid ${st.color}`, borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: st.color, marginBottom: '6px' }}>{st.step}</div>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.74rem', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{st.desc}</p>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: st.color }}>{st.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
