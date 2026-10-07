import React, { useState } from 'react';
import { QuestionItem, BloomsLevel } from '../../../types';
import { X, Check, FileText } from 'lucide-react';

interface QuestionEditorModalProps {
  question?: QuestionItem | null;
  defaultSection?: string;
  nextNumber?: number;
  onSave: (question: QuestionItem) => void;
  onClose: () => void;
}

const BLOOM_LEVELS: { level: BloomsLevel; desc: string; color: string }[] = [
  { level: 'Remember', desc: 'Recall facts & definitions', color: '#64748b' },
  { level: 'Understand', desc: 'Explain ideas & concepts', color: '#3b82f6' },
  { level: 'Apply', desc: 'Execute algorithms & solve problems', color: '#10b981' },
  { level: 'Analyze', desc: 'Derive proofs & differentiate', color: '#8b5cf6' },
  { level: 'Evaluate', desc: 'Justify decisions & compare', color: '#f59e0b' },
  { level: 'Create', desc: 'Design architectures & code', color: '#ef4444' },
];

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  question,
  defaultSection = 'Part A',
  nextNumber = 1,
  onSave,
  onClose,
}) => {
  const [section, setSection] = useState<string>(question?.section || defaultSection);
  const [number, setNumber] = useState<number>(question?.number || nextNumber);
  const [part, setPart] = useState<string>(question?.part || '');
  const [text, setText] = useState<string>(question?.text || '');
  const [marks, setMarks] = useState<number>(question?.marks || 10);
  const [bloomsLevel, setBloomsLevel] = useState<BloomsLevel>(question?.bloomsLevel || 'Understand');
  const [module, setModule] = useState<number>(question?.module || 1);
  const [coMapping, setCoMapping] = useState<string>(question?.coMapping || 'CO1');
  const [schemeNotes, setSchemeNotes] = useState<string>(question?.schemeNotes || '');
  const [hasOrChoice, setHasOrChoice] = useState<boolean>(question?.hasOrChoice || false);
  const [orQuestionText, setOrQuestionText] = useState<string>(question?.orQuestionText || '');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const updatedQuestion: QuestionItem = {
      id: question?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      number,
      part: part.trim() || undefined,
      section,
      text: text.trim(),
      marks: Number(marks),
      bloomsLevel,
      module: Number(module),
      coMapping,
      hasOrChoice,
      orQuestionText: hasOrChoice ? orQuestionText.trim() : undefined,
      schemeNotes: schemeNotes.trim() || undefined,
    };

    onSave(updatedQuestion);
    onClose();
  };

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
        maxWidth: '740px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '22px 30px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                background: 'rgba(72, 151, 127, 0.25)',
                border: '1.5px solid rgba(72, 151, 127, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#48977f'
              }}>
                <FileText size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {question ? `Edit Question ${question.number}` : `Add New Question (${section})`}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                  Assign marks, Bloom’s cognitive level, course outcomes, and evaluation keys.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} style={{ padding: '26px 30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Row 1: Section, Question Number, Marks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Section Block
              </label>
              <select
                value={section}
                onChange={e => setSection(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value="Part A">Part A (Foundations / 10M)</option>
                <option value="Part B">Part B (Core Algorithms / 15M)</option>
                <option value="Part C">Part C (Analytical & DP / 15M)</option>
                <option value="Part D">Part D (Advanced Synthesis / 10M)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Question Number
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={number}
                onChange={e => setNumber(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                required
              />
            </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                  Part (e.g. a, b)
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={part}
                  onChange={e => setPart(e.target.value)}
                  placeholder="Optional"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                />
              </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Marks Weightage
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={marks}
                onChange={e => setMarks(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid #48977f', fontSize: '0.85rem', fontWeight: 800, color: '#48977f', boxSizing: 'border-box' }}
                required
              />
            </div>
          </div>

          {/* Question Text Area */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Question Statement / Problem Specification *
              </label>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>Supports LaTeX / Mathematical Bounds</span>
            </div>
            <textarea
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. Derive the Master Theorem recurrence for T(n) = 3T(n/2) + O(n log n). Show boundary cases with formal asymptotic proofs."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1.5px solid var(--color-border)',
                fontSize: '0.88rem',
                lineHeight: 1.5,
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
              }}
              required
            />
          </div>

          {/* Bloom's Level Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
              Bloom's Taxonomy Cognitive Level
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {BLOOM_LEVELS.map(item => (
                <div
                  key={item.level}
                  onClick={() => setBloomsLevel(item.level)}
                  style={{
                    border: bloomsLevel === item.level ? `2px solid ${item.color}` : '1.5px solid #e2e8f0',
                    background: bloomsLevel === item.level ? `${item.color}15` : '#f8fafc',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.8rem', color: item.color }}>{item.level}</strong>
                    {bloomsLevel === item.level && <Check size={14} color={item.color} />}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)', display: 'block', marginTop: '2px' }}>
                    {item.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Row 3: Module & Course Outcome Mapping */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Syllabus Unit / Module Mapping
              </label>
              <select
                value={module}
                onChange={e => setModule(Number(e.target.value))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <option value={1}>Unit 1: Asymptotic Analysis & Linear Structures</option>
                <option value={2}>Unit 2: Hashing & Balanced Trees</option>
                <option value={3}>Unit 3: Graph Algorithms & Network Flow</option>
                <option value={4}>Unit 4: Dynamic Programming & String Processing</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
                Course Outcome (CO)
              </label>
              <select
                value={coMapping}
                onChange={e => setCoMapping(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 700 }}
              >
                <option value="CO1">CO1: Asymptotic Complexity & Foundations</option>
                <option value="CO2">CO2: Non-Linear & Tree Data Structures</option>
                <option value="CO3">CO3: Graph Optimization & Traversals</option>
                <option value="CO4">CO4: Dynamic Programming Algorithms</option>
                <option value="CO5">CO5: Advanced Synthesis & Data Structures</option>
              </select>
            </div>
          </div>

          {/* Internal Choice Toggle */}
          <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              <input
                type="checkbox"
                checked={hasOrChoice}
                onChange={e => setHasOrChoice(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              Include Internal Choice ("OR" Question)
            </label>

            {hasOrChoice && (
              <div style={{ marginTop: '10px' }}>
                <textarea
                  rows={2}
                  value={orQuestionText}
                  onChange={e => setOrQuestionText(e.target.value)}
                  placeholder="Enter alternate question statement (OR choice)..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--color-border)',
                    fontSize: '0.82rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* Scheme of Evaluation / Answer Key Notes */}
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
              Scheme of Evaluation & Solution Key Pointers (Confidential for Evaluators)
            </label>
            <textarea
              rows={2}
              value={schemeNotes}
              onChange={e => setSchemeNotes(e.target.value)}
              placeholder="e.g. 3 marks for algorithm pseudocode, 4 marks for tree rotation step drawing, 3 marks for final balance factor."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--color-border)',
                fontSize: '0.82rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                background: 'white',
                border: '1.5px solid var(--color-border)',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(72,151,127,0.3)'
              }}
            >
              <Check size={16} /> Save Question
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
