import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { AlertTriangle, Award, RefreshCw, Printer } from 'lucide-react';

interface SEERow {
  bundleId: string;
  subjectCode: string;
  sessionId: string;
  sessionName: string;
  usn: string;
  name: string;
  submittedAt: string | null;
  strikes: number;
  graded: number;
  answers: number;
  total: number;
  fullyGraded: boolean;
}

const errText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
};

/** Loads every bundle assigned to the evaluator and flattens all submissions. */
const useSEEValuationRows = () => {
  const [rows, setRows] = useState<SEERow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bRes = await api.get('/evaluation/bundles/');
      const bundles: any[] = Array.isArray(bRes.data) ? bRes.data : bRes.data?.results || [];
      const flat: SEERow[] = [];
      await Promise.all(bundles.map(async b => {
        try {
          const sRes = await api.get('/student/see/submissions/', {
            params: { subject: b.subject, exam_session: b.exam_session },
          });
          const d = sRes.data;
          for (const sub of d.submissions || []) {
            flat.push({
              bundleId: b.id,
              subjectCode: d.subject?.code || b.subject_code || '—',
              sessionId: d.exam_session?.id || b.exam_session,
              sessionName: d.exam_session?.name || '',
              usn: sub.student_usn,
              name: sub.student_name,
              submittedAt: sub.submitted_at,
              strikes: sub.proctor_strikes || 0,
              graded: sub.graded_count || 0,
              answers: sub.answers_count || 0,
              total: sub.graded_total || 0,
              fullyGraded: !!sub.fully_graded,
            });
          }
        } catch {
          // one inaccessible bundle must not break the whole tab
        }
      }));
      flat.sort((a, b) => a.subjectCode.localeCompare(b.subjectCode) || a.usn.localeCompare(b.usn));
      setRows(flat);
    } catch (err) {
      const msg = errText(err, 'Failed to load valuation data');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { rows, loading, error, reload: load };
};

const RefreshButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
      borderRadius: '10px', border: '1.5px solid #E2E8F0', background: 'white',
      color: '#48977F', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
    }}
  >
    <RefreshCw size={14} /> Refresh
  </button>
);

/* ── CHIEF REVIEW: proctor strikes + incomplete valuation ─────────────────── */
export const SEEIntegrityReviewTab: React.FC = () => {
  const { rows, loading, error, reload } = useSEEValuationRows();

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Scanning attempts…</div>;
  if (error) return <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#B91C1C', fontWeight: 800 }}>{error}</div>;

  const flagged = rows.filter(r => r.strikes > 0 || !r.fullyGraded);

  return (
    <div>
      <div style={{
        background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0',
        padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '14px',
        alignItems: 'center', boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
      }}>
        <div style={{ width: 42, height: 42, borderRadius: '12px', background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AlertTriangle size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>Attempts Needing Review</div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
            {flagged.length} of {rows.length} attempts flagged for proctor strikes or incomplete valuation.
          </div>
        </div>
        <RefreshButton onClick={reload} />
      </div>

      {flagged.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px dashed #A7F3D0', padding: '36px', textAlign: 'center', color: '#047857', fontWeight: 800 }}>
          All attempts are clean — no proctor strikes, everything fully graded.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {flagged.map(r => (
            <div key={`${r.bundleId}-${r.usn}`} style={{
              background: 'white', borderRadius: '12px', border: '1.5px solid #E2E8F0',
              padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <div style={{ fontWeight: 900, color: '#0F172A', minWidth: '170px' }}>
                {r.name}
                <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700 }}>{r.usn} • {r.subjectCode}</div>
              </div>
              <div style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {r.strikes > 0 && (
                  <span style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: '4px 12px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 800 }}>
                    {r.strikes} proctor strike{r.strikes > 1 ? 's' : ''}
                  </span>
                )}
                {!r.fullyGraded && (
                  <span style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '4px 12px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 800 }}>
                    valuation incomplete — {r.graded}/{r.answers} graded
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 700 }}>
                {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── LEDGER: everything this evaluator has graded ─────────────────────────── */
export const SEEValuationLedgerTab: React.FC = () => {
  const { rows, loading, error, reload } = useSEEValuationRows();
  const gradedRows = rows.filter(r => r.graded > 0);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading ledger…</div>;
  if (error) return <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px', padding: '24px', textAlign: 'center', color: '#B91C1C', fontWeight: 800 }}>{error}</div>;

  const grandTotal = gradedRows.reduce((s, r) => s + r.total, 0);
  const complete = gradedRows.filter(r => r.fullyGraded).length;

  return (
    <div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {[
          { label: 'Attempts valued', value: gradedRows.length, color: '#48977F' },
          { label: 'Fully graded', value: complete, color: '#059669' },
          { label: 'Total marks awarded', value: grandTotal, color: '#4F46E5' },
        ].map(c => (
          <div key={c.label} style={{
            flex: 1, minWidth: '180px', background: 'white', borderRadius: '14px',
            border: '1.5px solid #E2E8F0', padding: '16px 18px',
            display: 'flex', gap: '12px', alignItems: 'center',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '12px', background: `${c.color}18`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A' }}>{c.value}</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>{c.label}</div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshButton onClick={reload} />
          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
              borderRadius: '10px', border: '1.5px solid #E2E8F0', background: 'white',
              color: '#4F46E5', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
            }}
          >
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {gradedRows.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px dashed #CBD5E1', padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
          Nothing valued yet — graded attempts appear here as you work through the queue.
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                {['Subject', 'Student', 'Submitted', 'Progress', 'Marks awarded', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gradedRows.map(r => (
                <tr key={`${r.bundleId}-${r.usn}`} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A' }}>{r.subjectCode}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, color: '#1E293B' }}>{r.name}</div>
                    <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 700 }}>{r.usn}</div>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontWeight: 600, fontSize: '0.78rem' }}>
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{r.graded}/{r.answers}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: '#4F46E5' }}>{r.total}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: r.fullyGraded ? '#ECFDF5' : '#FFF7ED',
                      color: r.fullyGraded ? '#047857' : '#C2410C',
                      border: `1px solid ${r.fullyGraded ? '#A7F3D0' : '#FED7AA'}`,
                      padding: '3px 10px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                    }}>
                      {r.fullyGraded ? 'Complete' : 'In progress'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
