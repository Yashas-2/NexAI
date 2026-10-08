import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Package,
  Plus,
  RefreshCw,
  UserCheck,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import {
  assignEvaluator,
  bundleAction,
  createBundles,
  errText,
  fetchBundles,
  fetchOverview,
} from '../../api';
import type { ApiBundle, BundleStatus, OverviewData } from '../../types';
import { StatusBadge } from '../../statusMeta';

const FILTERS: { key: 'ALL' | BundleStatus; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'CREATED', label: 'Created' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Evaluation' },
  { key: 'COMPLETED', label: 'Awaiting Verification' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'CERTIFIED', label: 'Certified' },
  { key: 'DISPATCHED', label: 'Dispatched' },
];

export const BundleManagementTab: React.FC = () => {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [bundles, setBundles] = useState<ApiBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | BundleStatus>('ALL');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create-bundle form
  const [subjectKey, setSubjectKey] = useState('');
  const [bundleSize, setBundleSize] = useState(25);
  const [creating, setCreating] = useState(false);

  // Assign-evaluator selects (bundleId → evaluatorId)
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, bs] = await Promise.all([fetchOverview(), fetchBundles()]);
      setOverview(ov);
      setBundles(bs);
    } catch (err) {
      const msg = errText(err, 'Failed to load bundles');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bundledSubjects = overview?.subjects ?? [];
  const currentSubject = useMemo(
    () => bundledSubjects.find(r => `${r.subject_id}|${r.exam_session_id}` === subjectKey),
    [bundledSubjects, subjectKey],
  );

  const createBundle = async () => {
    if (!currentSubject) {
      toast.error('Select a course first');
      return;
    }
    if (currentSubject.unbundled < 1) {
      toast.error('No unbundled answer booklets for this course');
      return;
    }
    setCreating(true);
    try {
      const res = await createBundles({
        subject_id: currentSubject.subject_id,
        exam_session_id: currentSubject.exam_session_id,
        bundle_size: bundleSize,
      });
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(errText(err, 'Bundle creation failed'));
    } finally {
      setCreating(false);
    }
  };

  const doAssign = async (bundle: ApiBundle) => {
    const evaluatorId = assignMap[bundle.id];
    if (!evaluatorId) {
      toast.error('Pick an evaluator first');
      return;
    }
    setBusyId(bundle.id);
    try {
      const res = await assignEvaluator(bundle.id, evaluatorId);
      toast.success(res.message || 'Evaluator assigned');
      await load();
    } catch (err) {
      toast.error(errText(err, 'Assignment failed'));
    } finally {
      setBusyId(null);
    }
  };

  const doAction = async (bundle: ApiBundle, action: string, successMsg: string) => {
    setBusyId(bundle.id);
    try {
      await bundleAction(bundle.id, action);
      toast.success(successMsg);
      await load();
    } catch (err) {
      toast.error(errText(err, 'Action failed'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading bundles…</div>;
  }

  if (error || !overview) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', border: '1.5px solid #FECDD3', padding: '32px', textAlign: 'center' }}>
        <AlertTriangle size={28} color="#E11D48" />
        <div style={{ fontWeight: 800, marginTop: '8px', color: '#E11D48' }}>{error || 'No data available'}</div>
        <button onClick={load} style={{ marginTop: '14px', padding: '9px 18px', borderRadius: '9px', border: 'none', background: '#48977F', color: 'white', fontWeight: 800, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  const filtered = filter === 'ALL' ? bundles : bundles.filter(b => b.status === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Create Bundle Panel ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Package size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>Create Bundle from Received Answer Booklets</div>
            <div style={{ fontSize: '0.76rem', color: '#64748B', fontWeight: 600 }}>
              Files unbundled SEE answer booklets into numbered bundles (Bundle #001, #002, …).
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.74rem', fontWeight: 800, color: '#64748B' }}>
            Course / SEE Session
            <select
              value={subjectKey}
              onChange={e => setSubjectKey(e.target.value)}
              style={{ padding: '9px 14px', borderRadius: '9px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 700, minWidth: '320px' }}
            >
              <option value="">— Select course —</option>
              {bundledSubjects.map(r => (
                <option key={`${r.subject_id}|${r.exam_session_id}`} value={`${r.subject_id}|${r.exam_session_id}`}>
                  {r.subject_code} — {r.exam_session_name} ({r.unbundled} unbundled / {r.received} received)
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '0.74rem', fontWeight: 800, color: '#64748B' }}>
            Bundle Size
            <input
              type="number"
              min={1}
              max={500}
              value={bundleSize}
              onChange={e => setBundleSize(Math.max(1, parseInt(e.target.value || '1', 10)))}
              style={{ padding: '9px 14px', borderRadius: '9px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 700, width: '110px' }}
            />
          </label>

          <button
            onClick={createBundle}
            disabled={creating || !subjectKey || (currentSubject?.unbundled ?? 0) < 1}
            style={{
              padding: '10px 20px', borderRadius: '9px', border: 'none',
              background: creating || !subjectKey || (currentSubject?.unbundled ?? 0) < 1
                ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: 'white', fontWeight: 800, fontSize: '0.82rem',
              cursor: creating || !subjectKey ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={15} /> {creating ? 'Creating…' : 'Create Bundles'}
          </button>

          {currentSubject && (
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: currentSubject.unbundled > 0 ? '#C2410C' : '#64748B' }}>
              {currentSubject.unbundled} unbundled booklet(s) available
            </span>
          )}
        </div>
      </div>

      {/* ── Filter Chips ── */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {FILTERS.map(f => {
          const count = f.key === 'ALL' ? bundles.length : bundles.filter(b => b.status === f.key).length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '7px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 800,
                border: `1.5px solid ${active ? '#48977F' : 'var(--color-border)'}`,
                background: active ? '#48977F' : 'white',
                color: active ? 'white' : '#64748B', cursor: 'pointer',
              }}
            >
              {f.label} ({count})
            </button>
          );
        })}
        <button
          onClick={load}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '9px', border: '1.5px solid var(--color-border)',
            background: 'white', color: '#48977F', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Bundles Table ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)' }}>
          <strong style={{ fontSize: '0.95rem' }}>Bundles — Creation, Allocation & Status Tracking</strong>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '36px 24px', textAlign: 'center', color: '#64748B' }}>
            <Package size={26} style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 800 }}>
              {bundles.length === 0 ? 'No bundles created yet' : `No bundles with status "${filter}"`}
            </div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
              {bundles.length === 0
                ? 'Create a bundle above to start the valuation pipeline.'
                : 'Change the filter to see other bundles.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead style={{ background: '#f8fafc', color: 'var(--color-text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '13px 20px' }}>Bundle</th>
                  <th style={{ padding: '13px 16px' }}>Course / Session</th>
                  <th style={{ padding: '13px 16px' }}>Status</th>
                  <th style={{ padding: '13px 16px' }}>Assigned Evaluator</th>
                  <th style={{ padding: '13px 16px' }}>Access Code</th>
                  <th style={{ padding: '13px 20px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(bundle => {
                  const busy = busyId === bundle.id;
                  return (
                    <tr key={bundle.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '13px 20px', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                        {bundle.name}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ fontWeight: 800 }}>{bundle.subject_code}{bundle.subject_name ? ` — ${bundle.subject_name}` : ''}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>{bundle.exam_session_name || ''}</div>
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <StatusBadge status={bundle.status} />
                      </td>
                      <td style={{ padding: '13px 16px', fontWeight: 700 }}>
                        {bundle.evaluator_name || <span style={{ color: '#94A3B8', fontWeight: 600 }}>— unassigned —</span>}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: '0.76rem', fontWeight: 700, color: '#0F172A' }}>
                        {bundle.access_code || <span style={{ color: '#94A3B8' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center' }}>
                          {(bundle.status === 'CREATED' || !bundle.evaluator_name) && (
                            <>
                              <select
                                value={assignMap[bundle.id] || ''}
                                onChange={e => setAssignMap(prev => ({ ...prev, [bundle.id]: e.target.value }))}
                                style={{ padding: '6px 10px', borderRadius: '7px', border: '1.5px solid var(--color-border)', fontSize: '0.76rem', fontWeight: 700, maxWidth: '180px' }}
                              >
                                <option value="">Select evaluator…</option>
                                {overview.evaluators.map(ev => (
                                  <option key={ev.id} value={ev.id}>
                                    {ev.full_name} ({ev.active_bundles} active)
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => doAssign(bundle)}
                                disabled={busy}
                                style={{
                                  padding: '6px 14px', borderRadius: '7px', border: 'none',
                                  background: busy ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                                  color: 'white', fontWeight: 800, fontSize: '0.75rem',
                                  cursor: busy ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                                }}
                              >
                                <UserCheck size={13} /> Assign
                              </button>
                            </>
                          )}

                          {bundle.status === 'ASSIGNED' && (
                            <button
                              onClick={() => doAction(bundle, 'start_evaluation', 'Evaluation started')}
                              disabled={busy}
                              style={{
                                padding: '6px 14px', borderRadius: '7px', border: '1.5px solid #BFDBFE',
                                background: '#EFF6FF', color: '#1D4ED8', fontWeight: 800, fontSize: '0.75rem',
                                cursor: busy ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {busy ? '…' : 'Start Evaluation'}
                            </button>
                          )}

                          {bundle.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => doAction(bundle, 'complete_evaluation', 'Evaluation marked complete')}
                              disabled={busy}
                              style={{
                                padding: '6px 14px', borderRadius: '7px', border: 'none',
                                background: busy ? '#94A3B8' : '#0EA5E9',
                                color: 'white', fontWeight: 800, fontSize: '0.75rem',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={13} /> {busy ? '…' : 'Mark Evaluated'}
                            </button>
                          )}

                          {bundle.status === 'COMPLETED' && (
                            <button
                              onClick={() => doAction(bundle, 'verify', 'Marks verified')}
                              disabled={busy}
                              style={{
                                padding: '6px 14px', borderRadius: '7px', border: 'none',
                                background: busy ? '#94A3B8' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                color: 'white', fontWeight: 800, fontSize: '0.75rem',
                                cursor: busy ? 'not-allowed' : 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                              }}
                            >
                              <ShieldCheck size={13} /> Verify Marks
                            </button>
                          )}

                          {bundle.status === 'VERIFIED' && (
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#6366F1' }}>
                              Awaiting CoE certification
                            </span>
                          )}

                          {bundle.status === 'CERTIFIED' && (
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#15803D' }}>
                              Certified — awaiting dispatch
                            </span>
                          )}

                          {bundle.status === 'DISPATCHED' && (
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534' }}>
                              Finalized ✓
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Status legend ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#64748B', fontWeight: 700, alignItems: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={13} /> Pipeline:</span>
        <span>Created → Assigned → In Evaluation → Awaiting Verification → Verified → Certified → Dispatched</span>
      </div>
    </div>
  );
};
