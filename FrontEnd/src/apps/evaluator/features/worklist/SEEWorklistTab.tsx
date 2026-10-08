import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Layers, Inbox, RefreshCw } from 'lucide-react';
import { SEESubmissionsPanel } from '@/apps/faculty/features/seeValuation/SEESubmissionsPanel';

export interface SEEBundle {
  id: string;
  name: string;
  evaluator: string | null;
  evaluator_name: string | null;
  subject: string;
  subject_code: string;
  exam_session: string;
  created_at: string;
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED';
}

interface SEEWorklistTabProps {
  activeBundle: SEEBundle | null;
  onActiveBundleChange: React.Dispatch<React.SetStateAction<SEEBundle | null>>;
}

const errText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
};

export const SEEWorklistTab: React.FC<SEEWorklistTabProps> = ({
  activeBundle,
  onActiveBundleChange,
}) => {
  const [bundles, setBundles] = useState<SEEBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/evaluation/bundles/');
      const raw = res.data;
      const items: SEEBundle[] = Array.isArray(raw) ? raw : raw?.results || [];
      setBundles(items);
      onActiveBundleChange(prev => {
        const kept = items.find(b => b.id === (prev as SEEBundle | null)?.id);
        return kept || (items.length === 1 ? items[0] : null);
      });
    } catch (err) {
      setError(errText(err, 'Failed to load valuation bundles'));
      toast.error(errText(err, 'Failed to load valuation bundles'));
    } finally {
      setLoading(false);
    }
  }, [onActiveBundleChange]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
        Loading your valuation queue…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px',
        padding: '24px', textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 12px 0', color: '#B91C1C', fontWeight: 800 }}>{error}</p>
        <button
          onClick={load}
          style={{
            padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#B91C1C', color: 'white', fontWeight: 800,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (bundles.length === 0) {
    return (
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px dashed #CBD5E1',
        padding: '44px', textAlign: 'center', color: '#64748B',
      }}>
        <Inbox size={36} style={{ margin: '0 auto 12px auto', display: 'block' }} color="#94A3B8" />
        <p style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem' }}>
          No valuation bundles assigned to you yet.
        </p>
        <p style={{ margin: '6px 0 0 0', fontSize: '0.82rem', fontWeight: 600 }}>
          A coordinator distributes SEE submissions to you from the faculty dashboard.
        </p>
        <button
          onClick={load}
          style={{
            marginTop: '16px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 18px', borderRadius: '10px', border: '1px solid #CBD5E1',
            background: 'white', color: '#48977F', fontWeight: 800, cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {bundles.map(b => {
          const active = activeBundle?.id === b.id;
          return (
            <button
              key={b.id}
              onClick={() => onActiveBundleChange(b)}
              style={{
                flex: '1 1 240px', textAlign: 'left', cursor: 'pointer',
                background: active ? 'linear-gradient(135deg, #48977F 0%, #2F6852 100%)' : 'white',
                color: active ? 'white' : '#0F172A',
                border: active ? 'none' : '1.5px solid #E2E8F0',
                borderRadius: '14px', padding: '14px 16px',
                boxShadow: '0 4px 14px rgba(15,23,42,0.06)',
                display: 'flex', gap: '12px', alignItems: 'center',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '12px',
                background: active ? 'rgba(255,255,255,0.2)' : '#EEF2FF',
                color: active ? 'white' : '#4F46E5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Layers size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: '0.9rem' }}>
                  {b.subject_code || b.name}
                </div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, opacity: 0.8 }}>
                  {b.name}
                </div>
              </div>
            </button>
          );
        })}
        <button
          onClick={load}
          title="Refresh queue"
          style={{
            alignSelf: 'stretch', padding: '0 16px', borderRadius: '14px', cursor: 'pointer',
            border: '1.5px solid #E2E8F0', background: 'white', color: '#48977F',
            fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {activeBundle ? (
        <SEESubmissionsPanel
          subjectId={activeBundle.subject}
          examSessionId={activeBundle.exam_session}
          canDistribute={false}
        />
      ) : (
        <div style={{
          background: 'white', borderRadius: '16px', border: '1.5px dashed #CBD5E1',
          padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 700,
        }}>
          Select a bundle above to start valuing submissions.
        </div>
      )}
    </div>
  );
};
