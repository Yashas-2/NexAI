import type { BundleStatus } from './types';

export interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
  border: string;
}

export const statusMeta: Record<BundleStatus, StatusMeta> = {
  CREATED: { label: 'Created (Unassigned)', bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' },
  ASSIGNED: { label: 'Assigned to Evaluator', bg: '#EEF2FF', fg: '#4338CA', border: '#C7D2FE' },
  IN_PROGRESS: { label: 'In Evaluation', bg: '#FFF7ED', fg: '#C2410C', border: '#FED7AA' },
  COMPLETED: { label: 'Awaiting Verification', bg: '#E0F2FE', fg: '#0369A1', border: '#BAE6FD' },
  VERIFIED: { label: 'Marks Verified', bg: '#ECFDF5', fg: '#047857', border: '#A7F3D0' },
  CERTIFIED: { label: 'Certified', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0' },
  DISPATCHED: { label: 'Dispatched ✓', bg: '#DCFCE7', fg: '#166534', border: '#86EFAC' },
};

export const StatusBadge: React.FC<{ status: BundleStatus }> = ({ status }) => {
  const m = statusMeta[status] || { label: status, bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.3px',
      background: m.bg, color: m.fg, border: `1px solid ${m.border}`,
    }}>
      {m.label}
    </span>
  );
};
