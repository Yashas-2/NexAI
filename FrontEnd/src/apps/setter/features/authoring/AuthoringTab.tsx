import React, { useState } from 'react';
import { QuestionPaperDraft, QuestionItem } from '../../types';
import {
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  CheckCircle2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Eye
} from 'lucide-react';
import { QuestionEditorModal } from './components/QuestionEditorModal';

interface AuthoringTabProps {
  drafts: QuestionPaperDraft[];
  activeSubjectCode: string;
  onUpdateDraft: (updatedDraft: QuestionPaperDraft) => void;
  onNavigateToAI: () => void;
  onNavigateToPreview: () => void;
  onNavigateToSubmit: () => void;
}

const BLOOM_COLORS: Record<string, string> = {
  Remember: '#64748b',
  Understand: '#3b82f6',
  Apply: '#10b981',
  Analyze: '#8b5cf6',
  Evaluate: '#f59e0b',
  Create: '#ef4444',
};

export const AuthoringTab: React.FC<AuthoringTabProps> = ({
  drafts,
  activeSubjectCode,
  onUpdateDraft,
  onNavigateToAI,
  onNavigateToPreview,
  onNavigateToSubmit,
}) => {
  // Filter drafts for current subject
  const subjectDrafts = drafts.filter(d => d.subjectCode === activeSubjectCode);
  const [activeSetLabel, setActiveSetLabel] = useState<'Set A' | 'Set B' | 'Set C' | 'Set D'>('Set A');
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [selectedSectionForAdd, setSelectedSectionForAdd] = useState('Part A');

  const currentDraft = subjectDrafts.find(d => d.setLabel === activeSetLabel) || subjectDrafts[0] || {
    id: 'placeholder',
    setLabel: 'Set A',
    title: 'Loading...',
    subjectCode: activeSubjectCode,
    subjectTitle: 'Loading...',
    examSession: 'Loading...',
    maxMarks: 100,
    questions: [],
    totalMarks: 0,
    status: 'DRAFT',
    lastSavedAt: ''
  };

  // Calculate live marks
  const totalCalculatedMarks = currentDraft?.questions.reduce((sum, q) => sum + q.marks, 0) || 0;
  const isMarksTargetMet = totalCalculatedMarks === (currentDraft?.maxMarks || 100);

  // Group questions by section
  const sections = Array.from(new Set(currentDraft?.questions.map(q => q.section) || ['Part A', 'Part B', 'Part C', 'Part D']));

  // Handlers
  const handleSaveQuestion = (savedQ: QuestionItem) => {
    if (!currentDraft) return;

    let updatedQuestions: QuestionItem[];
    const existingIndex = currentDraft.questions.findIndex(q => q.id === savedQ.id);

    if (existingIndex >= 0) {
      updatedQuestions = [...currentDraft.questions];
      updatedQuestions[existingIndex] = savedQ;
    } else {
      updatedQuestions = [...currentDraft.questions, savedQ];
    }

    // Re-tally total marks
    const newTotal = updatedQuestions.reduce((sum, q) => sum + q.marks, 0);

    const updatedDraft: QuestionPaperDraft = {
      ...currentDraft,
      questions: updatedQuestions,
      totalMarks: newTotal,
      lastSavedAt: 'Just now',
    };

    onUpdateDraft(updatedDraft);
    setEditingQuestion(null);
    setIsAddingQuestion(false);
  };

  const handleDeleteQuestion = (qId: string) => {
    if (!currentDraft) return;
    const updatedQuestions = currentDraft.questions.filter(q => q.id !== qId);
    const newTotal = updatedQuestions.reduce((sum, q) => sum + q.marks, 0);

    onUpdateDraft({
      ...currentDraft,
      questions: updatedQuestions,
      totalMarks: newTotal,
      lastSavedAt: 'Just now',
    });
  };

  const handleCreateNewSet = () => {
    const existingLabels = subjectDrafts.map(d => d.setLabel);
    const candidateLabels: ('Set A' | 'Set B' | 'Set C' | 'Set D')[] = ['Set A', 'Set B', 'Set C', 'Set D'];
    const nextLabel = candidateLabels.find(l => !existingLabels.includes(l));

    if (nextLabel) {
      const newDraft: QuestionPaperDraft = {
        id: `DRAFT-${activeSubjectCode}-${nextLabel.replace(' ', '-')}`,
        subjectCode: activeSubjectCode,
        subjectTitle: currentDraft?.subjectTitle || 'Data Structures & Algorithms',
        examSession: 'Fall 2026',
        semester: '3rd Semester B.Tech',
        setLabel: nextLabel,
        status: 'DRAFT',
        totalMarks: 0,
        maxMarks: 100,
        durationMinutes: 180,
        aiQualityScore: 85,
        similarityScore: 0.5,
        lastSavedAt: 'Just now',
        questions: [],
      };
      onUpdateDraft(newDraft);
      setActiveSetLabel(nextLabel);
    }
  };

  if (!currentDraft) {
    return (
      <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', border: '1.5px dashed var(--color-border)' }}>
        <p>No drafts found for {activeSubjectCode}.</p>
        <button onClick={handleCreateNewSet} style={{ padding: '10px 20px', background: '#48977f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
          Create Initial Set A
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Top Bar: Set Switcher & Live Marks Counter ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        padding: '18px 24px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Set Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            Active Set:
          </span>
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            {subjectDrafts.map(d => {
              const isSelected = d.setLabel === activeSetLabel;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveSetLabel(d.setLabel)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSelected ? 'white' : 'transparent',
                    color: isSelected ? '#48977f' : 'var(--color-text-secondary)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <span>{d.setLabel}</span>
                  <span style={{
                    fontSize: '0.7rem',
                    background: d.totalMarks === 100 ? '#ecfdf5' : '#fef3c7',
                    color: d.totalMarks === 100 ? '#059669' : '#b45309',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {d.totalMarks}M
                  </span>
                </button>
              );
            })}

            {subjectDrafts.length < 4 && (
              <button
                onClick={handleCreateNewSet}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  background: 'transparent',
                  color: '#48977f',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Plus size={14} /> New Set
              </button>
            )}
          </div>
        </div>

        {/* Live Marks Counter Progress Indicator & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>TOTAL MARKS:</span>
              <strong style={{ fontSize: '1.2rem', color: isMarksTargetMet ? '#16a34a' : '#e11d48' }}>
                {totalCalculatedMarks} / {currentDraft.maxMarks} Marks
              </strong>
              {isMarksTargetMet && <CheckCircle2 size={16} color="#16a34a" />}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
              Last saved: {currentDraft.lastSavedAt}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Direct Add Question Button */}
            <button
              onClick={() => {
                setSelectedSectionForAdd('Part A');
                setIsAddingQuestion(true);
              }}
              style={{
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(72,151,127,0.3)',
              }}
            >
              <Plus size={16} /> Add Question to {currentDraft.setLabel}
            </button>

            <button
              onClick={onNavigateToAI}
              style={{
                padding: '9px 16px',
                background: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '8px',
                color: '#166534',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={15} color="#16a34a" /> AI Check
            </button>

            <button
              onClick={onNavigateToPreview}
              style={{
                padding: '9px 16px',
                background: 'white',
                border: '1.5px solid var(--color-border)',
                borderRadius: '8px',
                color: 'var(--color-text-primary)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Eye size={15} /> Official Preview
            </button>

            <button
              onClick={onNavigateToSubmit}
              disabled={!isMarksTargetMet}
              style={{
                padding: '9px 18px',
                background: isMarksTargetMet ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)' : '#cbd5e1',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: isMarksTargetMet ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: isMarksTargetMet ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
              }}
            >
              <ShieldCheck size={16} /> Vault {currentDraft.setLabel} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Active Set Step Banner & Quick Actions ── */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1.5px solid #86efac',
        borderRadius: '14px',
        padding: '16px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            background: '#48977f',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
          }}>
            {(currentDraft.setLabel || 'Set A').split(' ')[1]}
          </div>

          <div>
            <h4 style={{ margin: 0, color: '#166534', fontWeight: 800, fontSize: '0.95rem' }}>
              Currently Editing: {currentDraft.setLabel} ({currentDraft.subjectCode} — {currentDraft.subjectTitle})
            </h4>
            <p style={{ margin: '2px 0 0 0', color: '#15803d', fontSize: '0.78rem' }}>
              {currentDraft.questions.length} Questions authored • <strong>{totalCalculatedMarks} / {currentDraft.maxMarks} Marks allocated</strong>
              {!isMarksTargetMet && ` (${currentDraft.maxMarks - totalCalculatedMarks} Marks remaining)`}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              setSelectedSectionForAdd(sections[0] || 'Part A');
              setIsAddingQuestion(true);
            }}
            style={{
              padding: '9px 20px',
              background: '#166534',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 3px 10px rgba(22,101,52,0.25)',
            }}
          >
            <Plus size={16} /> Add Next Question (Q{currentDraft.questions.length + 1}) →
          </button>
        </div>
      </div>

      {/* ── Section Blocks & Questions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {sections.map(secName => {
          const secQuestions = currentDraft.questions.filter(q => q.section === secName);
          const secMarks = secQuestions.reduce((sum, q) => sum + q.marks, 0);

          return (
            <div
              key={secName}
              style={{
                background: 'white',
                borderRadius: '16px',
                border: '1.5px solid var(--color-border)',
                overflow: 'hidden',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              }}
            >
              {/* Section Header */}
              <div style={{
                background: '#f8fafc',
                padding: '14px 24px',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Layers size={18} color="#48977f" />
                  <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                    {secName}
                  </h4>
                  <span style={{ background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700 }}>
                    {secQuestions.length} Questions • {secMarks} Marks
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedSectionForAdd(secName);
                    setIsAddingQuestion(true);
                  }}
                  style={{
                    background: 'white',
                    border: '1.5px solid var(--color-border)',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#48977f',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus size={13} /> Add Question to {secName}
                </button>
              </div>

              {/* Questions List */}
              {secQuestions.length === 0 ? (
                <div style={{ padding: '32px 24px', textAlign: 'center', background: '#fafbfc' }}>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    No questions added to <strong>{secName}</strong> yet.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedSectionForAdd(secName);
                      setIsAddingQuestion(true);
                    }}
                    style={{
                      padding: '8px 18px',
                      background: 'white',
                      border: '1.5px solid #48977f',
                      color: '#48977f',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                    }}
                  >
                    <Plus size={14} /> Add Question to {secName}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {secQuestions.map(q => (
                    <div
                      key={q.id}
                      style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        gap: '18px',
                        transition: 'background 0.2s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                    >
                      {/* Number circle */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: 'var(--color-text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}>
                        {q.number}{q.part || ''}
                      </div>

                      {/* Question Content & Metadata */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: `${BLOOM_COLORS[q.bloomsLevel]}15`,
                              color: BLOOM_COLORS[q.bloomsLevel],
                              border: `1px solid ${BLOOM_COLORS[q.bloomsLevel]}33`,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 700
                            }}>
                              {q.bloomsLevel}
                            </span>

                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                              {q.coMapping}
                            </span>

                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                              Unit {q.module}
                            </span>

                            {q.hasOrChoice && (
                              <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700 }}>
                                Has OR Choice
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              background: '#ecfdf5',
                              color: '#059669',
                              border: '1px solid #a7f3d0',
                              padding: '3px 10px',
                              borderRadius: '6px',
                              fontSize: '0.82rem',
                              fontWeight: 800
                            }}>
                              {q.marks} Marks
                            </span>

                            {/* Action Buttons */}
                            <button
                              onClick={() => setEditingQuestion(q)}
                              style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Question"
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                              title="Delete Question"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Statement */}
                        <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>
                          {q.text}
                        </p>

                        {/* Or Question if present */}
                        {q.hasOrChoice && q.orQuestionText && (
                          <div style={{ background: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '10px 14px', borderRadius: '6px', marginBottom: '10px' }}>
                            <strong style={{ fontSize: '0.75rem', color: '#92400e', display: 'block', marginBottom: '2px' }}>[OR OPTION]:</strong>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#78350f' }}>{q.orQuestionText}</p>
                          </div>
                        )}

                        {/* Scheme Notes */}
                        {q.schemeNotes && (
                          <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.75rem', color: '#64748b' }}>
                            <strong style={{ color: '#475569' }}>Scheme Key: </strong> {q.schemeNotes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Question Editor Modal */}
      {(editingQuestion || isAddingQuestion) && (
        <QuestionEditorModal
          question={editingQuestion}
          defaultSection={selectedSectionForAdd}
          nextNumber={currentDraft.questions.length + 1}
          onSave={handleSaveQuestion}
          onClose={() => {
            setEditingQuestion(null);
            setIsAddingQuestion(false);
          }}
        />
      )}
    </div>
  );
};
