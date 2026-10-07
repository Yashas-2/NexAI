import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AssignedCourse, FacultyCIEPaper, FacultyCIEQuestion } from '../../../types';
import { X, Plus, Send, Edit2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

interface CreateCIEPaperModalProps {
  isOpen: boolean;
  selectedCourseCode: string;
  courses: AssignedCourse[];
  onClose: () => void;
  onSubmitPaper: (paper: FacultyCIEPaper) => void;
  initialPaper?: FacultyCIEPaper;
}

export const CreateCIEPaperModal: React.FC<CreateCIEPaperModalProps> = ({
  isOpen,
  selectedCourseCode,
  courses,
  onClose,
  onSubmitPaper,
  initialPaper,
}) => {
  const user = useAuthStore(s => s.user);
  const [newTestType, setNewTestType] = useState<'CIE-1' | 'CIE-2' | 'CIE-3' | 'ASSIGNMENT_TEST'>('CIE-1');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionAnswer, setNewQuestionAnswer] = useState('');
  const [newQuestionNumber, setNewQuestionNumber] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [newQuestionMarks, setNewQuestionMarks] = useState(10);
  const [newQuestionBlooms, setNewQuestionBlooms] = useState<'L1' | 'L2' | 'L3' | 'L4' | 'L5'>('L3');
  const [newQuestionCO, setNewQuestionCO] = useState<'CO1' | 'CO2' | 'CO3' | 'CO4' | 'CO5'>('CO2');
  const [stagedQuestions, setStagedQuestions] = useState<FacultyCIEQuestion[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      if (initialPaper) {
        setStagedQuestions(initialPaper.questions);
        setNewTestType(initialPaper.testType);
      } else {
        setStagedQuestions([]);
        setNewTestType('CIE-1');
      }
      setNewQuestionText('');
      setNewQuestionAnswer('');
      setNewQuestionNumber('');
      setEditingQuestionId(null);
    }
  }, [isOpen, initialPaper]);

  if (!isOpen) return null;

  const handleAddQuestionToDraft = () => {
    if (!newQuestionNumber.trim()) {
      toast.error('Please enter a question number (e.g. 1a).');
      return;
    }
    if (!newQuestionText.trim()) {
      toast.error('Please enter question description.');
      return;
    }
    if (!newQuestionAnswer.trim()) {
      toast.error('Please enter an answer/solution.');
      return;
    }

    if (editingQuestionId) {
      setStagedQuestions(prev => prev.map(q => q.id === editingQuestionId ? {
        ...q,
        qNumber: newQuestionNumber.trim(),
        text: newQuestionText.trim(),
        answer: newQuestionAnswer.trim(),
        marks: Number(newQuestionMarks) || 5,
        bloomsLevel: newQuestionBlooms,
        co: newQuestionCO,
      } : q));
      setEditingQuestionId(null);
      toast.success('Question updated successfully.');
    } else {
      const newQ: FacultyCIEQuestion = {
        id: `sq_${Date.now().toString().slice(-4)}`,
        qNumber: newQuestionNumber.trim(),
        text: newQuestionText.trim(),
        answer: newQuestionAnswer.trim(),
        marks: Number(newQuestionMarks) || 5,
        bloomsLevel: newQuestionBlooms,
        co: newQuestionCO,
      };
      setStagedQuestions(prev => [...prev, newQ]);
      toast.success(`Question ${newQ.qNumber} added to CIE paper draft.`);
    }

    setNewQuestionText('');
    setNewQuestionAnswer('');
    setNewQuestionNumber('');
  };

  const handleSubmit = () => {
    if (stagedQuestions.length === 0) {
      toast.error('Please add at least one question.');
      return;
    }
    const totalM = stagedQuestions.reduce((acc, q) => acc + q.marks, 0);
    const selectedCourseObj = courses.find(c => c.code === selectedCourseCode);

    const newPaper: FacultyCIEPaper = {
      id: initialPaper ? initialPaper.id : `CIE-${selectedCourseCode}-${newTestType}-${Date.now().toString().slice(-4)}`,
      courseCode: selectedCourseCode,
      courseTitle: selectedCourseObj?.title || 'Subject',
      semester: selectedCourseObj?.semester || 'Semester',
      testType: newTestType,
      maxMarks: totalM,
      status: 'SUBMITTED_TO_HOD',
      submittedAt: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
      questions: stagedQuestions,
      facultyName: user?.full_name || 'Faculty Member',
    };

    onSubmitPaper(newPaper);
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.5rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        maxWidth: '640px',
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8FAFC',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
              {initialPaper ? 'Revise CIE Paper' : 'Draft New CIE Paper'} for {selectedCourseCode}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748B' }}>
              Author questions with Bloom's Taxonomy and submit to HOD for approval
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={20} />
          </button>
        </div>

        {initialPaper?.hodRemarks && (
          <div style={{ background: '#FEF2F2', padding: '16px 24px', borderBottom: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 800, fontSize: '0.9rem' }}>
              <AlertTriangle size={18} /> HOD Directives for Revision
            </div>
            <div style={{ color: '#7F1D1D', fontSize: '0.85rem' }}>{initialPaper.hodRemarks}</div>
            
            {initialPaper.hodEditedContent && initialPaper.hodEditedContent !== initialPaper.questions.map(q => `${q.qNumber}) [${q.marks}M] [${q.co}] [${q.bloomsLevel}]\n${q.text}`).join('\n\n') && (
              <div style={{ marginTop: '8px', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #FCA5A5' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B91C1C', marginBottom: '6px' }}>HOD edited the paper text. Please update your questions below to match:</div>
                <pre style={{ margin: 0, fontSize: '0.8rem', color: '#450A0A', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {initialPaper.hodEditedContent}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '24px', maxHeight: '68vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Test Type</label>
              <select
                value={newTestType}
                onChange={e => setNewTestType(e.target.value as any)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, background: 'white' }}
              >
                <option value="CIE-1">CIE-1 (First Internal Test)</option>
                <option value="CIE-2">CIE-2 (Second Internal Test)</option>
                <option value="CIE-3">CIE-3 (Third Internal Test)</option>
                <option value="ASSIGNMENT_TEST">Assignment / Lab Test</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Assigned Subject</label>
              <input
                type="text"
                disabled
                value={selectedCourseCode}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 800, background: '#F1F5F9', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Add Question Box */}
          <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                {editingQuestionId ? '✏️ Edit Question:' : '➕ Add Question to Paper:'}
              </div>
              <input
                type="text"
                placeholder="Q. No (e.g. 1a)"
                value={newQuestionNumber}
                onChange={e => setNewQuestionNumber(e.target.value)}
                style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 800 }}
              />
            </div>
            <textarea
              rows={3}
              placeholder="Enter question statement..."
              value={newQuestionText}
              onChange={e => setNewQuestionText(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px' }}
            />
            <textarea
              rows={2}
              placeholder="Enter answer/solution..."
              value={newQuestionAnswer}
              onChange={e => setNewQuestionAnswer(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Marks</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={newQuestionMarks}
                  onChange={e => setNewQuestionMarks(parseInt(e.target.value) || 5)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 800, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Bloom Level</label>
                <select
                  value={newQuestionBlooms}
                  onChange={e => setNewQuestionBlooms(e.target.value as any)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, background: 'white' }}
                >
                  <option value="L1">L1 - Remember</option>
                  <option value="L2">L2 - Understand</option>
                  <option value="L3">L3 - Apply</option>
                  <option value="L4">L4 - Analyze</option>
                  <option value="L5">L5 - Evaluate</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>Outcome (CO)</label>
                <select
                  value={newQuestionCO}
                  onChange={e => setNewQuestionCO(e.target.value as any)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, background: 'white' }}
                >
                  <option value="CO1">CO1 - Concepts</option>
                  <option value="CO2">CO2 - Design</option>
                  <option value="CO3">CO3 - Implementation</option>
                  <option value="CO4">CO4 - Analysis</option>
                  <option value="CO5">CO5 - Synthesis</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddQuestionToDraft}
                style={{
                  marginTop: '16px',
                  padding: '7px 14px',
                  background: editingQuestionId ? '#0284C7' : '#0F172A',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {editingQuestionId ? <Edit2 size={14} /> : <Plus size={14} />} {editingQuestionId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>

          {/* Questions Staged in Paper */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0F172A' }}>
                Questions in Draft ({stagedQuestions.length})
              </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#4F46E5' }}>
                Total Marks: {stagedQuestions.reduce((acc, q) => acc + q.marks, 0)} M
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stagedQuestions.map((q, idx) => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
                  <div style={{ color: '#334155' }}>
                    <strong>Q{q.qNumber}.</strong> {q.text}
                    {q.answer && (
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                        Ans: {q.answer}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                    <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>{q.co}</span>
                    <span style={{ background: '#F3E8FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>{q.bloomsLevel}</span>
                    <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>{q.marks}M</span>
                    <button 
                      onClick={() => {
                        const qToEdit = stagedQuestions.find(item => item.id === q.id);
                        if (qToEdit) {
                          setEditingQuestionId(q.id);
                          setNewQuestionNumber(qToEdit.qNumber);
                          setNewQuestionText(qToEdit.text);
                          setNewQuestionAnswer(qToEdit.answer || '');
                          setNewQuestionMarks(qToEdit.marks);
                          setNewQuestionBlooms(qToEdit.bloomsLevel);
                          setNewQuestionCO(qToEdit.co);
                        }
                      }}
                      style={{ background: 'transparent', border: 'none', color: '#0284C7', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                      title="Edit Question"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => setStagedQuestions(prev => prev.filter(item => item.id !== q.id))}
                      style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                      title="Remove Question"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFC' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Send size={14} /> Submit CIE Paper to HOD ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
