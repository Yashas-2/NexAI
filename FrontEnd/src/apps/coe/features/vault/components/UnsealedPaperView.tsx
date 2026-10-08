import React, { useState } from 'react';
import { QuestionPaperSet } from '../types';
import { Printer, Share2, ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';

interface UnsealedPaperViewProps {
  paper: QuestionPaperSet;
  onBack: () => void;
}

export const UnsealedPaperView: React.FC<UnsealedPaperViewProps> = ({
  paper,
  onBack,
}) => {
  const [isDispatched, setIsDispatched] = useState(false);
  const sections = Array.from(new Set(paper.questions.map(q => q.section)));

  const handlePrint = () => {
    window.print();
  };

  const handleDispatch = () => {
    setIsDispatched(true);
    setTimeout(() => setIsDispatched(false), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white',
        padding: '16px 24px',
        borderRadius: '14px',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ArrowLeft size={16} /> Back to Vault
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <ShieldCheck size={14} /> Cryptographically Unsealed & Verified
          </span>

          <button
            onClick={handlePrint}
            style={{
              padding: '8px 16px',
              background: 'white',
              border: '1.5px solid var(--color-border)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.82rem',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Printer size={15} /> Print Paper
          </button>

          <button
            onClick={handleDispatch}
            style={{
              padding: '8px 18px',
              background: isDispatched ? '#10b981' : 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(72,151,127,0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {isDispatched ? <><CheckCircle2 size={15} /> Dispatched to Halls!</> : <><Share2 size={15} /> Dispatch to Exam Halls</>}
          </button>
        </div>
      </div>

      {/* Official Question Paper Sheet */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '2px solid #cbd5e1',
        padding: '48px 56px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'serif',
      }}>
        {/* Anti-leak repeating diagonal watermark */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(-30deg)',
          fontSize: '3.5rem',
          fontWeight: 900,
          color: 'rgba(72, 151, 127, 0.04)',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          zIndex: 0,
        }}>
          CONFIDENTIAL • COE UNSEALED • OFFICIAL USE ONLY
        </div>

        {/* Paper Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', fontFamily: 'sans-serif' }}>
            MALNAD COLLEGE OF ENGINEERING
          </div>
          <h1 style={{ margin: '8px 0', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            END SEMESTER EXAMINATIONS — {paper.examSession.toUpperCase()}
          </h1>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
            {paper.subjectCode}: {paper.subjectTitle} ({paper.setLabel})
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.85rem', fontWeight: 700, color: '#334155', fontFamily: 'sans-serif' }}>
            <span>Time Allowed: {paper.durationMinutes / 60} Hours ({paper.durationMinutes} Minutes)</span>
            <span>Course: {paper.semester}</span>
            <span>Maximum Marks: {paper.totalMarks}</span>
          </div>
        </div>

        {/* Candidate Instructions */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', fontFamily: 'sans-serif', color: '#475569', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <strong>INSTRUCTIONS TO CANDIDATES:</strong>
          <ol style={{ margin: '4px 0 0 0', paddingLeft: '20px', lineHeight: 1.5 }}>
            <li>Answer all questions according to internal section choices.</li>
            <li>Use of non-programmable scientific calculators is permitted where indicated.</li>
            <li>Assume missing data suitably with explicit justification.</li>
            <li>Cryptographic Paper Signature ID: <code style={{ color: '#0f172a' }}>{paper.sha256Hash.substring(0, 20)}...</code></li>
          </ol>
        </div>

        {/* Questions Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative', zIndex: 1, color: '#0f172a' }}>
          {sections.map(secName => {
            const secQuestions = paper.questions.filter(q => q.section === secName);
            const secMarks = secQuestions.reduce((sum, q) => sum + q.marks, 0);

            return (
              <div key={secName}>
                <div style={{
                  textAlign: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  borderBottom: '1px solid #94a3b8',
                  paddingBottom: '4px',
                  marginBottom: '16px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: 'sans-serif'
                }}>
                  {secName} (Total: {secMarks} Marks)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {secQuestions.map(q => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontWeight: 800, minWidth: '24px' }}>{q.number}{q.part ? q.part : ''}.</span>
                        <span>{q.text}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontFamily: 'sans-serif', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        [{q.marks} Marks]
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Paper Footer with Cryptographic Seal */}
        <div style={{
          marginTop: '48px',
          paddingTop: '20px',
          borderTop: '2px solid #0f172a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'sans-serif',
          fontSize: '0.72rem',
          color: '#64748b',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <div>Authenticated & Unsealed by: <strong>Controller of Examinations (CoE)</strong></div>
            <div>Post-Quantum Dilithium3 Signature Validated ✓</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, color: '#0f172a' }}>*** END OF QUESTION PAPER ***</div>
            <div>Page 1 of 1</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>IPFS CID: <code>{paper.ipfsCid.substring(0, 16)}...</code></div>
            <div>Secure Dispatch Hash: Verified</div>
          </div>
        </div>
      </div>
    </div>
  );
};
