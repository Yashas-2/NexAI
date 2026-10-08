import React, { useCallback, useState } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { Key } from 'lucide-react';

interface BundleCodeEntryProps {
  onRedeemSuccess: (bundle: {
    id: string;
    name: string;
    subject_code: string;
    subject_id: string;
    exam_session_name: string;
    exam_session: string;
    evaluator_name: string | null;
    access_code?: string;
  }) => void;
}

export const BundleCodeEntry: React.FC<BundleCodeEntryProps> = ({
  onRedeemSuccess,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = useCallback(async (codeInput: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/evaluation/bundles/redeem/', { code: codeInput });
      const bundle = res.data;
      toast.success('Access code redeemed successfully');
      onRedeemSuccess({
        id: bundle.id,
        name: bundle.name,
        subject_code: bundle.subject_code,
        subject_id: bundle.subject,
        exam_session_name: bundle.exam_session_name,
        exam_session: bundle.exam_session,
        evaluator_name: bundle.evaluator_name,
        access_code: bundle.access_code,
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Invalid access code';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
      setCode('');
    }
  }, []);

  return (
    <div style={{
      background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
      padding: '24px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <h4 style={{ marginTop: 0, marginBottom: '16px', fontWeight: 800, color: '#1e293b' }}>
        <Key size={18} color="#3b82f6" /> Enter Bundle Access Code
      </h4>
      {error && (
        <div style={{
          background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '10px',
          padding: '12px', marginBottom: '12px', color: '#b91c1c', fontSize: '0.875rem',
        }}>
          <span style={{ marginRight: '8px' }}>&times;</span>{error}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.trim().toUpperCase())}
          placeholder="e.g. 27BQWGHK"
          maxLength={16}
          style={{
            flex: '1', padding: '10px 14px', borderRadius: '9px', border: '1.5px solid var(--color-border)',
            fontSize: '1rem', fontWeight: 700, minWidth: '200px',
          }}
        />
        <button
          onClick={() => redeem(code)}
          disabled={loading || !code || code.length < 4}
          style={{
            padding: '10px 20px', borderRadius: '9px', border: 'none',
            background: loading || (!code || code.length < 4) ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            color: 'white', fontWeight: 800, fontSize: '0.85rem',
            cursor: loading || !code || code.length < 4 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          {loading ? 'Redeeming…' : 'Redeem'}
          <Key size={13} />
        </button>
      </div>
      {loading && (
        <p style={{ margin: '12px 0 0 0', color: '#64748B', fontSize: '0.875rem' }}>
          Verifying code with backend…
        </p>
      )}
    </div>
  );
};