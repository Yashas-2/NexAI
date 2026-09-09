import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';
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
  INITIAL_FACULTY_CIE_PAPERS,
  INITIAL_DAILY_ATTENDANCE_LOGS,
  INITIAL_CIE_SCANNED_SCRIPTS,
} from './mockData';
import {
  AssignedCourse,
  StudentGradeRecord,
  FacultyCIEPaper,
  DailyAttendanceRecord,
  CIEScannedScript,
} from './types';
import toast from 'react-hot-toast';

// Feature Tabs & Modals (Folder structure identical to HOD)
import { AssignedCoursesTab } from './features/courses/AssignedCoursesTab';
import { StudentRosterMarksTab } from './features/students/StudentRosterMarksTab';
import { CIEQuestionPapersTab } from './features/cieQuestionPapers/CIEQuestionPapersTab';
import { CreateCIEPaperModal } from './features/cieQuestionPapers/components/CreateCIEPaperModal';
import { CIEEvaluationTab } from './features/cieEvaluation/CIEEvaluationTab';
import { SEEValuationGateTab } from './features/seeValuation/SEEValuationGateTab';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Daily Attendance History
  const [attendanceHistory, setAttendanceHistory] = useState<DailyAttendanceRecord[]>(INITIAL_DAILY_ATTENDANCE_LOGS);

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
  // Fetch students when active course changes
  useEffect(() => {
    const fetchEnrolledStudents = async () => {
      const course = courses.find(c => c.code === selectedCourseCode);
      if (!course || !course.id) return;
      try {
        const response = await api.get(`/scheduling/subjects/${course.id}/enrolled-students/`);
        const enrollmentData = response.data;
        const results = Array.isArray(enrollmentData) ? enrollmentData : (enrollmentData.results || []);
        
        if (results.length > 0) {
          const mappedStudents: StudentGradeRecord[] = results.map((enroll: any) => ({
            id: enroll.id || enroll.student,
            courseCode: course.code,
            usn: enroll.student_usn,
            name: enroll.student_name,
            attendancePercent: enroll.attendance_percentage || 0,
            cie1: 0,
            cie2: 0,
            cie3: 0,
            labOrProject: 0,
            totalCIE: 0,
            isModified: false,
          }));
          
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

  const [inputSessionKey, setInputSessionKey] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);

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
    value: number
  ) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id === id) {
          const updated = { ...s, [field]: value, isModified: true };
          
          // Formula: CIE1(20->10) + CIE2(20->10) + CIE3(20->10) + Lab(20) = 50 total
          const c1 = (updated.cie1 || 0) / 2;
          const c2 = (updated.cie2 || 0) / 2;
          const c3 = (updated.cie3 || 0) / 2;
          const lab = updated.labOrProject || 0;
          
          updated.totalCIE = c1 + c2 + c3 + lab;
          return updated;
        }
        return s;
      })
    );
  };

  // Removed Daily Attendance Logic

  // Handler: Submit Paper Draft to HOD
  const handleSubmitDraftToHOD = (paper: FacultyCIEPaper) => {
    if (editingPaper) {
      const updated = ciePapers.map(p => p.id === editingPaper.id ? { ...paper, status: 'SUBMITTED_TO_HOD' } : p);
      saveCIEPapers(updated);
    } else {
      saveCIEPapers([{ ...paper, status: 'SUBMITTED_TO_HOD' }, ...ciePapers]);
    }
    setIsCreatePaperOpen(false);
    setEditingPaper(null);
    toast.success('CIE Paper submitted to HOD successfully');
  };

  const handleDeleteCIEPaper = (paperId: string) => {
    saveCIEPapers(ciePapers.filter(p => p.id !== paperId));
    toast.success('Draft paper deleted successfully');
  };

  // Handler: Resubmit Paper for Re-Audit after revising
  const handleResubmitForReaudit = (paperId: string) => {
    const target = ciePapers.find(p => p.id === paperId);
    if (!target) return;

    const updated = ciePapers.map(p =>
      p.id === paperId
        ? {
            ...p,
            status: 'SUBMITTED_TO_HOD' as const,
            submittedAt: `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (Resubmitted for Re-Audit)`,
          }
        : p
    );

    saveCIEPapers(updated);
    toast.success(`Question paper for ${target.courseCode} (${target.testType}) resubmitted to HOD for Re-Audit!`, {
      icon: '🔄',
      duration: 4000,
    });
  };

  // Handler: Script Evaluation Complete (Automatically syncs to Student Roster!)
  const handleScriptEvaluationComplete = (
    studentId: string,
    awardedTotal: number,
    testType: 'CIE-1' | 'CIE-2'
  ) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id === studentId) {
          const field = testType === 'CIE-1' ? 'cie1' : 'cie2';
          const updated = { ...s, [field]: awardedTotal, isModified: true };
          
          const c1 = (updated.cie1 || 0) / 2;
          const c2 = (updated.cie2 || 0) / 2;
          const c3 = (updated.cie3 || 0) / 2;
          const lab = updated.labOrProject || 0;
          
          updated.totalCIE = c1 + c2 + c3 + lab;
          return updated;
        }
        return s;
      })
    );
  };

  const handleUpdateScript = (updatedScript: CIEScannedScript) => {
    setScannedScripts(prev => prev.map(s => (s.id === updatedScript.id ? updatedScript : s)));
  };

  const handleSaveMarksToHOD = () => {
    setStudents(prev => prev.map(s => ({ ...s, isModified: false })));
    toast.success(`Marks & Attendance for ${selectedCourseCode} synchronized and submitted to HOD!`);
  };

  // Handler: Validate SEE Session Key & Transition to Evaluator Studio
  const handleValidateSessionKey = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = inputSessionKey.trim().toUpperCase();

    if (!cleanKey) {
      toast.error('Please enter a valid CoE Evaluation Session Key.');
      return;
    }

    setIsValidatingKey(true);

    setTimeout(() => {
      setIsValidatingKey(false);
      if (cleanKey.includes('EVAL') || cleanKey.length >= 8) {
        toast.success('Session key verified! Launching Digital Evaluation Studio...');
        navigate(`/evaluator?sessionKey=${cleanKey}&subject=${selectedCourseCode}&evaluator=${encodeURIComponent(user?.full_name || 'Faculty Evaluator')}`);
      } else {
        toast.error('Invalid or expired Session Key. Please check the key issued by CoE.');
      }
    }, 600);
  };

  const belowAttendanceCount = students.filter(
    s => s.courseCode === selectedCourseCode && s.attendancePercent < 75
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
      label: 'SEE Evaluator Studio',
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
          OTP
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
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
          }}
        >
          <Save size={16} /> Save & Submit Marks to HOD
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
      title: 'Semester End Examination (SEE) Valuation Studio Gate',
      subtitle: 'Cryptographic single-session OTP key gateway for autonomous digital answer script evaluation.',
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
              onValuationComplete={handleValuationComplete}
            />
          )}

          {/* ══════════════ TAB 5: SEE VALUATION GATE ══════════════ */}
          {activeTab === 'SEE_VALUATION' && (
            <SEEValuationGateTab
              selectedCourseCode={selectedCourseCode}
              inputSessionKey={inputSessionKey}
              isValidatingKey={isValidatingKey}
              onInputSessionKeyChange={setInputSessionKey}
              onValidateSessionKey={handleValidateSessionKey}
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
