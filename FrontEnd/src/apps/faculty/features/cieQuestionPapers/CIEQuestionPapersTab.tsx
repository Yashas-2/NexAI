import React from 'react';
import { FacultyCIEPaper, AssignedCourse } from '../../types';
import { Plus, CheckCircle2, AlertTriangle, RotateCw, Trash2, Edit2 } from 'lucide-react';

interface CIEQuestionPapersTabProps {
  courses: AssignedCourse[];
  selectedCourseCode: string;
  onSelectCourseCode: (code: string) => void;
  ciePapers: FacultyCIEPaper[];
  onOpenCreatePaperModal: () => void;
  onResubmitForReaudit: (paperId: string) => void;
  onDeletePaper?: (paperId: string) => void;
}

export const CIEQuestionPapersTab: React.FC<CIEQuestionPapersTabProps> = ({
  courses,
  selectedCourseCode,
  onSelectCourseCode,
  ciePapers,
  onOpenCreatePaperModal,
  onResubmitForReaudit,
  onDeletePaper,
}) => {
  return (
    <div>
      {/* Header Actions */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1.5px solid var(--color-border, #E2E8F0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
            Continuous Internal Evaluation (CIE) Question Papers
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
            Draft test question papers with Bloom's Taxonomy levels and Course Outcomes, then submit to HOD for verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select
            value={selectedCourseCode}
            onChange={(e) => onSelectCourseCode(e.target.value)}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              background: '#F8FAFC',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: '#334155',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            {courses.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={onOpenCreatePaperModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            color: 'white',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          }}
        >
          <Plus size={16} /> Draft New CIE Paper
        </button>
        </div>
      </div>

      {/* Existing Papers List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {ciePapers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', background: '#F8FAFC', borderRadius: '16px', border: '1px dashed #CBD5E1', color: '#64748B' }}>
            No CIE papers drafted for {selectedCourseCode} yet.
          </div>
        )}
        {ciePapers.map(paper => (
          <div
            key={paper.id}
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1.5px solid var(--color-border, #E2E8F0)',
              padding: '20px 24px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    background: '#EEF2FF',
                    color: '#4F46E5',
                    fontWeight: 900,
                    fontSize: '0.8rem',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}>
                    {paper.courseCode}
                  </span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                    {paper.testType} • {paper.courseTitle}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                  {paper.questions.length} Questions • Maximum Marks: {paper.maxMarks} • {paper.submittedAt ? `Submitted: ${paper.submittedAt}` : 'Draft'}
                </span>
              </div>

              <div>
                {paper.status === 'APPROVED' && (
                  <span style={{ background: '#DCFCE7', color: '#15803D', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> APPROVED BY HOD ✓
                  </span>
                )}
                {paper.status === 'REVISION_REQUESTED' && (
                  <span style={{ background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FCA5A5', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> REVISION REQUESTED BY HOD
                  </span>
                )}
                {paper.status === 'SUBMITTED_TO_HOD' && (
                  <span style={{ background: '#FEF3C7', color: '#B45309', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <RotateCw size={14} /> {paper.submittedAt?.includes('Resubmitted') ? 'PENDING HOD RE-AUDIT ⏳' : 'PENDING HOD VERIFICATION ⏳'}
                  </span>
                )}
                {paper.status === 'DRAFT' && (
                  <span style={{ background: '#F1F5F9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontWeight: 800, fontSize: '0.78rem' }}>
                    DRAFT
                  </span>
                )}
                {onDeletePaper && (
                  <button 
                    onClick={() => onDeletePaper(paper.id)}
                    style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', marginLeft: '8px', padding: '4px', display: 'inline-flex', alignItems: 'center' }}
                    title="Delete Draft"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Questions Preview */}
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {paper.questions.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                  <div style={{ color: '#334155' }}>
                    <strong>Q{q.qNumber}.</strong> {q.text}
                    {q.answer && (
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#64748B', fontStyle: 'italic' }}>
                        Ans: {q.answer}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>{q.co}</span>
                    <span style={{ background: '#F3E8FF', color: '#7E22CE', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>Bloom {q.bloomsLevel}</span>
                    <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>{q.marks}M</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Re-Audit & Revision Directives Box */}
            {paper.status === 'REVISION_REQUESTED' && (
              <div style={{
                marginTop: '14px',
                background: '#FEF2F2',
                border: '1.5px solid #F87171',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
              }}>
                <div>
                  <div style={{ fontWeight: 800, color: '#991B1B', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} /> HOD Audit Directives & Required Revisions:
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.84rem', color: '#7F1D1D', fontWeight: 600 }}>
                    "{paper.hodRemarks}"
                  </p>
                  <div style={{ fontSize: '0.74rem', color: '#B91C1C', marginTop: '4px' }}>
                    Review the questions above, adjust Bloom levels/marks, and resubmit to HOD for re-audit.
                  </div>
                </div>

                <button
                  onClick={() => onResubmitForReaudit(paper.id)}
                  style={{
                    background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 18px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(185, 28, 28, 0.35)',
                    flexShrink: 0
                  }}
                >
                  <Edit2 size={14} /> Open for Revision & Resubmit
                </button>
              </div>
            )}

            {paper.status === 'APPROVED' && paper.hodRemarks && (
              <div style={{
                marginTop: '12px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '0.8rem',
                color: '#15803D',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle2 size={16} />
                <span>HOD Audit Approval: "{paper.hodRemarks}"</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
