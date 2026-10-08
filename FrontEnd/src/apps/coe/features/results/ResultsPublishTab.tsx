import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Award, Send, RefreshCw } from 'lucide-react';

interface PublishRow {
  subjectId: string;
  code: string;
  name: string;
  sessionName: string;
  sessionId: string | null;
  submissions: number;
  graded: number;
  total: number;
  error: string | null;
  published: string | null;
}

const errText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
};

export const ResultsPublishTab: React.FC = () => {
  const [rows, setRows] = useState<PublishRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/scheduling/subjects/');
      const raw = res.data;
      const subjects: any[] = Array.isArray(raw) ? raw : raw?.results || [];

      const rows: PublishRow[] = await Promise.all(subjects.map(async s => {
        const base: PublishRow = {
          subjectId: s.id, code: s.code, name: s.name,
          sessionName: '—', sessionId: null,
          submissions: 0, graded: 0, total: 0,
          error: null, published: null,
        };
        try {
          const sub = await api.get('/student/see/submissions/', { params: { subject: s.id } });
          const d = sub.data;
          const answers = (d.submissions || []).reduce(
            (acc: { g: number; t: number }, x: any) => ({
              g: acc.g + (x.graded_count || 0),
              t: acc.t + (x.answers_count || 0),
            }), { g: 0, t: 0 }
          );
          return {
            ...base,
            sessionName: d.exam_session?.name || '—',
            sessionId: d.exam_session?.id || null,
            submissions: d.count || 0,
            graded: answers.g,
            total: answers.t,
          };
        } catch (err) {
          return { ...base, error: errText(err, 'No SEE session') };
        }
      }));
      setRows(rows);
    } catch (err) {
      toast.error(errText(err, 'Failed to load subjects'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async (row: PublishRow) => {
    if (!row.sessionId) return;
    setPublishingId(row.subjectId);
    try {
      const res = await api.post('/evaluation/results/publish_results/', {
        exam_session_id: row.sessionId,
        subject_id: row.subjectId,
      });
      const created = res.data?.results_created ?? 0;
      const updated = res.data?.results_updated ?? 0;
      const msg = `${created} new, ${updated} updated`;
      setRows(prev => prev.map(r => r.subjectId === row.subjectId ? { ...r, published: msg } : r));
      toast.success(`${row.code} published — ${msg}`);
    } catch (err) {
      toast.error(errText(err, 'Publish failed'));
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading subjects…</div>;
  }

  return (
    <div>
      <div style={{
        background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0',
        padding: '16px 20px', marginBottom: '16px', display: 'flex', gap: '14px',
        alignItems: 'center', boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '12px', background: '#EEF2FF', color: '#4F46E5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Award size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: '#0F172A', fontSize: '0.95rem' }}>
            Publish SEE Results to Students
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
            Finalizes graded attempts into each student's result ledger and sends a
            RESULT_PUBLISHED notification. Ungraded attempts are skipped.
          </div>
        </div>
        <button
          onClick={load}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            borderRadius: '10px', border: '1.5px solid #E2E8F0', background: 'white',
            color: '#48977F', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div style={{
        background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0',
        overflow: 'hidden', boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
              {['Subject', 'SEE Session', 'Submissions', 'Graded', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '12px 16px', fontSize: '0.72rem', fontWeight: 900, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.subjectId} style={{ borderTop: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 800, color: '#0F172A' }}>{r.code}</div>
                  <div style={{ fontSize: '0.74rem', color: '#94A3B8', fontWeight: 600 }}>{r.name}</div>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 700 }}>{r.error ? '—' : r.sessionName}</td>
                <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0F172A' }}>{r.error ? '—' : r.submissions}</td>
                <td style={{ padding: '12px 16px', fontWeight: 700 }}>
                  {r.error ? '—' : (
                    <span style={{ color: r.total > 0 && r.graded === r.total ? '#047857' : '#C2410C' }}>
                      {r.graded}/{r.total}
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {r.error ? (
                    <span style={{ fontSize: '0.76rem', color: '#94A3B8', fontWeight: 700 }}>{r.error}</span>
                  ) : r.published ? (
                    <span style={{
                      background: '#ECFDF5', color: '#047857', padding: '3px 10px',
                      borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                      border: '1px solid #A7F3D0',
                    }}>
                      Published ✓ {r.published}
                    </span>
                  ) : (
                    <span style={{
                      background: '#FFF7ED', color: '#C2410C', padding: '3px 10px',
                      borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                      border: '1px solid #FED7AA',
                    }}>
                      Not published
                    </span>
                  )}
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                  <button
                    onClick={() => publish(r)}
                    disabled={publishingId === r.subjectId || !r.sessionId}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: publishingId === r.subjectId || !r.sessionId ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                      color: 'white', border: 'none', padding: '8px 16px', borderRadius: '9px',
                      fontWeight: 800, fontSize: '0.78rem',
                      cursor: publishingId === r.subjectId || !r.sessionId ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Send size={13} />
                    {publishingId === r.subjectId ? 'Publishing…' : 'Publish'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
