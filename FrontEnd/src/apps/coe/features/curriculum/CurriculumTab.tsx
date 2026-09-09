import React, { useState } from 'react';
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

import { SubjectList } from './components/SubjectList';
import { SubjectEnrolment } from './components/SubjectEnrolment';

export const CurriculumTab: React.FC = () => {
  const [viewState, setViewState] = useState<'LIST' | 'VIEW_STUDENTS' | 'VIEW_COPO'>('LIST');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSubjectCode, setSelectedSubjectCode] = useState('');
  const [selectedSubjectTitle, setSelectedSubjectTitle] = useState('');

  const handleViewStudents = (id: string, code: string, title: string) => {
    setSelectedSubjectId(id);
    setSelectedSubjectCode(code);
    setSelectedSubjectTitle(title);
    setViewState('VIEW_STUDENTS');
  };

  const handleCancel = () => setViewState('LIST');

  const headerConfig = {
    LIST: {
      title: 'Academic Curriculum & CO-PO Audit Gateway',
      subtitle: 'Audit department-designed courses, syllabus modules, OBE matrices, and student exam eligibility.',
      action: (
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '0.78rem',
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <ShieldCheck size={16} /> Course Creation Delegated to HOD
        </div>
      )
    },
    VIEW_STUDENTS: {
      title: `${selectedSubjectCode} — Exam Eligibility & Enrolment`,
      subtitle: `Audit attendance cutoff (≥75%) and CIE eligibility for ${selectedSubjectTitle}`,
      action: (
        <button onClick={handleCancel} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back
        </button>
      )
    },
    VIEW_COPO: {
      title: `${selectedSubjectCode} — CO-PO Mapping Audit`,
      subtitle: `Program Outcomes correlation audit for ${selectedSubjectTitle}`,
      action: (
        <button onClick={handleCancel} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 16px', borderRadius: '8px', fontWeight: 500 }}>
          <ArrowLeft size={16} /> Back
        </button>
      )
    }
  };

  const cfg = headerConfig[viewState];

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>

      {/* ── Large decorative vector: Open Book ── */}
      <svg
        viewBox="0 0 320 320"
        width="420" height="420"
        style={{
          position: 'fixed',
          right: -60,
          bottom: -60,
          pointerEvents: 'none',
          opacity: 0.1,
          zIndex: 0,
        }}
      >
        {/* Left page */}
        <path d="M160,40 C130,50 60,60 20,70 L20,280 C60,268 130,260 160,270 Z" fill="#48977f" />
        {/* Left page lines */}
        <line x1="40"  y1="100" x2="148" y2="90"  stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="40"  y1="120" x2="148" y2="112" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="40"  y1="140" x2="148" y2="133" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="40"  y1="160" x2="148" y2="154" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="40"  y1="180" x2="148" y2="175" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
        <line x1="40"  y1="200" x2="120" y2="196" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
        {/* Right page */}
        <path d="M160,40 C190,50 260,60 300,70 L300,280 C260,268 190,260 160,270 Z" fill="#48977f" />
        {/* Right page lines */}
        <line x1="172" y1="90"  x2="280" y2="100" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="172" y1="112" x2="280" y2="120" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="172" y1="133" x2="280" y2="140" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="172" y1="154" x2="280" y2="160" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.6"/>
        <line x1="172" y1="175" x2="280" y2="180" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
        <line x1="172" y1="196" x2="250" y2="200" stroke="white" strokeWidth="4" strokeLinecap="round" opacity="0.4"/>
        {/* Spine */}
        <line x1="160" y1="40" x2="160" y2="270" stroke="#2f7a62" strokeWidth="6" strokeLinecap="round" />
        {/* Bottom curve */}
        <path d="M20,280 Q160,300 300,280" fill="none" stroke="#48977f" strokeWidth="8" strokeLinecap="round"/>
        {/* Floating sparkles */}
        <circle cx="80"  cy="50"  r="6" fill="#48977f" opacity="0.5"/>
        <circle cx="240" cy="44"  r="4" fill="#48977f" opacity="0.4"/>
        <circle cx="290" cy="80"  r="5" fill="#48977f" opacity="0.35"/>
        <circle cx="30"  cy="240" r="5" fill="#48977f" opacity="0.35"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <PageHeader
          title={cfg.title}
          subtitle={cfg.subtitle}
          icon={<BookOpen size={26} />}
          accentColor="#48977f"
          action={cfg.action}
        />

        {viewState === 'LIST' && <SubjectList onViewStudents={handleViewStudents} />}
        {viewState === 'VIEW_STUDENTS' && <SubjectEnrolment subjectId={selectedSubjectId} subjectCode={selectedSubjectCode} subjectTitle={selectedSubjectTitle} />}
      </div>
    </div>
  );
};
