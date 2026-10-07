import React from 'react';
import { ScrutinyBundle } from '../../../types';
import { X, ShieldCheck, Printer } from 'lucide-react';

interface ScrutinyCertificateModalProps {
  bundle: ScrutinyBundle;
  onClose: () => void;
}

export const ScrutinyCertificateModal: React.FC<ScrutinyCertificateModalProps> = ({
  bundle,
  onClose,
}) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '16px 26px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#4ade80" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Official Valuation & Scrutiny Certificate — {bundle.bundleCode}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '6px 14px',
                background: 'white',
                border: 'none',
                borderRadius: '6px',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer size={14} /> Print Certificate
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Certificate Sheet */}
        <div style={{ padding: '36px 40px', background: '#ffffff', fontFamily: 'sans-serif' }}>
          <div style={{
            border: '2px solid #0f172a',
            borderRadius: '12px',
            padding: '28px',
            background: '#ffffff',
            position: 'relative',
          }}>
            {/* University Crest */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569' }}>
                MALNAD COLLEGE OF ENGINEERING
              </div>
              <h2 style={{ margin: '4px 0', fontSize: '1.4rem', fontWeight: 900, color: '#0f172a' }}>
                CENTRAL VALUATION & SCRUTINY COMPLETION CERTIFICATE
              </h2>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                Controller of Examinations Grade Ledger Dispatch
              </div>
            </div>

            {/* Content Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.82rem', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>BUNDLE CODE / IDENTIFIER:</span>
                <strong style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{bundle.bundleCode}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>SUBJECT / SEMESTER:</span>
                <strong>{bundle.subjectCode}: {bundle.subjectTitle} ({bundle.semester})</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>APPOINTED EVALUATOR:</span>
                <strong>{bundle.assignedEvaluatorName || 'Dr. Alan Turing'}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>TOTAL ANSWER BOOKLETS SCRUTINIZED:</span>
                <strong style={{ color: '#16a34a' }}>{bundle.totalScripts} Booklets (100% Audited)</strong>
              </div>
            </div>

            {/* Statement of Certification */}
            <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.7, margin: '0 0 28px 0' }}>
              This is to certify that all <strong>{bundle.totalScripts} answer booklets</strong> in bundle <strong>{bundle.bundleCode}</strong> have undergone rigorous double-check scrutiny in accordance with Autonomous University Examination Regulations. All question-level scores, section tallies, and cover page grand totals have been verified and rectified.
            </p>

            {/* Signature Block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'flex-end', paddingTop: '20px', borderTop: '1.5px solid #0f172a', textAlign: 'center', fontSize: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 800, color: '#16a34a', marginBottom: '4px' }}>[VALUATION COMPLETED]</div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700 }}>
                  Appointed Evaluator
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: '#2563eb', marginBottom: '4px' }}>[SCRUTINY CERTIFIED]</div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700 }}>
                  Central Scrutiny Custodian
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 800, color: '#7c3aed', marginBottom: '4px' }}>[COE LEDGER TRANSMITTED]</div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700 }}>
                  Controller of Examinations
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
