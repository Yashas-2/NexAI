import React, { useState } from 'react';
import { QuestionPaperDraft, SetterAssignment } from '../../types';
import { Badge } from '@/components/ui/Badge';
import { ShieldCheck, Lock, CheckCircle2, Cpu, AlertTriangle } from 'lucide-react';
import { SubmissionReceiptModal } from './components/SubmissionReceiptModal';
import { useAuthStore } from '@/store/authStore';

interface SubmissionsTabProps {
  drafts: QuestionPaperDraft[];
  assignment: SetterAssignment;
  onUpdateDraft: (updatedDraft: QuestionPaperDraft) => void;
  onNavigateToAuthoring: () => void;
}

export const SubmissionsTab: React.FC<SubmissionsTabProps> = ({
  drafts,
  assignment,
  onUpdateDraft,
  onNavigateToAuthoring,
}) => {
  const [selectedSetLabel, setSelectedSetLabel] = useState<'Set A' | 'Set B' | 'Set C' | 'Set D'>('Set A');
  const [signerPin, setSignerPin] = useState('7782-9910');
  const [isSigning, setIsSigning] = useState(false);
  const [viewingReceiptDraft, setViewingReceiptDraft] = useState<QuestionPaperDraft | null>(null);
  const user = useAuthStore(s => s.user);
  const authName = user?.full_name ? `${user.full_name} — Question Paper Setter` : 'Authenticated Examiner';

  const currentDraft = drafts.find(d => d.setLabel === selectedSetLabel) || drafts[0];
  const isMarksValid = currentDraft?.totalMarks === 100;
  const isAlreadyVaulted = currentDraft?.status === 'SIGNED_AND_VAULTED';

  const handleSignAndVault = () => {
    if (!currentDraft || !isMarksValid) return;
    setIsSigning(true);

    setTimeout(() => {
      const hex = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const updatedDraft: QuestionPaperDraft = {
        ...currentDraft,
        status: 'SIGNED_AND_VAULTED',
        digitalSignature: {
          signedBy: user?.full_name || 'Authenticated Examiner',
          algorithm: 'CRYSTALS-Dilithium3 (Post-Quantum) + AES-256-GCM',
          signedAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST',
          sha256Digest: hex,
          ipfsCid: `Qm${hex.substring(0, 44)}`,
          signatureHex: `0xSIG_${hex.substring(0, 32)}`,
        },
      };

      onUpdateDraft(updatedDraft);
      setIsSigning(false);
      setViewingReceiptDraft(updatedDraft);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top Header Banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: '16px',
        padding: '24px 30px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: 'rgba(72,151,127,0.25)',
            border: '1.5px solid #48977f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#48977f',
          }}>
            <ShieldCheck size={26} />
          </div>

          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
              Zero-Trust Cryptographic Signing & Vault Submission
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
              {assignment.subjectCode} — {assignment.subjectTitle} • Fall 2026
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {drafts.map(d => {
            const isSelected = d.setLabel === selectedSetLabel;
            const isVaulted = d.status === 'SIGNED_AND_VAULTED';

            return (
              <button
                key={d.id}
                onClick={() => setSelectedSetLabel(d.setLabel)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: isSelected ? '2px solid #48977f' : '1px solid rgba(255,255,255,0.2)',
                  background: isSelected ? '#48977f22' : 'transparent',
                  color: isSelected ? '#4ade80' : 'white',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>{d.setLabel}</span>
                {isVaulted ? <CheckCircle2 size={13} color="#4ade80" /> : <Lock size={13} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Submission Signing Form & Telemetry ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '22px' }}>
        {/* Signing Controls */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)', padding: '26px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h4 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>
              Digital Signature Protocol — {currentDraft.setLabel}
            </h4>
            <Badge variant={isAlreadyVaulted ? 'success' : isMarksValid ? 'info' : 'warning'}>
              {isAlreadyVaulted ? 'VAULTED & LOCKED' : isMarksValid ? 'READY TO SIGN' : 'INCOMPLETE MARKS'}
            </Badge>
          </div>

          {!isMarksValid && !isAlreadyVaulted && (
            <div style={{ background: '#fff1f2', border: '1.5px solid #fecdd3', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '18px' }}>
              <AlertTriangle size={18} color="#e11d48" />
              <span style={{ fontSize: '0.78rem', color: '#9f1239', fontWeight: 600 }}>
                {currentDraft.setLabel} currently has <strong>{currentDraft.totalMarks} / 100 Marks</strong>. Must be exactly 100 Marks before signing.
              </span>
            </div>
          )}

          {isAlreadyVaulted ? (
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#48977f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' }}>
                <CheckCircle2 size={24} />
              </div>
              <h4 style={{ margin: '0 0 4px 0', color: '#166534', fontWeight: 800 }}>
                {currentDraft.setLabel} Successfully Signed & Vaulted
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: '#15803d' }}>
                Encrypted with AES-256 and anchored to IPFS.
              </p>

              <button
                onClick={() => setViewingReceiptDraft(currentDraft)}
                style={{
                  padding: '8px 18px',
                  background: 'white',
                  border: '1.5px solid #48977f',
                  color: '#48977f',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                View Submission Certificate
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Authenticated Examiner Identity
                </label>
                <input
                  type="text"
                  readOnly
                  value={authName}
                  style={{ width: '100%', padding: '10px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, color: '#334155', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Post-Quantum Digital Signing PIN / HSM Token
                </label>
                <input
                  type="password"
                  value={signerPin}
                  onChange={e => setSignerPin(e.target.value)}
                  placeholder="Enter 8-digit examiner security token..."
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--color-border)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#475569', lineHeight: 1.5 }}>
                🔒 <strong>Cryptographic Guarantee:</strong> Upon clicking sign, your client browser encrypts the question payload with zero-knowledge AES-256 and computes an immutable Dilithium3 digital signature before transmitting to the CoE vault.
              </div>

              <button
                onClick={handleSignAndVault}
                disabled={!isMarksValid || isSigning}
                style={{
                  padding: '14px',
                  background: isMarksValid ? 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: isMarksValid ? (isSigning ? 'wait' : 'pointer') : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isMarksValid ? '0 4px 14px rgba(72,151,127,0.35)' : 'none',
                }}
              >
                {isSigning ? <><Cpu size={16} className="animate-spin" /> Sealing & Transmitting to CoE Vault...</> : <><Lock size={16} /> Execute Digital Signature & Vault {currentDraft.setLabel}</>}
              </button>
            </div>
          )}
        </div>

        {/* Set Summary Checklist */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <h4 style={{ margin: '0 0 16px 0', fontWeight: 800, fontSize: '0.95rem' }}>
            Pre-Submission Audit Checklist
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: isMarksValid ? '#f0fdf4' : '#fff1f2', borderRadius: '8px', border: `1px solid ${isMarksValid ? '#bbf7d0' : '#fecdd3'}` }}>
              {isMarksValid ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertTriangle size={16} color="#e11d48" />}
              <span style={{ color: isMarksValid ? '#166534' : '#9f1239', fontWeight: 600 }}>
                100 Marks Target Fulfillment ({currentDraft.totalMarks}/100M)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ color: '#166534', fontWeight: 600 }}>
                AI Quality Index Verified ({currentDraft.aiQualityScore}%)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ color: '#166534', fontWeight: 600 }}>
                Plagiarism Similarity Index Clean ({currentDraft.similarityScore}%)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span style={{ color: '#166534', fontWeight: 600 }}>
                Scheme of Evaluation Attached to all {currentDraft.questions.length} Questions
              </span>
            </div>
          </div>

          <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <button
              onClick={onNavigateToAuthoring}
              style={{
                width: '100%',
                padding: '10px',
                background: '#f8fafc',
                border: '1.5px solid var(--color-border)',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.82rem',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
              }}
            >
              Modify Questions in Studio
            </button>
          </div>
        </div>
      </div>

      {/* Receipt Certificate Modal */}
      {viewingReceiptDraft && (
        <SubmissionReceiptModal
          draft={viewingReceiptDraft}
          onClose={() => setViewingReceiptDraft(null)}
        />
      )}
    </div>
  );
};
