import React, { useState } from 'react';
import { BookOpen, Users, Search, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SubjectExam, SessionScopeConfig } from '../../../types/allocationTypes';

interface Step2SubjectMatrixProps {
  scopeConfig: SessionScopeConfig;
  availableSubjects: SubjectExam[];
  selectedSubjects: SubjectExam[];
  onSubjectsChange: (subjects: SubjectExam[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const Step2SubjectMatrix: React.FC<Step2SubjectMatrixProps> = ({
  scopeConfig,
  availableSubjects,
  selectedSubjects,
  onSubjectsChange,
  onNext,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter: subjects matching selected departments AND semesters
  const eligiblePool = availableSubjects.filter(s =>
    (scopeConfig.selectedDepartments.length === 0 || scopeConfig.selectedDepartments.includes(s.deptCode)) &&
    (scopeConfig.selectedSemesters.length === 0 || scopeConfig.selectedSemesters.includes(s.semester))
  );

  // Always show all subjects for selected depts if no semester filtered, or fall back gracefully
  const displayPool = eligiblePool.length > 0
    ? eligiblePool
    : availableSubjects.filter(s =>
        scopeConfig.selectedDepartments.length === 0 || scopeConfig.selectedDepartments.includes(s.deptCode)
      );

  const filteredSubjects = displayPool.filter(s =>
    s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.deptCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSubject = (subject: SubjectExam) => {
    const exists = selectedSubjects.some(s => s.code === subject.code);
    if (exists) {
      onSubjectsChange(selectedSubjects.filter(s => s.code !== subject.code));
    } else {
      onSubjectsChange([...selectedSubjects, subject]);
    }
  };

  const selectAll = () => {
    onSubjectsChange(displayPool);
  };

  const clearAll = () => {
    onSubjectsChange([]);
  };

  const totalCandidates = selectedSubjects.reduce((sum, s) => sum + s.eligibleStudents, 0);
  const activeDepartments = [...new Set(selectedSubjects.map(s => s.deptCode))];
  const isInterleavingFeasible = activeDepartments.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Guidance Panel ── */}
      <div style={{
        background: 'linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%)',
        border: '1.5px solid #BBF7D0',
        borderRadius: '14px',
        padding: '18px 22px',
        display: 'flex',
        gap: '16px',
        alignItems: 'flex-start',
      }}>
        <div style={{ fontSize: '1.6rem', flexShrink: 0 }}>📚</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#065F46', marginBottom: '6px' }}>
            Step 2 of 5 — Select subjects for this exam session
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', color: '#047857', fontSize: '0.82rem', lineHeight: 1.7 }}>
            <li>Only subjects <strong>matching your selected departments & semesters</strong> appear here</li>
            <li>Click a subject card to <strong>include it in this SEE session</strong> (highlighted = selected)</li>
            <li>Each card shows the <strong>eligible candidate count</strong> — only students cleared by attendance, CIE & fee clearance</li>
            <li>Select subjects from <strong>at least 2 departments</strong> to enable cross-department anti-cheating interleaving</li>
            <li>Use <strong>"Select All Available"</strong> to include all eligible subjects at once</li>
          </ul>
        </div>
      </div>

      {/* Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0D9488 0%, #115E59 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookOpen size={22} color="white" />
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>
              Step 2 of 5 • Cross-Department Course Matrix
            </span>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Subject Selection & Eligible Candidate Tallies</h2>
          </div>
        </div>

        {/* Headcount Chip */}
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '10px 20px',
          textAlign: 'right',
          border: '1px solid rgba(255,255,255,0.3)',
        }}>
          <div style={{ fontSize: '0.75rem', opacity: 0.85, textTransform: 'uppercase', fontWeight: 600 }}>Total Eligible Candidates</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{totalCandidates} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Students</span></div>
        </div>
      </div>

      {/* Anti-Cheating Advisory Notice */}
      <div style={{
        background: isInterleavingFeasible ? '#F0FDF4' : '#FFFBEB',
        border: `1.5px solid ${isInterleavingFeasible ? '#BBF7D0' : '#FDE68A'}`,
        borderRadius: '12px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isInterleavingFeasible ? (
            <CheckCircle2 size={24} color="#16A34A" />
          ) : (
            <ShieldAlert size={24} color="#D97706" />
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: isInterleavingFeasible ? '#166534' : '#92400E' }}>
              {isInterleavingFeasible
                ? `Cross-Department Matrix Enabled (${activeDepartments.length} Branches: ${activeDepartments.join(', ')})`
                : 'Single Department Alert: Interleaving Recommended'}
            </div>
            <div style={{ fontSize: '0.78rem', color: isInterleavingFeasible ? '#15803D' : '#B45309', marginTop: '2px' }}>
              {isInterleavingFeasible
                ? 'Excellent! With multiple departments selected, the AI will interleave adjacent desks with different papers, preventing copying.'
                : 'To maximize anti-cheating efficacy, select at least 2 distinct departments so students write different subject papers on adjacent seats.'}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '420px' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by subject code, title, or department..."
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.85rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={selectAll}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            Select All Available ({displayPool.length})
          </button>
          <button
            onClick={clearAll}
            style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: '6px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              color: '#64748B',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Subjects Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '14px',
      }}>
        {filteredSubjects.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '40px',
            textAlign: 'center',
            background: '#F8FAFC',
            borderRadius: '12px',
            border: '1.5px dashed #CBD5E1',
          }}>
            <p style={{ fontWeight: 700, color: '#64748B', margin: '0 0 8px 0' }}>No subjects found</p>
            <p style={{ fontSize: '0.82rem', color: '#94A3B8', margin: 0 }}>
              {availableSubjects.length === 0
                ? 'Subjects are loading or none exist in the database yet.'
                : 'No subjects match the selected departments and semesters. Go back and adjust your scope.'}
            </p>
          </div>
        ) : filteredSubjects.map(sub => {
          const isSelected = selectedSubjects.some(s => s.code === sub.code);
          return (
            <div
              key={sub.code}
              onClick={() => toggleSubject(sub)}
              style={{
                background: 'white',
                borderRadius: '12px',
                border: isSelected ? `2px solid ${sub.color}` : '1.5px solid #E2E8F0',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 4px 16px ${sub.color}1F` : '0 1px 4px rgba(0,0,0,0.03)',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{
                  background: `${sub.color}15`,
                  color: sub.color,
                  border: `1px solid ${sub.color}33`,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}>
                  {sub.code} • Sem {sub.semester}
                </span>

                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: isSelected ? `2px solid ${sub.color}` : '2px solid #CBD5E1',
                  background: isSelected ? sub.color : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                </div>
              </div>

              <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', fontWeight: 800, color: '#1E293B', lineHeight: 1.3 }}>
                {sub.title}
              </h4>

              <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '12px' }}>
                Dept of {sub.deptCode} • {sub.credits} Academic Credits
              </div>

              <div style={{
                background: isSelected ? `${sub.color}0F` : '#F8FAFC',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: sub.color }}>
                  <Users size={15} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{sub.eligibleStudents}</span>
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>eligible candidates</span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569' }}>SEE Written</span>
              </div>

            </div>
          );
        })}
      </div>

      {/* Navigation Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'white',
            border: '1.5px solid #CBD5E1',
            borderRadius: '10px',
            padding: '12px 24px',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#475569',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ArrowLeft size={16} /> Back to Scope & Schedule
        </button>

        <button
          onClick={onNext}
          disabled={selectedSubjects.length === 0}
          style={{
            background: selectedSubjects.length > 0 ? 'linear-gradient(135deg, #0D9488, #0F766E)' : '#CBD5E1',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            padding: '12px 28px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: selectedSubjects.length > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: selectedSubjects.length > 0 ? '0 4px 14px rgba(13,148,136,0.3)' : 'none',
          }}
        >
          Configure Exam Halls ({totalCandidates} Seats) <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
