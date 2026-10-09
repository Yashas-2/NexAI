import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  BookOpen,
  Users,
  FileCheck,
  KeyRound,
  PenTool,
  Save,
  Plus
} from 'lucide-react';
import {
  INITIAL_ASSIGNED_COURSES,
  INITIAL_STUDENT_ROSTER,
  INITIAL_CIE_SCANNED_SCRIPTS,
} from './mockData';
import {
  AssignedCourse,
  StudentGradeRecord,
  FacultyCIEPaper,
  CIEScannedScript,
} from './types';
import toast from 'react-hot-toast';

// Feature Tabs & Modals (Folder structure identical to HOD)
import { AssignedCoursesTab } from './features/courses/AssignedCoursesTab';
import { StudentRosterMarksTab } from './features/students/StudentRosterMarksTab';
import { CIEQuestionPapersTab } from './features/cieQuestionPapers/CIEQuestionPapersTab';
import { CreateCIEPaperModal } from './features/cieQuestionPapers/components/CreateCIEPaperModal';
import { CIEEvaluationTab } from './features/cieEvaluation/CIEEvaluationTab';
import { SEESubmissionsTab } from './features/seeValuation/SEESubmissionsTab';
import { HODPaperAuditBanner } from './components/HODPaperAuditBanner';
import { FacultyVectorBackground } from './components/FacultyVectorBackground';

type FacultyTab = 'COURSES' | 'STUDENTS' | 'CIE_PAPERS' | 'CIE_EVALUATION' | 'SEE_VALUATION';

export default function FacultyDashboard() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  // Tab & Dataset State
  const [activeTab, setActiveTab] = useState<FacultyTab>('COURSES');
  const [courses, setCourses] = useState<AssignedCourse[]>(INITIAL_ASSIGNED_COURSES);
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>('CS201');
  const [students, setStudents] = useState<StudentGradeRecord[]>(INITIAL_STUDENT_ROSTER);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // CIE Scanned Answer Scripts for Correction Studio
  const [scannedScripts, setScannedScripts] = useState<CIEScannedScript[]>(INITIAL_CIE_SCANNED_SCRIPTS);

  // CIE Question Papers with localStorage sync across HOD and Faculty portals
  const [ciePapers, setCIEPapers] = useState<FacultyCIEPaper[]>(() => {
    try {
      const saved = localStorage.getItem('nexai_cie_papers_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveCIEPapers = (papers: FacultyCIEPaper[]) => {
    setCIEPapers(papers);
    try {
      localStorage.setItem('nexai_cie_papers_v2', JSON.stringify(papers));
      window.dispatchEvent(new Event('nexai_cie_papers_v2_updated'));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('nexai_cie_papers_v2');
        if (saved) setCIEPapers(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('nexai_cie_papers_v2_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('nexai_cie_papers_v2_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Cleanup: remove localStorage drafts whose CIE config was deleted from backend
  // Runs on mount, on tab focus, and every 30s to catch mid-session deletions
  useEffect(() => {
    const cleanupStaleDrafts = async () => {
      try {
        const saved = localStorage.getItem('nexai_cie_papers_v2');
        if (!saved) return;
        const papers: FacultyCIEPaper[] = JSON.parse(saved);
        if (papers.length === 0) return;

        const subjectRes = await api.get('/scheduling/subjects/');
        const subjects = subjectRes.data.results || subjectRes.data;

        const configRes = await api.get('/cie/configs/');
        const configs = configRes.data.results || configRes.data;

        const cieNumMap: Record<string, string> = { 'CIE-1': 'CIE_1', 'CIE-2': 'CIE_2', 'CIE-3': 'CIE_3' };
        const validCombos = new Set(
          (Array.isArray(configs) ? configs : []).map((c: any) => {
            const subj = (Array.isArray(subjects) ? subjects : []).find((s: any) => s.id === c.subject);
            return `${subj?.code}+${cieNumMap[c.cie_number] || c.cie_number}`;
          })
        );

        const clean = papers.filter(p => validCombos.has(`${p.courseCode}+${p.testType}`));

        if (clean.length !== papers.length) {
          localStorage.setItem('nexai_cie_papers_v2', JSON.stringify(clean));
          setCIEPapers(clean);
        }
      } catch (e) {
        // If API fails, keep existing drafts
      }
    };

    // Run on mount
    cleanupStaleDrafts();

    // Run when tab becomes visible (user switches back)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') cleanupStaleDrafts();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Run every 30s as safety net
    const interval = setInterval(cleanupStaleDrafts, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const fetchAssignedCourses = async () => {
      try {
        const response = await api.get('/scheduling/subjects/');
        const subjects = response.data;
        // The API might return pagination or an array directly
        const results = Array.isArray(subjects) ? subjects : (subjects.results || []);
        
        // Filter by the logged-in user's ID
        const mySubjects = results.filter((s: any) => s.coordinator === user?.id);
        
        if (mySubjects.length > 0) {
          const assignedCourses: AssignedCourse[] = mySubjects.map((s: any) => ({
            id: s.id,
            code: s.code,
            title: s.name,
            department: s.department_code || 'CS',
            semester: `Semester ${s.semester}`,
            credits: s.credits,
            totalEnrolled: s.enrolled_students || 0,
            avgAttendance: 0,
            syllabusCompletion: 0,
            cie1Status: 'DRAFT',
          }));
          setCourses(assignedCourses);
          setSelectedCourseCode(assignedCourses[0].code);
        } else {
          // If no courses assigned, keep mock data or empty. Let's keep mock for UI dev if empty, or just empty.
          // Wait, user said "not at all random course. i want real course". So empty is fine if none assigned.
          setCourses([]);
        }
      } catch (error) {
        console.error('Failed to fetch assigned courses:', error);
      }
    };
    
    if (user?.id) {
      fetchAssignedCourses();
    }
  }, [user]);
  const [activeExamSessionId, setActiveExamSessionId] = useState<string | null>(null);

  // Fetch students when active course changes
  useEffect(() => {
    const fetchEnrolledStudents = async () => {
      const course = courses.find(c => c.code === selectedCourseCode);
      if (!course || !course.id) return;
      try {
        const response = await api.get(`/scheduling/subjects/${course.id}/enrolled-students/`);
        let enrollmentData: any = response.data;
        let results = Array.isArray(enrollmentData) ? enrollmentData : (enrollmentData.results || []);
        // Follow pagination so students past page 1 are never silently dropped.
        let nextUrl = Array.isArray(enrollmentData) ? null : enrollmentData.next;
        let guard = 0;
        while (nextUrl && guard < 50) {
          guard += 1;
          const page: any = (await api.get(nextUrl)).data;
          results = results.concat(Array.isArray(page) ? page : (page.results || []));
          nextUrl = Array.isArray(page) ? null : page.next;
        }
        
        // Capture the exam_session_id from the first enrollment
        if (results.length > 0 && results[0].exam_session) {
          setActiveExamSessionId(results[0].exam_session);
        }

        if (results.length > 0) {
          const mappedStudents: StudentGradeRecord[] = results.map((enroll: any) => {
            // Show 0 for null/unentered marks, preserve explicit values
            const cie1 = enroll.cie1 !== null && enroll.cie1 !== undefined ? enroll.cie1 : 0;
            const cie2 = enroll.cie2 !== null && enroll.cie2 !== undefined ? enroll.cie2 : 0;
            const cie3 = enroll.cie3 !== null && enroll.cie3 !== undefined ? enroll.cie3 : 0;
            const labOrProject = enroll.labOrProject !== null && enroll.labOrProject !== undefined ? enroll.labOrProject : 0;
          
          const toNum = (v: any) => {
            if (v === '' || v === null || v === undefined) return 0;
            const n = Number(v);
            return isNaN(n) ? 0 : n;
          };

          return {
            id: enroll.id || enroll.student,
            courseCode: course.code,
            usn: enroll.student_usn,
            name: enroll.student_name,
            attendancePercent: enroll.attendance_percentage !== null && enroll.attendance_percentage !== undefined ? enroll.attendance_percentage : '',
            cie1,
            cie2,
            cie3,
            labOrProject,
            totalCIE: toNum(cie1) + toNum(cie2) + toNum(cie3) + toNum(labOrProject),
            isModified: false,
            saveStatus: 'SYNCED' as const,
          };
          });
          
          setStudents(mappedStudents);
        } else {
          setStudents([]); // or leave mock data
        }
      } catch (error) {
        console.error('Failed to fetch enrolled students:', error);
      }
    };
    
    fetchEnrolledStudents();
  }, [selectedCourseCode, courses]);

  // Fetch Submissions when in CIE_EVALUATION tab
  useEffect(() => {
    const fetchSubmissions = async () => {
      const course = courses.find(c => c.code === selectedCourseCode);
      if (!course || !course.id) return;
      try {
        const configResp = await api.get(`/cie/configs/?subject=${course.id}`);
        const configs = Array.isArray(configResp.data) ? configResp.data : configResp.data.results || [];

        if (configs.length > 0) {
          let allScripts: CIEScannedScript[] = [];
          for (const config of configs) {
            const subResp = await api.get(`/cie/test/submissions/?cie_config=${config.id}`);
            const submissions = subResp.data.submissions || [];
            
            const mappedScripts: CIEScannedScript[] = submissions.map((sub: any) => {
              const evaluatorTotal = sub.answers.reduce((acc: number, ans: any) => acc + (ans.marks_awarded || 0), 0);
              const isEvaluated = sub.answers.length > 0 && sub.answers.every((ans: any) => ans.marks_awarded !== null);
              const isNotSubmitted = sub.submission_status === 'NOT_ATTENDED' || sub.submission_status === 'NOT_SUBMITTED';

              let statusText: 'PENDING_VALUATION' | 'EVALUATED' | 'NOT_SUBMITTED' = 'PENDING_VALUATION';
              if (isNotSubmitted) statusText = 'NOT_SUBMITTED';
              else if (isEvaluated) statusText = 'EVALUATED';

              return {
                id: sub.attempt_id,
                studentId: sub.attempt_id,
                studentUSN: sub.student_usn,
                studentName: sub.student_name,
                courseCode: course.code,
                courseTitle: course.title,
                testType: (config.cie_number || 'CIE-1').replace('_', '-'),
                submittedAt: new Date(sub.submitted_at).toLocaleString(),
                totalPages: sub.answers.length,
                status: statusText,
                maxMarks: sub.answers.length * 10, // Tally maximum marks of combined questions
                evaluatorTotalMarks: isEvaluated ? evaluatorTotal : undefined,
                questions: sub.answers.map((ans: any, idx: number) => ({
                  id: ans.answer_id,
                  questionNumber: String(idx + 1),
                  questionText: ans.question_text,
                  answerText: ans.answer_text,
                  answerImageBase64: ans.answer_image_base64,
                  extractedText: ans.extracted_text,
                  maxMarks: 10,
                  bloomsLevel: 'L2',
                  co: 'CO1',
                  awardedMarks: ans.marks_awarded || 0,
                  isEvaluated: ans.marks_awarded !== null,
                })),
                annotations: [],
              };
            });
            allScripts = [...allScripts, ...mappedScripts];
          }
          setScannedScripts(allScripts);
        } else {
          setScannedScripts([]);
        }
      } catch (error) {
        console.error('Failed to fetch submissions:', error);
      }
    };
    
    if (activeTab === 'CIE_EVALUATION') {
      fetchSubmissions();
    }
  }, [selectedCourseCode, courses, activeTab]);

  // Modal State for CIE Paper Creator
  const [isCreatePaperOpen, setIsCreatePaperOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<FacultyCIEPaper | null>(null);

  const handleOpenCreatePaper = () => {
    setEditingPaper(null);
    setIsCreatePaperOpen(true);
  };

  const handleEditRejectedPaper = (paperId: string) => {
    const target = ciePapers.find(p => p.id === paperId);
    if (!target) return;
    setEditingPaper(target);
    setIsCreatePaperOpen(true);
  };

  // Handlers for Student Marks & Attendance
  const handleStudentFieldChange = (
    id: string,
    field: 'attendancePercent' | 'cie1' | 'cie2' | 'cie3' | 'labOrProject',
    value: number | string
  ) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id === id) {
          const updated = { ...s, [field]: value, isModified: true, saveStatus: 'UNSAVED' as const };

          // Total = sum of non-empty numeric values (null/empty = 0 for display only)
          const toNum = (v: number | string) => {
            if (v === '' || v === null || v === undefined) return 0;
            const n = Number(v);
            return isNaN(n) ? 0 : n;
          };
          updated.totalCIE = toNum(updated.cie1) + toNum(updated.cie2) + toNum(updated.cie3) + toNum(updated.labOrProject);
          return updated;
        }
        return s;
      })
    );
  };

  // Removed Daily Attendance Logic

  // Handler: Submit Paper Draft to HOD via API
  const handleSubmitDraftToHOD = async (paper: FacultyCIEPaper) => {
    try {
      const cieNumMap: Record<string, string> = { 'CIE-1': 'CIE_1', 'CIE-2': 'CIE_2', 'CIE-3': 'CIE_3' };
      const cieNumber = cieNumMap[paper.testType] || 'CIE_1';

      // Find subject from already-loaded courses
      const courseObj = courses.find(c => c.code === paper.courseCode);
      if (!courseObj?.id) {
        toast.error('Subject not found.');
        return;
      }

      // Find active CIE config for this subject + CIE number
      const configRes = await api.get('/cie/configs/', { params: { subject: courseObj.id, cie_number: cieNumber } });
      const configs = configRes.data.results || configRes.data;
      const config = Array.isArray(configs) ? configs[0] : null;
      if (!config) {
        toast.error(`No CIE configuration found for ${paper.courseCode} ${paper.testType}. Ask HOD to create one first.`);
        return;
      }

      const paperContent = paper.questions.map(q =>
        `${q.qNumber}) [${q.marks}M] [${q.co}] [${q.bloomsLevel}]\n${q.text}`
      ).join('\n\n');
      const answerKey = paper.questions.map(q =>
        `${q.qNumber}) ${q.answer}`
      ).join('\n\n');

      await api.post('/cie/scrutiny/', {
        cie_config: config.id,
        paper_title: `${paper.courseCode} - ${paper.testType} Question Paper`,
        paper_content: paperContent,
        answer_key: answerKey,
      });

      saveCIEPapers([{ ...paper, status: 'SUBMITTED_TO_HOD' }, ...ciePapers]);
      setIsCreatePaperOpen(false);
      setEditingPaper(null);
      toast.success('CIE Paper submitted to HOD successfully');
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Failed to submit paper';
      toast.error(msg);
    }
  };

  const handleDeleteCIEPaper = (paperId: string) => {
    saveCIEPapers(ciePapers.filter(p => p.id !== paperId));
    toast.success('Draft paper deleted successfully');
  };

  // Handler: Script Evaluation Complete (Automatically syncs to Student Roster!)
  const handleScriptEvaluationComplete = (
    awardedTotal: number,
    studentUSN: string,
    testType: 'CIE-1' | 'CIE-2',
    maxMarks: number
  ) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.usn === studentUSN) {
          const field = testType === 'CIE-1' ? 'cie1' : 'cie2';
          
          // Auto scale the awarded marks to out of 10
          const scaledScore = Math.ceil((awardedTotal / (maxMarks || 20)) * 10);
          const updated = { ...s, [field]: scaledScore, isModified: true, saveStatus: 'UNSAVED' as const };
          
          const toNum = (v: number | string) => {
            if (v === '' || v === null || v === undefined) return 0;
            const n = Number(v);
            return isNaN(n) ? 0 : n;
          };
          updated.totalCIE = toNum(updated.cie1) + toNum(updated.cie2) + toNum(updated.cie3) + toNum(updated.labOrProject);
          return updated;
        }
        return s;
      })
    );
  };

  const handleUpdateScript = (updatedScript: CIEScannedScript) => {
    setScannedScripts(prev => prev.map(s => (s.id === updatedScript.id ? updatedScript : s)));
  };

  const handleSaveMarksToHOD = async () => {
    if (saving) return;
    setSaving(true);

    // Mark all students as SAVING
    setStudents(prev => prev.map(s => s.isModified ? { ...s, saveStatus: 'SAVING' as const } : s));

    try {
      await api.post('/eligibility/sync-marks/', {
        subject_code: selectedCourseCode,
        exam_session_id: activeExamSessionId,
        students: students
      });
      // On success: mark all as SYNCED
      setStudents(prev => prev.map(s => ({ ...s, isModified: false, saveStatus: 'SYNCED' as const })));
      toast.success(`Marks & Attendance for ${selectedCourseCode} synchronized and submitted to HOD!`);
    } catch (err) {
      // On failure: mark unsaved ones as FAILED
      setStudents(prev => prev.map(s => s.saveStatus === 'SAVING' ? { ...s, saveStatus: 'FAILED' as const } : s));
      toast.error('Failed to sync marks to HOD');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const belowAttendanceCount = students.filter(
    s => s.courseCode === selectedCourseCode && s.attendancePercent !== '' && s.attendancePercent !== null && s.attendancePercent !== undefined && Number(s.attendancePercent) < 85
  ).length;

  const pendingScriptsCount = scannedScripts.filter(
    s => s.courseCode === selectedCourseCode && s.status === 'PENDING_VALUATION'
  ).length;

  const sidebarItems = [
    {
      id: 'COURSES',
      label: 'My Assigned Courses',
      icon: <BookOpen size={20} />,
      badge: (
        <span style={{
          background: 'rgba(255,255,255,0.18)',
          color: 'white',
          padding: '1px 7px',
          borderRadius: '10px',
          fontSize: '0.72rem',
          fontWeight: 800
        }}>
          {courses.length}
        </span>
      )
    },
    {
      id: 'STUDENTS',
      label: 'Attendance & CIE Marks',
      icon: <Users size={20} />,
      badge: belowAttendanceCount > 0 ? (
        <span style={{
          background: '#F59E0B',
          color: 'white',
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '0.68rem',
          fontWeight: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          ⚠️ {belowAttendanceCount}
        </span>
      ) : undefined
    },
    {
      id: 'CIE_PAPERS',
      label: 'CIE Question Papers',
      icon: <FileCheck size={20} />,
      badge: ciePapers.filter(p => p.status === 'REVISION_REQUESTED').length > 0 ? (
        <span style={{
          background: '#EF4444',
          color: 'white',
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '0.68rem',
          fontWeight: 900,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px'
        }}>
          REVISION
        </span>
      ) : undefined
    },
    {
      id: 'CIE_EVALUATION',
      label: 'CIE Script Evaluation',
      icon: <PenTool size={20} />,
      badge: pendingScriptsCount > 0 ? (
        <span style={{
          background: '#3B82F6',
          color: 'white',
          padding: '1px 7px',
          borderRadius: '10px',
          fontSize: '0.68rem',
          fontWeight: 800
        }}>
          {pendingScriptsCount} Pending
        </span>
      ) : undefined
    },
    {
      id: 'SEE_VALUATION',
      label: 'SEE Valuation Studio',
      icon: <KeyRound size={20} />,
      badge: (
        <span style={{
          background: '#059669',
          color: 'white',
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '0.68rem',
          fontWeight: 800
        }}>
          LIVE
        </span>
      )
    },
  ];

  const headerConfig: Record<FacultyTab, { title: string; subtitle: string; icon: React.ReactNode; accentColor: string; action?: React.ReactNode }> = {
    COURSES: {
      title: 'Assigned Courses & Teaching Allocations',
      subtitle: 'Department of Computer Science & Engineering • Fall Semester 2026 Course In-Charge Desk.',
      icon: <BookOpen size={26} />,
      accentColor: '#4F46E5',
    },
    STUDENTS: {
      title: 'Student Attendance & Continuous Internal Evaluation (CIE) Marks',
      subtitle: 'Record daily lecture attendance with 1-click absent toggles, and submit continuous evaluation test marks for HOD clearance.',
      icon: <Users size={26} />,
      accentColor: '#16A34A',
      action: (
        <button
          onClick={handleSaveMarksToHOD}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: saving ? '#94A3B8' : 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 4px 12px rgba(22,163,74,0.3)',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Saving...
            </>
          ) : (
            <>
              <Save size={16} /> Save & Submit Marks to HOD
            </>
          )}
        </button>
      )
    },
    CIE_PAPERS: {
      title: 'Continuous Internal Evaluation (CIE) Question Paper Creator',
      subtitle: 'Draft question papers mapped to Bloom taxonomy and Course Outcomes, inspect HOD audit remarks, and resubmit.',
      icon: <FileCheck size={26} />,
      accentColor: '#8B5CF6',
      action: (
        <button
          onClick={() => setIsCreatePaperOpen(true)}
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
      )
    },
    CIE_EVALUATION: {
      title: 'CIE Digital Answer Script Valuation Studio',
      subtitle: 'Digitally correct student CIE test papers with interactive pen stamps, step rubrics, and automated gradebook sync.',
      icon: <PenTool size={26} />,
      accentColor: '#2563EB',
    },
    SEE_VALUATION: {
      title: 'SEE Valuation — Submissions & Distribution',
      subtitle: 'View submitted digital SEE answer scripts (handwriting + OCR), award marks, and distribute valuation to evaluators.',
      icon: <KeyRound size={26} />,
      accentColor: '#059669',
    },
  };

  const currentHeader = headerConfig[activeTab];
  const displayName = user?.full_name || 'Prof. Alan Turing';

  return (
    <MainLayout
      userName={displayName}
      userRole="Assistant Professor (CSE)"
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={id => setActiveTab(id as FacultyTab)}
      onLogout={logout}
    >
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <FacultyVectorBackground />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <PageHeader
            title={currentHeader.title}
            subtitle={currentHeader.subtitle}
            icon={currentHeader.icon}
            accentColor={currentHeader.accentColor}
            action={currentHeader.action}
          />

          {/* ── High-Priority HOD Paper Setting Notification Banner ── */}
          <HODPaperAuditBanner
            ciePapers={ciePapers}
            onReviewClick={() => setActiveTab('CIE_PAPERS')}
          />

          {/* ══════════════ TAB 1: ASSIGNED COURSES ══════════════ */}
          {activeTab === 'COURSES' && (
            <AssignedCoursesTab
              courses={courses}
              onSelectCourseForStudents={code => {
                setSelectedCourseCode(code);
                setActiveTab('STUDENTS');
              }}
              onSelectCourseForCIE={code => {
                setSelectedCourseCode(code);
                setActiveTab('CIE_PAPERS');
              }}
            />
          )}

          {/* ══════════════ TAB 2: ATTENDANCE & CIE MARKS ══════════════ */}
          {activeTab === 'STUDENTS' && (
            <StudentRosterMarksTab
              courses={courses}
              selectedCourseCode={selectedCourseCode}
              onSelectCourseCode={setSelectedCourseCode}
              students={students}
              setStudents={setStudents}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onStudentFieldChange={handleStudentFieldChange}
              onSaveMarksToHOD={handleSaveMarksToHOD}
            />
          )}

          {/* ══════════════ TAB 3: CIE QUESTION PAPERS ══════════════ */}
          {activeTab === 'CIE_PAPERS' && (
            <CIEQuestionPapersTab
              courses={courses}
              selectedCourseCode={selectedCourseCode}
              onSelectCourseCode={setSelectedCourseCode}
              ciePapers={ciePapers.filter(p => p.courseCode === selectedCourseCode)}
              onOpenCreatePaperModal={handleOpenCreatePaper}
              onResubmitForReaudit={handleEditRejectedPaper}
              onDeletePaper={handleDeleteCIEPaper}
            />
          )}

          {/* ══════════════ TAB 4: CIE ANSWER SCRIPT EVALUATION ══════════════ */}
          {activeTab === 'CIE_EVALUATION' && (
            <CIEEvaluationTab
              courses={courses}
              selectedCourseCode={selectedCourseCode}
              onSelectCourseCode={setSelectedCourseCode}
              scripts={scannedScripts}
              onUpdateScript={handleUpdateScript}
              onValuationComplete={handleScriptEvaluationComplete}
            />
          )}

          {/* ══════════════ TAB 5: SEE VALUATION (submissions & distribution) ══════════════ */}
          {activeTab === 'SEE_VALUATION' && (
            <SEESubmissionsTab
              courses={courses}
              selectedCourseCode={selectedCourseCode}
              onSelectCourseCode={setSelectedCourseCode}
              examSessionId={activeExamSessionId}
              onRedeemSuccess={({ id, name, subject_code, subject_id, exam_session_name, evaluator_name, access_code, exam_session }) => {
                // Redirect to /evaluator with bundle info as query params
                const params = new URLSearchParams({
                  bundleId: id,
                  bundleName: name,
                  subjectCode: subject_code,
                  subjectId: subject_id,
                  examSessionName: exam_session_name,
                  examSessionId: exam_session || '',
                  evaluatorName: evaluator_name || '',
                  accessCode: access_code || '',
                });
                navigate(`/evaluator?${params.toString()}`);
              }}
            />
          )}
        </div>
      </div>

      {/* ── Modal: Draft New CIE Question Paper ── */}
      <CreateCIEPaperModal
        isOpen={isCreatePaperOpen}
        selectedCourseCode={selectedCourseCode}
        courses={courses}
        onClose={() => {
          setIsCreatePaperOpen(false);
          setEditingPaper(null);
        }}
        onSubmitPaper={handleSubmitDraftToHOD}
        initialPaper={editingPaper || undefined}
      />
    </MainLayout>
  );
}
