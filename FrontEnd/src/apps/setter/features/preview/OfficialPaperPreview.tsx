import React from 'react';
import { QuestionPaperDraft } from '../../types';
import { Printer, ArrowLeft, ShieldCheck, ArrowRight } from 'lucide-react';

interface OfficialPaperPreviewProps {
  draft: QuestionPaperDraft;
  onBack: () => void;
  onProceedToSign: () => void;
}

export const OfficialPaperPreview: React.FC<OfficialPaperPreviewProps> = ({
  draft,
  onBack,
  onProceedToSign,
}) => {
  const sections = Array.from(new Set(draft.questions.map(q => q.section)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'white',
        padding: '16px 24px',
        borderRadius: '14px',
        border: '1.5px solid var(--color-border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
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
            gap: '6px',
          }}
        >
          <ArrowLeft size={16} /> Back to Studio
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => window.print()}
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
              gap: '6px',
            }}
          >
            <Printer size={15} /> Print Proof Copy
          </button>

          <button
            onClick={onProceedToSign}
            style={{
              padding: '8px 18px',
              background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
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
            }}
          >
            <ShieldCheck size={15} /> Proceed to Digital Signing <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* ── Official Examination Sheet ── */}
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
          CONFIDENTIAL • SETTER WORKSPACE DRAFT • {draft.setLabel.toUpperCase()}
        </div>

        {/* Paper Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', fontFamily: 'sans-serif' }}>
            MALNAD COLLEGE OF ENGINEERING
          </div>
          <h1 style={{ margin: '8px 0', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
            END SEMESTER EXAMINATIONS — {draft.examSession.toUpperCase()}
          </h1>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>
            {draft.subjectCode}: {draft.subjectTitle} ({draft.setLabel})
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '0.85rem', fontWeight: 700, color: '#334155', fontFamily: 'sans-serif' }}>
            <span>Time Allowed: {draft.durationMinutes / 60} Hours ({draft.durationMinutes} Mins)</span>
            <span>Course: {draft.semester}</span>
            <span>Maximum Marks: {draft.maxMarks}</span>
          </div>
        </div>

        {/* Candidate Instructions */}
        <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.78rem', fontFamily: 'sans-serif', color: '#475569', marginBottom: '28px', position: 'relative', zIndex: 1 }}>
          <strong>INSTRUCTIONS TO CANDIDATES:</strong>
          <ol style={{ margin: '4px 0 0 0', paddingLeft: '20px', lineHeight: 1.5 }}>
            <li>Answer all questions according to internal section choices.</li>
            <li>Use of non-programmable scientific calculators is permitted where indicated.</li>
            <li>Assume missing data suitably with explicit justification.</li>
          </ol>
        </div>

        {/* Questions Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', position: 'relative', zIndex: 1, color: '#0f172a' }}>
          {sections.map(secName => {
            const secQuestions = draft.questions.filter(q => q.section === secName);
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
                  fontFamily: 'sans-serif',
                }}>
                  {secName} (Total: {secMarks} Marks)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {secQuestions.map(q => (
                    <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontSize: '0.95rem', lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <span style={{ fontWeight: 800, minWidth: '24px' }}>{q.number}{q.part || ''}.</span>
                        <div>
                          <span>{q.text}</span>
                          {q.hasOrChoice && q.orQuestionText && (
                            <div style={{ marginTop: '8px', paddingLeft: '14px', borderLeft: '2px dashed #94a3b8' }}>
                              <strong style={{ fontSize: '0.85rem' }}>[OR]</strong>
                              <p style={{ margin: '2px 0 0 0' }}>{q.orQuestionText}</p>
                            </div>
                          )}
                        </div>
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

        {/* Paper Footer */}
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
          zIndex: 1,
        }}>
          <div>Authored via: <strong>NexAI Paper Setter Studio</strong></div>
          <div style={{ textAlign: 'center', fontWeight: 800, color: '#0f172a' }}>*** END OF QUESTION PAPER ***</div>
          <div style={{ textAlign: 'right' }}>Page 1 of 1 • {draft.setLabel}</div>
        </div>
      </div>
    </div>
  );
};
