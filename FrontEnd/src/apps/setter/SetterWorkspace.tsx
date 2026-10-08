import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  BookOpen,
  PenTool,
  Sparkles,
  ShieldCheck,
  Eye
} from 'lucide-react';

import { SetterAssignment, QuestionPaperDraft, QuestionItem } from './types';
import { INITIAL_ASSIGNMENTS, INITIAL_DRAFTS } from './mockData';
import { api } from '@/services/api';
import { useEffect } from 'react';
import { AssignmentsTab } from './features/assignments/AssignmentsTab';
import { AuthoringTab } from './features/authoring/AuthoringTab';
import { AICopilotTab } from './features/aiCopilot/AICopilotTab';
import { SubmissionsTab } from './features/submissions/SubmissionsTab';
import { OfficialPaperPreview } from './features/preview/OfficialPaperPreview';

type SetterTab = 'ASSIGNMENTS' | 'AUTHORING' | 'AI_COPILOT' | 'SUBMISSIONS' | 'PREVIEW';

export default function SetterWorkspace() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  // State
  const [activeTab, setActiveTab] = useState<SetterTab>('ASSIGNMENTS');
  const [assignments, setAssignments] = useState<SetterAssignment[]>([]);
  const [drafts, setDrafts] = useState<QuestionPaperDraft[]>([]);
  const [activeSubjectCode, setActiveSubjectCode] = useState<string>('');

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await api.get('/vault/question-papers/');
        const realPapers = res.data.results || res.data;
        if (realPapers && realPapers.length > 0) {
          const mappedAssignments: SetterAssignment[] = realPapers.map((p: any) => ({
            id: p.id,
            subjectCode: p.subject_code,
            subjectTitle: p.title,
            examDate: '2026-09-18', // Placeholder from DB slot
            sessionTime: '09:00 AM - 12:00 PM',
            setsRequired: 3,
            setsSubmitted: p.status === 'SIGNED_AND_VAULTED' ? 1 : 0,
            deadline: '2026-09-01T23:59:00Z',
            status: p.status === 'DRAFT' ? 'PENDING' : p.status,
            department: 'Computer Science',
            durationMinutes: p.duration_mins || 180,
            honorariumAmount: '4,500',
            guidelinesAcknowledged: true,
            syllabusModules: []
          }));
          
          const mappedDrafts: QuestionPaperDraft[] = realPapers.map((p: any, index: number) => ({
              id: p.id,
              assignmentId: p.id,
              subjectCode: p.subject_code,
              subjectTitle: p.title ? p.title.replace(' Official Paper', '') : 'Unknown Subject',
              examSession: p.exam_session_name || 'Fall 2026',
              setLabel: (['Set A', 'Set B', 'Set C', 'Set D'][index % 4]) as any,
              maxMarks: p.total_marks || 100,
              questions: (p.questions || []).map((q: any) => ({
                id: q.id,
                number: q.question_number,
                part: q.part,
                section: q.section,
                text: q.text_content,
                marks: q.marks,
                bloomsLevel: q.bloom_level === 'REMEMBER' ? 'Remember' :
                             q.bloom_level === 'UNDERSTAND' ? 'Understand' :
                             q.bloom_level === 'APPLY' ? 'Apply' :
                             q.bloom_level === 'ANALYZE' ? 'Analyze' :
                             q.bloom_level === 'EVALUATE' ? 'Evaluate' : 'Create',
                coMapping: q.co_tag || 'CO1',
                module: 1, // Add to DB later
                hasOrChoice: q.is_optional || false
              })),
              totalMarks: p.total_marks || 100,
              status: 'DRAFT',
              lastSavedAt: p.updated_at,
              semester: '5th Semester',
              durationMinutes: p.duration_mins || 180,
              aiQualityScore: 94,
              similarityScore: 2.4
            }));
          
          setAssignments(mappedAssignments);
          setDrafts(mappedDrafts);
          setActiveSubjectCode(mappedAssignments[0].subjectCode);
        }
      } catch (e) {
        console.error("Failed to load real assignments", e);
      }
    };
    fetchAssignments();
  }, []);

  // Active Assignment & Active Draft
  const activeAssignment = assignments.find(a => a.subjectCode === activeSubjectCode) || assignments[0] || { subjectTitle: 'Loading...' };
  const activeDraft = drafts.find(d => d.subjectCode === activeSubjectCode) || drafts[0];

  // Handler: Update Draft
  const handleUpdateDraft = (updatedDraft: QuestionPaperDraft) => {
    setDrafts(prev => {
      const idx = prev.findIndex(d => d.id === updatedDraft.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updatedDraft;
        return next;
      }
      return [...prev, updatedDraft];
    });

    // SYNC to backend API immediately
    if (updatedDraft.assignmentId && String(updatedDraft.assignmentId).length > 2) {
      if (updatedDraft.status === 'SIGNED_AND_VAULTED') {
        api.post(`/vault/question-papers/${updatedDraft.assignmentId}/lock_and_submit/`, {
          signature_pin: '7782-9910',
          key_unlock_timestamp: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }).then(res => {
          console.log("Paper successfully locked and submitted to CoE", res.data);
        }).catch(err => {
          console.error("Failed to lock paper", err);
        });
      } else {
        api.post(`/vault/question-papers/${updatedDraft.assignmentId}/sync_questions/`, {
          questions: updatedDraft.questions
        }).then(res => {
          console.log("Draft saved successfully to backend", res.data);
        }).catch(err => {
          console.error("Failed to sync draft to backend", err);
        });
      }
    }

    // Update assignment submission count if signed
    if (updatedDraft.status === 'SIGNED_AND_VAULTED') {
      setAssignments(prev =>
        prev.map(a =>
          a.subjectCode === updatedDraft.subjectCode
            ? { ...a, setsSubmitted: Math.min(a.setsRequired, a.setsSubmitted + 1) }
            : a
        )
      );
    }
  };

  // Handler: Add Question directly from AI
  const handleAddQuestionFromAI = (newQ: QuestionItem) => {
    if (!activeDraft) return;
    const updatedDraft: QuestionPaperDraft = {
      ...activeDraft,
      questions: [...activeDraft.questions, newQ],
      totalMarks: activeDraft.questions.reduce((s, q) => s + q.marks, 0) + newQ.marks,
      lastSavedAt: 'Just now',
    };
    handleUpdateDraft(updatedDraft);
  };

  // Switch to studio for specific subject
  const handleOpenStudio = (subjectCode: string) => {
    setActiveSubjectCode(subjectCode);
    setActiveTab('AUTHORING');
  };

  const sidebarItems = [
    { id: 'ASSIGNMENTS', label: 'My Appointments', icon: <BookOpen size={20} /> },
    { id: 'AUTHORING', label: 'Authoring Studio', icon: <PenTool size={20} /> },
    { id: 'AI_COPILOT', label: 'NexAI Copilot', icon: <Sparkles size={20} /> },
    { id: 'SUBMISSIONS', label: 'Vault Sealing', icon: <ShieldCheck size={20} /> },
    { id: 'PREVIEW', label: 'Official Sheet', icon: <Eye size={20} /> },
  ];

  const headerConfig: Record<SetterTab, { title: string; subtitle: string; icon: React.ReactNode; accentColor: string }> = {
    ASSIGNMENTS: {
      title: 'Question Paper Setter Appointments',
      subtitle: 'Manage your assigned subjects, examination blueprints, and submission schedules.',
      icon: <BookOpen size={26} />,
      accentColor: '#3b82f6',
    },
    AUTHORING: {
      title: `Question Paper Studio — ${activeSubjectCode}`,
      subtitle: `Drafting parallel sets for ${activeAssignment.subjectTitle}. Tally marks and attach scheme of evaluation.`,
      icon: <PenTool size={26} />,
      accentColor: '#48977f',
    },
    AI_COPILOT: {
      title: 'NexAI Copilot Quality Assurance',
      subtitle: 'Real-time Bloom’s cognitive distribution analysis, plagiarism detection, and AI variant synthesis.',
      icon: <Sparkles size={26} />,
      accentColor: '#8b5cf6',
    },
    SUBMISSIONS: {
      title: 'Zero-Trust Vault Sealing & Digital Signing',
      subtitle: 'Execute Post-Quantum Dilithium3 digital signature and client-side encryption into CoE IPFS vault.',
      icon: <ShieldCheck size={26} />,
      accentColor: '#10b981',
    },
    PREVIEW: {
      title: 'Official Examination Paper Preview',
      subtitle: 'Proofread the generated question paper in official autonomous university format.',
      icon: <Eye size={26} />,
      accentColor: '#48977f',
    },
  };

  const currentHeader = headerConfig[activeTab];

  return (
    <MainLayout
      userName={user?.full_name || 'Dr. Alan Turing'}
      userRole="Question Paper Setter"
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={id => setActiveTab(id as SetterTab)}
      onLogout={logout}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* ── Large Decorative Vector (Bottom-Right) ── */}
        <svg
          viewBox="0 0 340 340"
          width="420"
          height="420"
          style={{
            position: 'fixed',
            right: -50,
            bottom: -60,
            pointerEvents: 'none',
            opacity: 0.08,
            zIndex: 0,
          }}
        >
          {/* Cyber Pen / Quill & Shield */}
          <path d="M170,20 C240,20 300,50 300,140 C300,240 170,310 170,310 C170,310 40,240 40,140 C40,50 100,20 170,20 Z" fill="#48977f" />
          <polygon points="170,50 210,130 170,260 130,130" fill="white" opacity="0.8" />
          <circle cx="170" cy="130" r="16" fill="#48977f" />
          <circle cx="170" cy="130" r="45" fill="none" stroke="white" strokeWidth="3" opacity="0.6" />
          <circle cx="280" cy="70" r="6" fill="#48977f" opacity="0.4" />
          <circle cx="60" cy="220" r="5" fill="#48977f" opacity="0.35" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Page Header */}
          <PageHeader
            title={currentHeader.title}
            subtitle={currentHeader.subtitle}
            icon={currentHeader.icon}
            accentColor={currentHeader.accentColor}
            action={
              activeTab === 'AUTHORING' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setActiveTab('AI_COPILOT')}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Sparkles size={14} /> AI Quality Audit
                  </button>

                  <button
                    onClick={() => setActiveTab('PREVIEW')}
                    style={{
                      background: 'white',
                      border: 'none',
                      color: '#48977f',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  >
                    <Eye size={14} /> View Sheet
                  </button>
                </div>
              ) : activeTab === 'PREVIEW' ? (
                <button
                  onClick={() => setActiveTab('AUTHORING')}
                  style={{
                    background: 'white',
                    border: 'none',
                    color: '#48977f',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  ← Back to Studio
                </button>
              ) : undefined
            }
          />

          {/* Active Subject Selector Chip Bar when not in Appointments */}
          {activeTab !== 'ASSIGNMENTS' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'white',
              padding: '12px 20px',
              borderRadius: '12px',
              border: '1.5px solid var(--color-border)',
              marginBottom: '22px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                  Active Subject Course:
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {assignments.map(asg => {
                    const isSelected = asg.subjectCode === activeSubjectCode;
                    return (
                      <button
                        key={asg.id}
                        onClick={() => setActiveSubjectCode(asg.subjectCode)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: isSelected ? 'var(--color-primary-light)' : 'transparent',
                          color: isSelected ? 'var(--color-primary)' : 'var(--color-text-primary)',
                          fontWeight: isSelected ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {asg.subjectCode} — {asg.subjectTitle}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                Target: <strong>{activeAssignment.maxMarks} Marks</strong> • Due: <strong>{activeAssignment.deadline}</strong>
              </div>
            </div>
          )}

          {/* ── Tab Views ── */}
          {activeTab === 'ASSIGNMENTS' && (
            <AssignmentsTab
              assignments={assignments}
              onOpenStudio={handleOpenStudio}
            />
          )}

          {activeTab === 'AUTHORING' && (
            <AuthoringTab
              drafts={drafts}
              activeSubjectCode={activeSubjectCode}
              onUpdateDraft={handleUpdateDraft}
              onNavigateToAI={() => setActiveTab('AI_COPILOT')}
              onNavigateToPreview={() => setActiveTab('PREVIEW')}
              onNavigateToSubmit={() => setActiveTab('SUBMISSIONS')}
            />
          )}

          {activeTab === 'AI_COPILOT' && activeDraft && (
            <AICopilotTab
              draft={activeDraft}
              assignment={activeAssignment}
              onAddQuestionToDraft={handleAddQuestionFromAI}
              onNavigateToAuthoring={() => setActiveTab('AUTHORING')}
              onNavigateToSubmit={() => setActiveTab('SUBMISSIONS')}
            />
          )}

          {activeTab === 'SUBMISSIONS' && activeDraft && (
            <SubmissionsTab
              drafts={drafts.filter(d => d.subjectCode === activeSubjectCode)}
              assignment={activeAssignment}
              onUpdateDraft={handleUpdateDraft}
              onNavigateToAuthoring={() => setActiveTab('AUTHORING')}
            />
          )}

          {activeTab === 'PREVIEW' && activeDraft && (
            <OfficialPaperPreview
              draft={activeDraft}
              onBack={() => setActiveTab('AUTHORING')}
              onProceedToSign={() => setActiveTab('SUBMISSIONS')}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
