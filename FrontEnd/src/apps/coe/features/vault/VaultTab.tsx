import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  Dices,
  Lock,
  Unlock,
  Layers
} from 'lucide-react';

import { QuestionPaperSet, VaultSubject, SessionKeyData } from './types';
import { INITIAL_SUBJECTS, INITIAL_PAPERS, MOCK_SESSION_KEYS } from './mockData';
import { SubjectSelector } from './components/SubjectSelector';
import { PaperCard } from './components/PaperCard';
import { SessionKeyModal } from './components/SessionKeyModal';
import { PaperInspectorModal } from './components/PaperInspectorModal';
import { PaperSelectionCeremonyModal } from './components/PaperSelectionCeremonyModal';
import { UnsealedPaperView } from './components/UnsealedPaperView';

export interface VaultTabProps {
  papers?: any[];
  loading?: boolean;
  error?: string;
}

export const VaultTab: React.FC<VaultTabProps> = () => {
  // State
  const [subjects, setSubjects] = useState<VaultSubject[]>([]);
  const [papersList, setPapersList] = useState<QuestionPaperSet[]>([]);
  const [sessionKeys, setSessionKeys] = useState<Record<string, SessionKeyData>>({});
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('');

  useEffect(() => {
    const fetchVaultData = async () => {
      try {
        const res = await api.get('/vault/question-papers/');
        const papers = res.data.results || res.data;
        
        // Group by subject to build VaultSubjects
        const subjectsMap: Record<string, VaultSubject> = {};
        const mappedPapers: QuestionPaperSet[] = [];
        const mappedKeys: Record<string, SessionKeyData> = {};

        papers.forEach((p: any, index: number) => {
          const subCode = p.subject_code;
          if (!subjectsMap[subCode]) {
            subjectsMap[subCode] = {
              code: subCode,
              title: p.title.replace(' Official Paper', ''),
              department: 'General', // Would come from subject API normally
              examDate: p.exam_session_name || '2026-09-18', // Placeholder
              examSlot: '09:00 AM - 12:00 PM',
              setsAvailable: 0,
              requiredSets: 3,
              vaultStatus: 'LOCKED'
            };
          }

          // Map paper
          const isVaulted = ['SUBMITTED', 'APPROVED', 'ENCRYPTED', 'DISTRIBUTED'].includes(p.status);
          if (isVaulted) {
             subjectsMap[subCode].setsAvailable += 1;
          }

          mappedPapers.push({
            id: p.id,
            setLabel: ['Set A', 'Set B', 'Set C', 'Set D'][index % 4] as any,
            title: p.title,
            subjectCode: subCode,
            subjectTitle: subjectsMap[subCode].title,
            examSession: p.exam_session_name || 'Session',
            semester: 'Fall',
            setterName: 'Faculty',
            setterDepartment: 'General',
            status: isVaulted ? 'VAULTED' : 'DRAFT' as any,
            ipfsCid: p.ipfs_cid || 'pending...',
            sha256Hash: 'pending...',
            submittedAt: p.updated_at,
            difficulty: p.difficulty_level || 'Balanced',
            aiQualityScore: 98,
            similarityScore: 0,
            totalMarks: p.total_marks || 100,
            durationMinutes: p.duration_mins || 180,
            questionsCount: p.questions ? p.questions.length : 0,
                        questions: (p.questions || []).map((q: any) => ({
              id: q.id,
              number: q.question_number,
              part: q.part || '',
              section: q.section || 'Part A',
              text: q.text_content,
              marks: q.marks,
              bloomsLevel: q.bloom_level === 'REMEMBER' ? 'Remember' : q.bloom_level === 'UNDERSTAND' ? 'Understand' : q.bloom_level === 'APPLY' ? 'Apply' : q.bloom_level === 'ANALYZE' ? 'Analyze' : q.bloom_level === 'EVALUATE' ? 'Evaluate' : 'Create',
              coMapping: q.co_mapping || 'CO1',
              unitMapping: q.unit_mapping || 'Unit 1'
            })),
            isDecrypted: false
          });

          // Generate dummy session key data for visual parity with DB status
          if (!mappedKeys[subCode] && isVaulted) {
             mappedKeys[subCode] = {
                keyId: `KEY-${subCode}-9999`,
                subjectCode: subCode,
                algorithm: 'AES-256-GCM + CRYSTALS-Dilithium3',
                generatedAt: p.updated_at,
                expiresAt: 'Future',
                unlockTimestamp: p.key_unlock_timestamp || 'Not set',
                thresholdQuorum: { required: 2, total: 3, signed: [] },
                keyFingerprint: 'A1:B2:C3...',
                isUnlocked: false
             };
          }
        });

        const subjectList = Object.values(subjectsMap);
        setSubjects(subjectList);
        setPapersList(mappedPapers);
        setSessionKeys(mappedKeys);
        if (subjectList.length > 0) {
          setSelectedSubjectCode(subjectList[0].code);
        }
      } catch (e) {
        toast.error('Failed to load Vault data');
      }
    };
    fetchVaultData();
  }, []);

  // Modals & Views
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isCeremonyModalOpen, setIsCeremonyModalOpen] = useState(false);
  const [inspectingPaper, setInspectingPaper] = useState<QuestionPaperSet | null>(null);
  const [viewingUnsealedPaper, setViewingUnsealedPaper] = useState<QuestionPaperSet | null>(null);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VAULTED' | 'SELECTED'>('ALL');

  // Active Subject & Key
  const currentSubject = subjects.find(s => s.code === selectedSubjectCode) || subjects[0];
  const currentKey = sessionKeys[selectedSubjectCode];

  // Filtered Papers for the current subject
  const currentSubjectPapers = papersList.filter(p => p.subjectCode === selectedSubjectCode);
  const filteredPapers = currentSubjectPapers.filter(p => {
    if (filterStatus === 'VAULTED') return p.status === 'VAULTED';
    if (filterStatus === 'SELECTED') return p.status === 'SELECTED_ACTIVE';
    return true;
  });

  // Handler: Save Session Key
  const handleSaveKey = (newKey: SessionKeyData) => {
    setSessionKeys(prev => ({ ...prev, [newKey.subjectCode]: newKey }));
    setSubjects(prev =>
      prev.map(s =>
        s.code === newKey.subjectCode && s.vaultStatus === 'LOCKED'
          ? { ...s, vaultStatus: 'KEY_GENERATED' }
          : s
      )
    );
  };

  // Handler: Selection Ceremony Complete
  const handleSelectionComplete = (selectedPaper: QuestionPaperSet) => {
    setIsCeremonyModalOpen(false);

    // Update papers: mark chosen as SELECTED_ACTIVE, others as VAULTED
    setPapersList(prev =>
      prev.map(p => {
        if (p.subjectCode === selectedPaper.subjectCode) {
          if (p.id === selectedPaper.id) {
            return { ...p, status: 'SELECTED_ACTIVE' };
          } else {
            return { ...p, status: 'VAULTED' };
          }
        }
        return p;
      })
    );

    // Update subject status to UNSEALED
    setSubjects(prev =>
      prev.map(s =>
        s.code === selectedPaper.subjectCode
          ? { ...s, vaultStatus: 'UNSEALED', activeSelectedSetId: selectedPaper.id }
          : s
      )
    );

    // Automatically navigate to Unsealed Paper View
    setViewingUnsealedPaper({ ...selectedPaper, status: 'SELECTED_ACTIVE' });
  };

  // Total telemetry counts across all subjects
  const totalPapersCount = papersList.length;
  const totalKeysGenerated = Object.keys(sessionKeys).length;
  const totalUnsealed = subjects.filter(s => s.vaultStatus === 'UNSEALED').length;

  if (viewingUnsealedPaper) {
    return (
      <UnsealedPaperView
        paper={viewingUnsealedPaper}
        onBack={() => setViewingUnsealedPaper(null)}
      />
    );
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── Large Decorative Cyber-Security Vector (Bottom-Right) ── */}
      <svg
        viewBox="0 0 340 340"
        width="420"
        height="420"
        style={{
          position: 'fixed',
          right: -50,
          bottom: -60,
          pointerEvents: 'none',
          opacity: 0.09,
          zIndex: 0,
        }}
      >
        {/* Outer Shield Path */}
        <path d="M170,20 C240,20 300,50 300,140 C300,240 170,310 170,310 C170,310 40,240 40,140 C40,50 100,20 170,20 Z" fill="#48977f" />
        {/* Inner Shield Outline */}
        <path d="M170,45 C225,45 275,70 275,145 C275,225 170,285 170,285 C170,285 65,225 65,145 C65,70 115,45 170,45 Z" fill="none" stroke="white" strokeWidth="6" opacity="0.8" />
        {/* Keyhole / Lock Body */}
        <circle cx="170" cy="140" r="30" fill="white" opacity="0.9" />
        <polygon points="155,150 185,150 195,205 145,205" fill="white" opacity="0.9" />
        {/* Concentric Cipher Rings */}
        <circle cx="170" cy="140" r="70" fill="none" stroke="#2f6852" strokeWidth="3" strokeDasharray="8 6" />
        <circle cx="170" cy="140" r="95" fill="none" stroke="#2f6852" strokeWidth="2" strokeDasharray="14 10" />
        {/* Sparkles / Cryptographic Nodes */}
        <circle cx="90"  cy="80"  r="6" fill="#48977f" opacity="0.5" />
        <circle cx="250" cy="70"  r="5" fill="#48977f" opacity="0.4" />
        <circle cx="310" cy="180" r="6" fill="#48977f" opacity="0.35" />
        <circle cx="30"  cy="190" r="5" fill="#48977f" opacity="0.35" />
      </svg>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Page Header Banner */}
        <PageHeader
          title="Secure Examination Vault"
          subtitle="Cryptographically sealed question paper sets, HSM session key ceremonies, and provably fair selection."
          icon={<ShieldAlert size={26} />}
          accentColor="#48977f"
          action={
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button
                variant="outline-inverse"
                onClick={() => setIsKeyModalOpen(true)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <KeyRound size={16} /> {currentKey ? 'Manage Session Key' : 'Generate Session Key'}
                </span>
              </Button>

              <button
                onClick={() => setIsCeremonyModalOpen(true)}
                style={{
                  background: 'white',
                  color: '#48977f',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                  transition: 'all 0.2s ease',
                }}
              >
                <Dices size={16} /> Unseal Paper Ceremony
              </button>
            </div>
          }
        />

        {/* ── Top Telemetry & Status Cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}>
          {[
            {
              label: 'Total Papers Vaulted',
              value: `${totalPapersCount} Sets`,
              desc: 'Across 4 Active Subjects',
              icon: <Layers size={20} />,
              color: '#48977f',
            },
            {
              label: 'Session Keys Armed',
              value: `${totalKeysGenerated} / ${subjects.length}`,
              desc: 'Shamir Threshold Quorum',
              icon: <KeyRound size={20} />,
              color: '#3b82f6',
            },
            {
              label: 'Active Unsealed Sets',
              value: `${totalUnsealed} Paper`,
              desc: 'Ready for Dispatch/Print',
              icon: <Unlock size={20} />,
              color: '#8b5cf6',
            },
            {
              label: 'Cryptographic Integrity',
              value: '100% Valid',
              desc: 'Post-Quantum Dilithium3',
              icon: <ShieldCheck size={20} />,
              color: '#10b981',
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: '14px',
                border: `1px solid ${stat.color}22`,
                borderTop: `4px solid ${stat.color}`,
                padding: '18px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '10px',
                background: `${stat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: stat.color,
                flexShrink: 0
              }}>
                {stat.icon}
              </div>

              <div>
                <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                  {stat.label}
                </p>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '1.35rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                  {stat.value}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: stat.color, fontWeight: 600 }}>
                  {stat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Subject Vault Switcher ── */}
        <SubjectSelector
          subjects={subjects}
          selectedSubjectCode={selectedSubjectCode}
          onSelectSubject={code => setSelectedSubjectCode(code)}
        />

        {/* ── Active Subject Banner & Key Bar ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '16px',
          padding: '20px 26px',
          marginBottom: '24px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              background: currentKey ? 'rgba(72,151,127,0.25)' : 'rgba(237,114,69,0.25)',
              border: `1.5px solid ${currentKey ? '#48977f' : '#ed7245'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: currentKey ? '#48977f' : '#ed7245',
            }}>
              {currentKey ? <KeyRound size={24} /> : <Lock size={24} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  {currentSubject?.code} — {currentSubject?.title}
                </h3>
                <Badge variant={currentSubject?.vaultStatus === 'UNSEALED' ? 'success' : currentKey ? 'info' : 'warning'}>
                  {currentSubject?.vaultStatus === 'UNSEALED'
                    ? 'UNSEALED & ACTIVE'
                    : currentKey
                    ? 'SESSION KEY ACTIVE'
                    : 'KEY REQUIRED'}
                </Badge>
              </div>

              <div style={{ display: 'flex', gap: '18px', marginTop: '6px', fontSize: '0.78rem', color: '#94a3b8' }}>
                <span>Exam: <strong>{currentSubject?.examDate}</strong> ({currentSubject?.examSlot})</span>
                <span>•</span>
                <span>Cipher: <strong style={{ color: currentKey ? '#38bdf8' : '#f59e0b' }}>{currentKey ? currentKey.algorithm.split(' + ')[0] : 'Not Armed'}</strong></span>
                {currentKey && (
                  <>
                    <span>•</span>
                    <span>Fingerprint: <code style={{ color: '#4ade80' }}>{currentKey.keyFingerprint.substring(0, 14)}...</code></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsKeyModalOpen(true)}
              style={{
                padding: '9px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <KeyRound size={14} /> {currentKey ? 'Key Diagnostics' : 'Generate Key'}
            </button>

            <button
              onClick={() => setIsCeremonyModalOpen(true)}
              style={{
                padding: '9px 20px',
                background: 'linear-gradient(135deg, #48977f 0%, #2f6852 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 14px rgba(72,151,127,0.35)',
              }}
            >
              <Dices size={14} /> Select & Unseal Paper Set
            </button>
          </div>
        </div>

        {/* ── Filter Bar & Candidate Paper Sets ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '1.05rem', fontWeight: 800 }}>
              Submitted Question Paper Sets ({currentSubjectPapers.length} Sets)
            </h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              All submitted question paper sets are encrypted with AES-256 and anchored to IPFS storage.
            </p>
          </div>

          {/* Filter Pills */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            {(['ALL', 'VAULTED', 'SELECTED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filterStatus === f ? 'white' : 'transparent',
                  color: filterStatus === f ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: filterStatus === f ? 700 : 500,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  boxShadow: filterStatus === f ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {f === 'ALL' ? 'All Sets' : f === 'VAULTED' ? 'Vaulted Backup' : 'Active Selected'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Candidate Papers Grid ── */}
        {filteredPapers.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '40px',
            textAlign: 'center',
            border: '1.5px dashed var(--color-border)',
            color: 'var(--color-text-secondary)'
          }}>
            <Lock size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No question paper sets match the selected filter.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '18px',
          }}>
            {filteredPapers.map(paper => (
              <PaperCard
                key={paper.id}
                paper={paper}
                isSelectedForExam={currentSubject?.activeSelectedSetId === paper.id}
                onInspect={p => setInspectingPaper(p)}
                onSelectForExam={p => {
                  setViewingUnsealedPaper(p);
                }}
                onViewUnsealed={p => setViewingUnsealedPaper(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {isKeyModalOpen && (
        <SessionKeyModal
          subjects={subjects}
          selectedSubjectCode={selectedSubjectCode}
          sessionKeys={sessionKeys}
          onSelectSubject={code => setSelectedSubjectCode(code)}
          onSaveKey={handleSaveKey}
          onClose={() => setIsKeyModalOpen(false)}
        />
      )}

      {isCeremonyModalOpen && (
        <PaperSelectionCeremonyModal
          subject={currentSubject}
          papers={currentSubjectPapers}
          onConfirmSelection={handleSelectionComplete}
          onClose={() => setIsCeremonyModalOpen(false)}
        />
      )}

      {inspectingPaper && (
        <PaperInspectorModal
          paper={inspectingPaper}
          onSelectSet={p => handleSelectionComplete(p)}
          onClose={() => setInspectingPaper(null)}
        />
      )}
    </div>
  );
};
