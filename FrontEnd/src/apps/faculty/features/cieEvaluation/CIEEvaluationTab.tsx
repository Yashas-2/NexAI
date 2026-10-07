import React, { useState } from 'react';
import { AssignedCourse, CIEScannedScript } from '../../types';
import { CIEDigitalValuationStudio } from './components/CIEDigitalValuationStudio';
import {
  PenTool,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CIEEvaluationTabProps {
  courses: AssignedCourse[];
  selectedCourseCode: string;
  onSelectCourseCode: (code: string) => void;
  scripts: CIEScannedScript[];
  onUpdateScript: (updated: CIEScannedScript) => void;
  onValuationComplete: (awardedTotal: number, studentUSN: string, testType: 'CIE-1' | 'CIE-2', maxMarks: number) => void;
}

export const CIEEvaluationTab: React.FC<CIEEvaluationTabProps> = ({
  courses,
  selectedCourseCode,
  onSelectCourseCode,
  scripts,
  onUpdateScript,
  onValuationComplete,
}) => {
  const [activeScriptId, setActiveScriptId] = useState<string | null>(null);
  const [testFilter, setTestFilter] = useState<'ALL' | 'CIE-1' | 'CIE-2'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'EVALUATED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Course Scripts
  const courseScripts = scripts.filter(s => s.courseCode === selectedCourseCode);

  const filteredScripts = courseScripts.filter(s => {
    const matchesTest = testFilter === 'ALL' || s.testType === testFilter;
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && (s.status === 'PENDING_VALUATION' || s.status === 'NOT_SUBMITTED')) ||
      (statusFilter === 'EVALUATED' && s.status === 'EVALUATED');
    const matchesSearch =
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentUSN.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTest && matchesStatus && matchesSearch;
  });

  const activeScript = scripts.find(s => s.id === activeScriptId) || null;

  // Active studio view
  if (activeScript) {
    return (
      <CIEDigitalValuationStudio
        script={activeScript}
        onUpdateScript={onUpdateScript}
        onClose={() => setActiveScriptId(null)}
        onSubmitSuccess={(awardedTotal, studentId, testType) => {
          onValuationComplete(awardedTotal, activeScript.studentUSN, testType, activeScript.maxMarks);
          setActiveScriptId(null);
          toast.success(
            `CIE Valuation Saved! Awarded ${awardedTotal}/${activeScript.maxMarks} Marks — Automatically synchronized into student's CIE score!`,
            { icon: '🎯', duration: 4500 }
          );
        }}
      />
    );
  }

  // Summary Metrics
  const pendingCount = courseScripts.filter(s => s.status === 'PENDING_VALUATION').length;
  const evaluatedCount = courseScripts.filter(s => s.status === 'EVALUATED').length;
  const evaluatedScores = courseScripts
    .filter(s => s.status === 'EVALUATED' && s.evaluatorTotalMarks !== undefined)
    .map(s => s.evaluatorTotalMarks!);
  const avgScore = evaluatedScores.length > 0
    ? (evaluatedScores.reduce((a, b) => a + b, 0) / evaluatedScores.length).toFixed(1)
    : '0';

  return (
    <div>
      {/* Top Controls Bar */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1.5px solid var(--color-border, #E2E8F0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              SUBJECT WORKLIST:
            </span>
            <select
              value={selectedCourseCode}
              onChange={e => onSelectCourseCode(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#0F172A',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              {courses.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.title}</option>
              ))}
            </select>
          </div>

          {/* Test Milestone Filter */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setTestFilter('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: testFilter === 'ALL' ? '#FFFFFF' : 'transparent',
                color: testFilter === 'ALL' ? '#4F46E5' : '#64748B',
              }}
            >
              All Tests
            </button>
            <button
              onClick={() => setTestFilter('CIE-1')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: testFilter === 'CIE-1' ? '#FFFFFF' : 'transparent',
                color: testFilter === 'CIE-1' ? '#4F46E5' : '#64748B',
              }}
            >
              CIE-1
            </button>
            <button
              onClick={() => setTestFilter('CIE-2')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: testFilter === 'CIE-2' ? '#FFFFFF' : 'transparent',
                color: testFilter === 'CIE-2' ? '#4F46E5' : '#64748B',
              }}
            >
              CIE-2
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search student or USN..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              padding: '7px 12px 7px 30px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              fontSize: '0.82rem',
              width: '220px',
            }}
          />
        </div>
      </div>

      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '22px' }}>
        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>PENDING SCRIPTS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#D97706', marginTop: '4px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Awaiting digital evaluation</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>EVALUATED SCRIPTS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#16A34A', marginTop: '4px' }}>
            {evaluatedCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Graded & published to roster</div>
        </div>

        <div style={{ background: '#FFFFFF', padding: '16px 20px', borderRadius: '14px', border: '1.5px solid #E2E8F0', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>AVERAGE CIE SCORE</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#4F46E5', marginTop: '4px' }}>
            {avgScore} <span style={{ fontSize: '0.85rem', color: '#94A3B8' }}>/ {courseScripts.length > 0 ? courseScripts[0].maxMarks : 30}M</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>Across evaluated answer scripts</div>
        </div>
      </div>

      {/* Scripts Queue List */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border, #E2E8F0)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PenTool size={18} color="#4F46E5" />
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
              Student CIE Answer Booklets ({filteredScripts.length})
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'ALL' ? '#0F172A' : '#F1F5F9',
                color: statusFilter === 'ALL' ? 'white' : '#64748B',
              }}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'PENDING' ? '#D97706' : '#F1F5F9',
                color: statusFilter === 'PENDING' ? 'white' : '#64748B',
              }}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter('EVALUATED')}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'EVALUATED' ? '#16A34A' : '#F1F5F9',
                color: statusFilter === 'EVALUATED' ? 'white' : '#64748B',
              }}
            >
              Evaluated ({evaluatedCount})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredScripts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
              No CIE answer scripts match the selected filter criteria.
            </div>
          ) : (
            filteredScripts.map(script => {
              const isEvaluated = script.status === 'EVALUATED';
              const isNotSubmitted = script.status === 'NOT_SUBMITTED' || script.totalPages === 0;

              return (
                <div
                  key={script.id}
                  style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid #F1F5F9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    background: isEvaluated ? '#FAFCFF' : '#FFFFFF',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: isEvaluated ? '#DCFCE7' : isNotSubmitted ? '#FEE2E2' : '#FEF3C7',
                      color: isEvaluated ? '#15803D' : isNotSubmitted ? '#B91C1C' : '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: '0.85rem',
                    }}>
                      {isEvaluated ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
                          {script.studentName}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#64748B', background: '#F1F5F9', padding: '1px 6px', borderRadius: '4px' }}>
                          {script.studentUSN}
                        </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4F46E5', background: '#EEF2FF', padding: '1px 6px', borderRadius: '4px' }}>
                          {script.testType}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>Booklet: {script.totalPages} Pages</span>
                        <span>•</span>
                        <span>Submitted: {script.submittedAt}</span>
                        {script.aiSuggestedMarks !== undefined && !isEvaluated && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#2563EB', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={12} /> AI Suggested: {script.aiSuggestedMarks}/{script.maxMarks}M
                            </span>
                          </>
                        )}
                        {isEvaluated && script.evaluatedAt && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#16A34A', fontWeight: 700 }}>
                              Evaluated on {script.evaluatedAt}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {isEvaluated ? (
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#16A34A' }}>
                          {script.evaluatorTotalMarks} / {script.maxMarks} M
                        </span>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: '#15803D', fontWeight: 700 }}>
                          GRADED & RECORDED ✓
                        </span>
                      </div>
                    ) : isNotSubmitted ? (
                      <span style={{
                        background: '#FEE2E2',
                        color: '#B91C1C',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}>
                        NOT SUBMITTED
                      </span>
                    ) : (
                      <span style={{
                        background: '#FEF3C7',
                        color: '#B45309',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                      }}>
                        PENDING CORRECTION
                      </span>
                    )}

                    <button
                      onClick={() => !isNotSubmitted && setActiveScriptId(script.id)}
                      disabled={isNotSubmitted}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isEvaluated || isNotSubmitted ? '#F1F5F9' : 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                        color: isEvaluated || isNotSubmitted ? '#94A3B8' : 'white',
                        border: isEvaluated || isNotSubmitted ? '1px solid #CBD5E1' : 'none',
                        padding: '9px 16px',
                        borderRadius: '8px',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        cursor: isNotSubmitted ? 'not-allowed' : 'pointer',
                        boxShadow: isEvaluated || isNotSubmitted ? 'none' : '0 2px 8px rgba(79,70,229,0.25)',
                      }}
                    >
                      <PenTool size={14} /> {isEvaluated ? 'Review / Re-evaluate' : isNotSubmitted ? 'Unavailable' : 'Open Evaluation Studio →'}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
