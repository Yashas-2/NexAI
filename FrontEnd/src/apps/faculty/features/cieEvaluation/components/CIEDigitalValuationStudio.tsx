import React, { useState } from 'react';
import { CIEScannedScript, CIECanvasAnnotation } from '../../../types';
import {
  ArrowLeft,
  Check,
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

interface CIEDigitalValuationStudioProps {
  script: CIEScannedScript;
  onUpdateScript: (updated: CIEScannedScript) => void;
  onClose: () => void;
  onSubmitSuccess: (awardedTotal: number, studentId: string, testType: 'CIE-1' | 'CIE-2') => void;
}

type AnnotationTool = 'TICK' | 'CROSS' | 'STEP_1' | 'STEP_2' | 'STEP_5' | 'COMMENT';

export const CIEDigitalValuationStudio: React.FC<CIEDigitalValuationStudioProps> = ({
  script,
  onUpdateScript,
  onClose,
  onSubmitSuccess,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [activeTool, setActiveTool] = useState<AnnotationTool>('TICK');
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const currentQuestion = script.questions[activeQuestionIdx] || script.questions[0];

  // Annotation handlers
  const handleAddAnnotation = (annotation: CIECanvasAnnotation) => {
    const updated: CIEScannedScript = {
      ...script,
      annotations: [...(script.annotations || []), annotation],
    };
    onUpdateScript(updated);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    let newAnn: CIECanvasAnnotation;

    if (activeTool === 'TICK') {
      newAnn = { id: `ann_${Date.now()}`, pageNumber: currentPage, type: 'TICK', x, y };
    } else if (activeTool === 'CROSS') {
      newAnn = { id: `ann_${Date.now()}`, pageNumber: currentPage, type: 'CROSS', x, y };
    } else if (activeTool === 'STEP_1' || activeTool === 'STEP_2' || activeTool === 'STEP_5') {
      const marksValue = activeTool === 'STEP_1' ? 1 : activeTool === 'STEP_2' ? 2 : 5;
      newAnn = { id: `ann_${Date.now()}`, pageNumber: currentPage, type: 'STEP_MARK', x, y, marksValue };
      // Also automatically award marks to the current question
      const currentMarks = currentQuestion.awardedMarks || 0;
      handleAwardMarks(currentMarks + marksValue);
    } else {
      const note = window.prompt('Enter your note for the student:');
      if (!note) return;
      newAnn = { id: `ann_${Date.now()}`, pageNumber: currentPage, type: 'COMMENT', x, y, text: note };
    }

    handleAddAnnotation(newAnn);
  };

  const handleClearPageAnnotations = () => {
    const updated: CIEScannedScript = {
      ...script,
      annotations: (script.annotations || []).filter(a => a.pageNumber !== currentPage),
    };
    onUpdateScript(updated);
    toast.success(`Cleared annotations for Page ${currentPage}`);
  };

  // Update question score
  const handleAwardMarks = (marks: number) => {
    const clamped = Math.min(Math.max(0, marks), currentQuestion.maxMarks);
    const updatedQuestions = script.questions.map((q, idx) => {
      if (idx === activeQuestionIdx) {
        return { ...q, awardedMarks: clamped, isEvaluated: true };
      }
      return q;
    });

    const total = updatedQuestions.reduce((acc, q) => acc + q.awardedMarks, 0);
    const updated: CIEScannedScript = {
      ...script,
      questions: updatedQuestions,
      evaluatorTotalMarks: total,
    };
    onUpdateScript(updated);
  };

  const handleUpdateRemarks = (remarks: string) => {
    const updatedQuestions = script.questions.map((q, idx) => {
      if (idx === activeQuestionIdx) {
        return { ...q, evaluatorRemarks: remarks };
      }
      return q;
    });
    onUpdateScript({ ...script, questions: updatedQuestions });
  };

  // Submit evaluation
  const handleSubmitValuation = async () => {
    try {
      const toastId = toast.loading('Submitting marks...');
      let totalAwarded = 0;
      for (const q of script.questions) {
        if (q.isEvaluated && q.id) {
          const res = await api.post('/cie/test/grade_answer/', {
            answer_id: q.id,
            marks_awarded: q.awardedMarks || 0,
          });
          totalAwarded = res.data.cie_marks_total || totalAwarded; // Using total from backend
        }
      }

      const finalizedScript: CIEScannedScript = {
        ...script,
        status: 'EVALUATED',
        evaluatorTotalMarks: totalAwarded,
        evaluatedAt: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      };

      onUpdateScript(finalizedScript);
      onSubmitSuccess(totalAwarded, script.studentId, script.testType);
      toast.dismiss(toastId);
    } catch (err) {
      toast.error('Failed to submit valuation. Please check connection.');
      console.error(err);
    }
  };

  const totalEvaluatorMarks = script.questions.reduce((acc, q) => acc + (q.awardedMarks || 0), 0);
  const evaluatedCount = script.questions.filter(q => q.isEvaluated).length;
  const pageAnnotations = (script.annotations || []).filter(a => a.pageNumber === currentPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '85vh' }}>
      {/* ── Studio Top Header Bar ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border, #E2E8F0)',
        padding: '14px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#F1F5F9',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <ArrowLeft size={16} /> Back to Scripts List
          </button>

          <div style={{ height: '24px', width: '1px', background: '#CBD5E1' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                {script.studentName}
              </span>
              <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                {script.studentUSN}
              </span>
              <span style={{ fontSize: '0.78rem', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                {script.courseCode} • {script.testType}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
              Digital Evaluation Studio • Total Marks: <strong>{script.maxMarks}M</strong> • Submitted: {script.submittedAt}
            </div>
          </div>
        </div>

        {/* Live Score Tally Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 800 }}>MARKS TALLY</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#4F46E5' }}>
              {totalEvaluatorMarks} <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>/ {script.maxMarks}</span>
            </div>
          </div>

          <button
            onClick={handleSubmitValuation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '10px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
            }}
          >
            <Check size={16} /> Submit & Publish CIE Marks ✓
          </button>
        </div>
      </div>

      {/* ── Main Studio Split Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: '18px', flex: 1 }}>
        {/* ════ LEFT PANE: INTERACTIVE SCRIPT CANVAS VIEWER ════ */}
        <div style={{
          background: '#0F172A',
          borderRadius: '16px',
          border: '1.5px solid #1E293B',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          {/* Annotation Toolbar */}
          <div style={{
            background: '#1E293B',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #334155',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            {/* Tool buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', marginRight: '4px' }}>
                STAMP:
              </span>
              <button
                type="button"
                onClick={() => setActiveTool('TICK')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'TICK' ? '#16A34A' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={14} /> Correct (✓)
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('CROSS')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'CROSS' ? '#DC2626' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <X size={14} /> Incorrect (✗)
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('STEP_1')}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'STEP_1' ? '#2563EB' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                +1M
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('STEP_2')}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'STEP_2' ? '#2563EB' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                +2M
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('STEP_5')}
                style={{
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'STEP_5' ? '#2563EB' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                +5M
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('COMMENT')}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTool === 'COMMENT' ? '#D97706' : '#334155',
                  color: 'white',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Note 💬
              </button>
            </div>

            {/* Zoom and Page controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.max(70, z - 15))}
                style={{ background: '#334155', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
              >
                <ZoomOut size={14} />
              </button>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontFamily: 'monospace' }}>{zoomLevel}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel(z => Math.min(150, z + 15))}
                style={{ background: '#334155', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: 'pointer' }}
              >
                <ZoomIn size={14} />
              </button>

              <div style={{ width: '1px', height: '16px', background: '#475569', margin: '0 4px' }} />

              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage(p => Math.max(1, p - 1));
                  setActiveQuestionIdx(p => Math.max(0, p - 1));
                }}
                style={{ background: '#334155', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.78rem', color: 'white', fontWeight: 800 }}>
                Page {currentPage} / {script.totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= script.totalPages}
                onClick={() => {
                  setCurrentPage(p => Math.min(script.totalPages, p + 1));
                  setActiveQuestionIdx(p => Math.min(script.questions.length - 1, p + 1));
                }}
                style={{ background: '#334155', border: 'none', color: 'white', padding: '6px', borderRadius: '6px', cursor: currentPage >= script.totalPages ? 'not-allowed' : 'pointer' }}
              >
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={handleClearPageAnnotations}
                title="Clear Page Annotations"
                style={{ background: '#334155', border: 'none', color: '#F87171', padding: '6px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
              >
                Reset Page
              </button>
            </div>
          </div>

          {/* Interactive Script Canvas Page */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '24px',
            background: '#0B1329',
          }}>
            <div
              onClick={handleCanvasClick}
              style={{
                width: `${(560 * zoomLevel) / 100}px`,
                minHeight: `${(760 * zoomLevel) / 100}px`,
                background: '#FFFDF9',
                borderRadius: '6px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                position: 'relative',
                cursor: 'crosshair',
                padding: '36px 40px',
                boxSizing: 'border-box',
                fontFamily: 'serif',
                color: '#1E293B',
                lineHeight: 1.8,
                userSelect: 'none',
              }}
            >
              {/* Paper Watermark / Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #E2E8F0', paddingBottom: '10px', marginBottom: '20px', fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>
                <span>NEXAI CIE ASSESSMENT SCRIPT • {script.courseCode}</span>
                <span>USN: {script.studentUSN} • PAGE {currentPage}</span>
              </div>

              {/* Student Answer based on page */}
              {script.questions[currentPage - 1] && (
                <div>
                  <div style={{ fontWeight: 800, color: '#1E293B', marginBottom: '8px', fontFamily: 'sans-serif' }}>
                    Q{script.questions[currentPage - 1].questionNumber}. {script.questions[currentPage - 1].questionText}
                  </div>
                  <div style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#1E293B', fontStyle: 'italic', whiteSpace: 'pre-wrap', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '8px', background: '#F8FAFC' }}>
                    {script.questions[currentPage - 1].answerImageBase64 ? (
                      <div>
                        <div style={{ marginBottom: '10px', border: '1px dashed #CBD5E1', padding: '4px', borderRadius: '6px' }}>
                          <img 
                            src={`data:image/png;base64,${script.questions[currentPage - 1].answerImageBase64}`} 
                            alt="Student Handwriting" 
                            style={{ width: '100%', borderRadius: '4px' }} 
                          />
                        </div>
                        {script.questions[currentPage - 1].extractedText && (
                          <div style={{ background: '#FFFBEB', padding: '10px', borderRadius: '6px', border: '1px solid #FDE68A', fontSize: '0.85rem' }}>
                            <strong>🤖 OCR Extracted Text:</strong>
                            <p style={{ marginTop: '6px', marginBottom: 0, fontFamily: 'monospace' }}>
                              {script.questions[currentPage - 1].extractedText}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      script.questions[currentPage - 1].answerText || 'No answer provided.'
                    )}
                  </div>
                </div>
              )}

              {/* Render User's Annotations Stamps */}
              {pageAnnotations.map(ann => (
                <div
                  key={ann.id}
                  style={{
                    position: 'absolute',
                    left: `${ann.x}%`,
                    top: `${ann.y}%`,
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}
                >
                  {ann.type === 'TICK' && (
                    <div style={{
                      color: '#16A34A',
                      fontWeight: 900,
                      fontSize: '1.4rem',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
                    }}>
                      ✓
                    </div>
                  )}
                  {ann.type === 'CROSS' && (
                    <div style={{
                      color: '#DC2626',
                      fontWeight: 900,
                      fontSize: '1.4rem',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))'
                    }}>
                      ✗
                    </div>
                  )}
                  {ann.type === 'STEP_MARK' && (
                    <div style={{
                      background: '#2563EB',
                      color: 'white',
                      fontWeight: 900,
                      fontSize: '0.72rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.4)',
                    }}>
                      +{ann.marksValue}M
                    </div>
                  )}
                  {ann.type === 'COMMENT' && (
                    <div style={{
                      background: '#FEF3C7',
                      color: '#92400E',
                      border: '1px solid #FCD34D',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                    }}>
                      💬 {ann.text}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════ RIGHT PANE: QUESTION-BY-QUESTION SCORING PANEL ════ */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid var(--color-border, #E2E8F0)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          overflowY: 'auto',
          maxHeight: '80vh',
        }}>
          {/* Question Selector Tabs */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', marginBottom: '8px' }}>
              QUESTIONS IN CIE PAPER ({evaluatedCount}/{script.questions.length} EVALUATED)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {script.questions.map((q, idx) => {
                const isActive = idx === activeQuestionIdx;
                const isDone = q.isEvaluated;

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setActiveQuestionIdx(idx);
                      setCurrentPage(idx + 1);
                    }}
                    style={{
                      flex: 1,
                      minWidth: '70px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isActive ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                      background: isActive ? '#EEF2FF' : isDone ? '#F0FDF4' : '#F8FAFC',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: isActive ? '#4F46E5' : '#0F172A' }}>
                      Q{q.questionNumber}
                    </div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isDone ? '#16A34A' : '#64748B' }}>
                      {q.awardedMarks || 0}/{q.maxMarks}M
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Details Box */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid #E2E8F0',
            marginBottom: '18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A' }}>
                Question {currentQuestion.questionNumber}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                  {currentQuestion.co}
                </span>
                <span style={{ background: '#F3E8FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                  Bloom {currentQuestion.bloomsLevel}
                </span>
                <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                  Max: {currentQuestion.maxMarks}M
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
              {currentQuestion.questionText}
            </p>

            {currentQuestion.aiSuggestedMarks !== undefined && (
              <div style={{
                marginTop: '10px',
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '0.78rem',
                color: '#1D4ED8',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
              }}>
                <Sparkles size={14} /> AI Rubric Recommendation: {currentQuestion.aiSuggestedMarks} / {currentQuestion.maxMarks} Marks
              </div>
            )}
          </div>

          {/* Marks Allocation Stepper */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
              Award Marks (0 to {currentQuestion.maxMarks} Marks):
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {Array.from({ length: currentQuestion.maxMarks + 1 }, (_, i) => i).map(mark => {
                const isSelected = currentQuestion.awardedMarks === mark;
                return (
                  <button
                    key={mark}
                    type="button"
                    onClick={() => handleAwardMarks(mark)}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid #4F46E5' : '1px solid #CBD5E1',
                      background: isSelected ? '#4F46E5' : 'white',
                      color: isSelected ? 'white' : '#0F172A',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {mark}
                  </button>
                );
              })}
            </div>

            {/* Custom Direct Score Input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 700 }}>Or Direct Score:</span>
              <input
                type="number"
                min="0"
                max={currentQuestion.maxMarks}
                value={currentQuestion.awardedMarks || 0}
                onChange={e => handleAwardMarks(parseInt(e.target.value) || 0)}
                style={{
                  width: '64px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1.5px solid #CBD5E1',
                  fontWeight: 900,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>/ {currentQuestion.maxMarks} M</span>
            </div>
          </div>

          {/* Evaluator Remarks for this Question */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
              Question Feedback / Rubric Notes for Student:
            </label>
            <textarea
              rows={2}
              value={currentQuestion.evaluatorRemarks || ''}
              onChange={e => handleUpdateRemarks(e.target.value)}
              placeholder="e.g. Accurate recurrence tree. Full marks awarded."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Next / Previous Question navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #F1F5F9' }}>
            <button
              type="button"
              disabled={activeQuestionIdx === 0}
              onClick={() => {
                setActiveQuestionIdx(i => Math.max(0, i - 1));
                setCurrentPage(p => Math.max(1, p - 1));
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: 'white',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: activeQuestionIdx === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Previous Question
            </button>
            <button
              type="button"
              disabled={activeQuestionIdx >= script.questions.length - 1}
              onClick={() => {
                setActiveQuestionIdx(i => Math.min(script.questions.length - 1, i + 1));
                setCurrentPage(p => Math.min(script.totalPages, p + 1));
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#4F46E5',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: activeQuestionIdx >= script.questions.length - 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Next Question →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
