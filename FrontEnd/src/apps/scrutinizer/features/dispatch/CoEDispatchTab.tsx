import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import {
  ShieldCheck,
  Printer,
  Lock,
  AlertTriangle,
  Award,
  Send,
} from 'lucide-react';
import {
  certifyLedger,
  dispatchLedger,
  errText,
  fetchLedger,
  fetchOverview,
} from '../../api';
import type { LedgerData, OverviewSubject } from '../../types';
import { StatusBadge } from '../../statusMeta';

interface Row {
  subject: OverviewSubject;
  ledger: LedgerData | null;
  error: string | null;
}

export const CoEDispatchTab: React.FC = () => {
  const role = useAuthStore(s => s.user?.role);
  const canCertify = role === 'CHIEF_SUPERINTENDENT' || role === 'SCRUTINIZER';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ov = await fetchOverview();
      const built = await Promise.all(
        ov.subjects.map(async subject => {
          try {
            const ledger = await fetchLedger(subject.subject_id, subject.exam_session_id);
            return { subject, ledger, error: null } as Row;
          } catch (err) {
            return { subject, ledger: null, error: errText(err, 'Failed to load ledger') } as Row;
          }
        }),
      );
      setRows(built);
    } catch (err) {
      const msg = errText(err, 'Failed to load CoE grade ledger');
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const certify = async (row: Row) => {
    const key = `${row.subject.subject_id}|${row.subject.exam_session_id}`;
    setBusyKey(key);
    try {
      const res = await certifyLedger(row.subject.subject_id, row.subject.exam_session_id);
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(errText(err, 'Certification failed'));
    } finally {
      setBusyKey(null);
    }
  };

  const dispatch = async (row: Row) => {
    const key = `${row.subject.subject_id}|${row.subject.exam_session_id}`;
    setBusyKey(key);
    try {
      const res = await dispatchLedger(row.subject.subject_id, row.subject.exam_session_id);
      toast.success(
        `${res.message} — ${res.results_created} new, ${res.results_updated} updated`,
      );
      await load();
    } catch (err) {
      toast.error(errText(err, 'Dispatch failed'));
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading CoE grade ledger…</div>;
  }

  if (loadError) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', border: '1.5px solid #FECDD3', padding: '32px', textAlign: 'center' }}>
        <AlertTriangle size={28} color="#E11D48" />
        <div style={{ fontWeight: 800, marginTop: '8px', color: '#E11D48' }}>{loadError}</div>
        <button onClick={load} style={{ marginTop: '14px', padding: '9px 18px', borderRadius: '9px', border: 'none', background: '#48977F', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const certifiedCount = rows.filter(r => r.ledger?.certified).length;
  const dispatchedCount = rows.filter(r => r.ledger?.dispatched).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Summary Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '16px', padding: '24px 30px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <ShieldCheck size={18} color="#4ade80" />
            <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
              CoE Grade Ledger — Certification & Dispatch
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>
            {certifiedCount} Certified · {dispatchedCount} Dispatched
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
            Only certified booklets enter the CoE grade ledger. Dispatch finalizes and publishes results to students.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 18px', background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
            color: 'white', border: 'none', borderRadius: '8px', fontWeight: 800,
            fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: '6px', boxShadow: '0 4px 14px rgba(72,151,127,0.3)',
          }}
        >
          <Printer size={15} /> Print Ledger Summary
        </button>
      </div>

      {rows.length === 0 && (
        <div style={{ background: 'white', borderRadius: '14px', border: '1.5px solid var(--color-border)', padding: '36px', textAlign: 'center', color: '#64748B' }}>
          <Award size={26} style={{ margin: '0 auto 8px auto' }} />
          <div style={{ fontWeight: 800 }}>No SEE courses in the ledger yet</div>
          <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            Answer booklets must be received, bundled, evaluated and verified first.
          </div>
        </div>
      )}

      {rows.map(row => {
        const key = `${row.subject.subject_id}|${row.subject.exam_session_id}`;
        const busy = busyKey === key;
        const led = row.ledger;

        if (row.error || !led) {
          return (
            <div key={key} style={{ background: 'white', borderRadius: '14px', border: '1.5px solid #FED7AA', padding: '20px 24px' }}>
              <strong style={{ color: '#92400E' }}>{row.subject.subject_code} — {row.subject.exam_session_name}</strong>
              <div style={{ fontSize: '0.78rem', color: '#B45309', marginTop: '4px' }}>{row.error || 'No ledger data'}</div>
            </div>
          );
        }

        const statusEntries = Object.entries(led.status_counts);
        const allVerified = statusEntries.length > 0
          && statusEntries.every(([st]) => ['VERIFIED', 'CERTIFIED', 'DISPATCHED'].includes(st)) && !led.certified;
        const canDispatch = led.certified && !led.dispatched;

        return (
          <div key={key} style={{
            background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
            overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}>
            {/* Card header */}
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: '12px',
              background: led.dispatched ? '#F0FDF4' : led.certified ? '#ECFDF5' : 'white',
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.98rem' }}>
                  {led.subject.code} — {led.subject.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>
                  {led.exam_session.name} · {led.bundles.length} bundle(s)
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {statusEntries.map(([st, n]) => (
                    <span key={st} style={{
                      fontSize: '0.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px',
                      background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0',
                    }}>
                      {st}: {n}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {led.dispatched && <StatusBadge status="DISPATCHED" />}
                {led.certified && !led.dispatched && <StatusBadge status="CERTIFIED" />}

                {canCertify && allVerified && (
                  <button
                    onClick={() => certify(row)}
                    disabled={busy}
                    style={{
                      padding: '9px 18px', borderRadius: '9px', border: 'none',
                      background: busy ? '#94A3B8' : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                      color: 'white', fontWeight: 800, fontSize: '0.8rem',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <ShieldCheck size={14} /> {busy ? 'Certifying…' : 'Certify'}
                  </button>
                )}

                {canCertify && canDispatch && (
                  <button
                    onClick={() => dispatch(row)}
                    disabled={busy}
                    style={{
                      padding: '9px 18px', borderRadius: '9px', border: 'none',
                      background: busy ? '#94A3B8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: 'white', fontWeight: 800, fontSize: '0.8rem',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <Send size={14} /> {busy ? 'Dispatching…' : 'Dispatch & Publish'}
                  </button>
                )}
              </div>
            </div>

            {/* Lock banner / results */}
            {led.results_locked ? (
              <div style={{
                margin: '16px 24px', padding: '14px 18px', borderRadius: '12px',
                background: '#FFF7ED', border: '1.5px solid #FED7AA',
                display: 'flex', gap: '10px', alignItems: 'flex-start',
              }}>
                <Lock size={18} color="#D97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#92400E', fontSize: '0.86rem' }}>
                    Results locked — awaiting certification
                  </strong>
                  <div style={{ fontSize: '0.76rem', color: '#B45309', marginTop: '2px' }}>
                    {statusEntries.length === 0
                      ? 'No bundles exist for this course yet — bundle the answer booklets first.'
                      : 'All bundles must be evaluated, verified and certified before results enter the CoE grade ledger.'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#f8fafc', color: '#64748B', fontWeight: 700 }}>
                    <tr>
                      <th style={{ padding: '12px 24px' }}>USN</th>
                      <th style={{ padding: '12px 16px' }}>Student</th>
                      <th style={{ padding: '12px 16px' }}>CIE</th>
                      <th style={{ padding: '12px 16px' }}>SEE</th>
                      <th style={{ padding: '12px 16px' }}>Total</th>
                      <th style={{ padding: '12px 24px' }}>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {led.results.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontWeight: 700 }}>
                          Certified — no materialized results yet (all attempts awaiting grading).
                        </td>
                      </tr>
                    ) : led.results.map(r => (
                      <tr key={r.usn} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 24px', fontWeight: 800, fontFamily: 'monospace' }}>{r.usn}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.student_name}</td>
                        <td style={{ padding: '12px 16px' }}>{r.cie_marks ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800 }}>{r.see_marks ?? '—'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 800 }}>{r.total_marks ?? '—'}</td>
                        <td style={{ padding: '12px 24px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 12px', borderRadius: '999px',
                            fontSize: '0.76rem', fontWeight: 900,
                            background: r.grade === 'F' ? '#FEF2F2' : '#ECFDF5',
                            color: r.grade === 'F' ? '#B91C1C' : '#047857',
                            border: `1px solid ${r.grade === 'F' ? '#FECACA' : '#A7F3D0'}`,
                          }}>
                            {r.grade ?? '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bundle pipeline detail */}
            {led.bundles.length > 0 && (
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B' }}>BUNDLES:</span>
                {led.bundles.map(b => (
                  <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>{b.name}</span>
                    <StatusBadge status={b.status} />
                    {b.evaluator_name && <span style={{ fontSize: '0.72rem', color: '#94A3B8', fontWeight: 700 }}>· {b.evaluator_name}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
