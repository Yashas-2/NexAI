import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/services/api';
import {
  Users,
  CheckCircle2,
  QrCode,
  FileCheck,
  BookOpen,
  UserPlus,
  Calendar,
  Building
} from 'lucide-react';

import {
  StudentEligibilityRecord,
  HallTicketRecord,
  FacultyNomination,
  CIEMarksSheet,
  CourseRecord,
  FacultyMember,
  CIEQuestionPaper,
  DepartmentExamSession,
  ExamHall,
  AllocatedSeat,
  FacultyDutyAllocation
} from './types';
import {
  INITIAL_STUDENTS,
  INITIAL_HALL_TICKETS,
  INITIAL_FACULTY_NOMINATIONS,
  INITIAL_CIE_SHEETS,
  INITIAL_COURSES,
  INITIAL_FACULTY_MEMBERS,
  INITIAL_CIE_PAPERS,
  INITIAL_DEPARTMENT_EXAM_SESSIONS,
  INITIAL_EXAM_HALLS,
  INITIAL_ALLOCATED_SEATS,
  INITIAL_FACULTY_DUTY_ALLOCATIONS
} from './mockData';

import { HODOverviewTab } from './features/overview/HODOverviewTab';
import { StudentDirectoryTab } from './features/students/StudentDirectoryTab';
import { EligibilityGatewayTab } from './features/eligibility/EligibilityGatewayTab';
import { HallTicketsTab } from './features/hallTickets/HallTicketsTab';
import { FacultyEndorsementTab } from './features/facultyEndorsement/FacultyEndorsementTab';
import { HODCurriculumTab } from './features/curriculum/HODCurriculumTab';
import { FacultyManagementTab } from './features/facultyManagement/FacultyManagementTab';
import { DepartmentExamsTab } from './features/departmentExams/DepartmentExamsTab';
import { ExamHallsTab } from './features/rooms/ExamHallsTab';

type HODTab = 'OVERVIEW' | 'STUDENTS' | 'CURRICULUM' | 'FACULTY' | 'EXAM_HALLS' | 'DEPT_EXAMS' | 'ELIGIBILITY' | 'HALL_TICKETS' | 'FACULTY_CIE';

export default function HODDashboard() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  // Master States
  const [activeTab, setActiveTab] = useState<HODTab>('OVERVIEW');
  const [students, setStudents] = useState<StudentEligibilityRecord[]>(INITIAL_STUDENTS);
  const [hallTickets, setHallTickets] = useState<HallTicketRecord[]>(() => {
    try {
      const saved = localStorage.getItem('nexai_hall_tickets');
      if (!saved) return INITIAL_HALL_TICKETS;
      const parsed: HallTicketRecord[] = JSON.parse(saved) || [];
      // Drop legacy placeholder (TBA) rows cached by older fetches — a fresh
      // fetch replaces this list as soon as the dashboard mounts.
      return parsed.map(t => ({
        ...t,
        slots: (t.slots || []).filter(s => s.examDate && s.examDate !== 'TBA'),
      }));
    } catch {
      return INITIAL_HALL_TICKETS;
    }
  });
  const [facultyNominations, setFacultyNominations] = useState<FacultyNomination[]>(INITIAL_FACULTY_NOMINATIONS);
  const [cieSheets, setCIESheets] = useState<CIEMarksSheet[]>(INITIAL_CIE_SHEETS);
  const [courses, setCourses] = useState<CourseRecord[]>(INITIAL_COURSES);
  const [facultyMembers, setFacultyMembers] = useState<FacultyMember[]>(INITIAL_FACULTY_MEMBERS);
  const [examHalls, setExamHalls] = useState<ExamHall[]>(INITIAL_EXAM_HALLS);
  const [allocatedSeats, setAllocatedSeats] = useState<AllocatedSeat[]>(INITIAL_ALLOCATED_SEATS);
  const [facultyDuties, setFacultyDuties] = useState<FacultyDutyAllocation[]>(INITIAL_FACULTY_DUTY_ALLOCATIONS);
  const [examSessions, setExamSessions] = useState<DepartmentExamSession[]>([]);
  const [baseStudentsCount, setBaseStudentsCount] = useState(0);
  const [ciePapers, setCIEPapers] = useState<CIEQuestionPaper[]>(() => {
    try {
      const saved = localStorage.getItem('nexai_cie_papers');
      return saved ? JSON.parse(saved) : INITIAL_CIE_PAPERS;
    } catch {
      return INITIAL_CIE_PAPERS;
    }
  });

  const handleUpdateCIEPapers = (papers: CIEQuestionPaper[]) => {
    setCIEPapers(papers);
    try {
      localStorage.setItem('nexai_cie_papers', JSON.stringify(papers));
      window.dispatchEvent(new Event('nexai_cie_papers_updated'));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEligibilityRecords = () => {
    api.get('/eligibility/records/')
      .then(res => {
        const records = res.data.results || res.data;
        const mapped = (records || []).map((r: any) => ({
          id: r.id,
          usn: r.usn,
          name: r.name,
          email: r.email,
          semester: r.semester ? `${r.semester}th Semester` : '5th Semester',
          department: r.department_code || 'CS',
          section: r.section || 'A',
          subjectCode: r.subject_code,
          subjectTitle: r.subject_title,
          facultyInCharge: 'N/A',
          attendancePercent: parseFloat(r.attendance_percentage || '0'),
          totalClassesHeld: 40,
          classesAttended: Math.floor(40 * (parseFloat(r.attendance_percentage || '0') / 100)),
          cie1Score: r.cie1_marks !== null && r.cie1_marks !== undefined ? parseFloat(r.cie1_marks) : 0,
          cie2Score: r.cie2_marks !== null && r.cie2_marks !== undefined ? parseFloat(r.cie2_marks) : 0,
          cie3Score: r.cie3_marks !== null && r.cie3_marks !== undefined ? parseFloat(r.cie3_marks) : 0,
          assignmentScore: r.assignment_marks !== null && r.assignment_marks !== undefined ? parseFloat(r.assignment_marks) : 0,
          cieMarksAvg: parseFloat(r.cie_marks || '0'),
          status: r.is_eligible ? 'ELIGIBLE' as const : 'DETAINED' as const,
          hasFeeDues: false,
          hallTicketIssued: false,
        }));
        
        setStudents(mapped);
      })
      .catch(console.error);
  };

  const fetchHallTickets = () => {
    api.get('/eligibility/hall-tickets/')
      .then(res => {
        const tickets = res.data.results || res.data;
        if (tickets && tickets.length > 0) {
          const mapped = tickets.map((t: any) => ({
            id: t.id,
            ticketNumber: t.ticket_number,
            usn: t.usn,
            studentName: t.student_name,
            semester: typeof t.semester === 'number' || /^\d+$/.test(String(t.semester))
              ? `${t.semester}th Semester`
              : String(t.semester || ''),
            department: t.department_code || 'CS',
            examSession: t.exam_session_name,
            examCycle: 'SEE_FINAL' as const,
            generatedAt: t.created_at,
            isRevoked: t.is_revoked,
            qrPayload: t.qr_code_data,
            slots: (t.slots || [])
              // Only papers with a published schedule — no TBA placeholders
              .filter((s: any) => s.exam_date || s.date)
              .map((s: any) => ({
                subjectCode: s.subject_code || '',
                subjectTitle: s.subject_title || s.subject_name || '',
                examDate: s.exam_date || s.date || '',
                examTime: s.exam_time || '',
                roomAllocated: s.room_allocated || s.room || '',
                deskNumber: s.desk_number || s.seat || '',
              })),
          }));

          setHallTickets(mapped);
          try { localStorage.setItem('nexai_hall_tickets', JSON.stringify(mapped)); } catch (e) {}
        } else {
          setHallTickets([]);
          try { localStorage.removeItem('nexai_hall_tickets'); } catch (e) {}
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    const handleSync = () => {
      try {
        const saved = localStorage.getItem('nexai_cie_papers');
        if (saved) setCIEPapers(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('nexai_cie_papers_updated', handleSync);
    window.addEventListener('storage', handleSync);

    // Fetch subjects from backend
    api.get('/scheduling/subjects/')
      .then(res => {
        const subjects = res.data.results || res.data;
        setCourses(subjects.map((s: any) => ({
          id: s.id,
          code: s.code,
          title: s.name,
          department: s.department?.name || 'Computer Science & Engineering',
          semester: `${s.semester}th Semester`,
          credits: s.credits,
          studentsCount: s.enrolled_students ?? s.total_enrolled ?? 0,
          status: 'ACTIVE',
          assignedFacultyId: s.coordinator,
          assignedFacultyName: s.coordinator_name || null,
          syllabusModules: [],
          coList: s.co_list || [],
          coPoMapping: s.co_po_mapping || {},
          outcomes: (s.co_list || []).map((coId: string) => ({
            id: coId,
            description: `Outcome ${coId}`,
            mappedPOs: Object.keys((s.co_po_mapping || {})[coId] || {}).filter(po => (s.co_po_mapping || {})[coId][po] > 0),
            coPoMapping: (s.co_po_mapping || {})[coId] || {}
          }))
        })));
      })
      .catch(console.error);

    // Fetch rooms from backend
    api.get('/scheduling/rooms/')
      .then(res => {
        const rooms = res.data.results || res.data;
        setExamHalls(rooms.map((r: any) => ({
          id: r.id,
          roomNumber: r.name,
          blockName: `${r.building} - Floor ${r.floor ?? 0}`,
          rowsCount: r.rows_count || 0,
          colsCount: r.cols_count || 0,
          capacity: r.exam_capacity,
          benchType: (r.bench_style || 'SINGLE_SEATER') as 'SINGLE_SEATER' | 'DOUBLE_SEATER',
          isCCTVEnabled: r.has_cctv,
          isAC: r.has_wifi,
          status: r.is_active ? 'ACTIVE' as const : 'MAINTENANCE' as const,
          lastAnnualAuditDate: new Date().toISOString().split('T')[0],
        })));
      })
      .catch(console.error);

    // Fetch faculty from backend
    api.get('/auth/users/', { params: { role: 'FACULTY' } })
      .then(res => {
        const users = res.data.results || res.data;
        setFacultyMembers(users.map((u: any) => ({
          id: u.id,
          name: u.full_name,
          email: u.email,
          employeeId: u.employee_id || u.id.slice(0, 8),
          designation: u.designation || 'Faculty',
          department: u.department_code || 'CSE',
          assignedCourses: [],
          status: 'ACTIVE' as const,
          createdDate: new Date().toISOString().split('T')[0],
        })));
      })
      .catch(console.error);

    // Fetch base students from backend for Total Department Roster
    api.get('/auth/users/', { params: { role: 'STUDENT' } })
      .then(res => {
        const users = res.data.results || res.data;
        setBaseStudentsCount(users.length);
      })
      .catch(console.error);

    // Fetch Exam Sessions from backend — only CIE (department-level) sessions
    api.get('/scheduling/sessions/')
      .then(res => {
        const sessionData = res.data.results || res.data;
        // Use session_type field for reliable filtering (not name-string matching)
        const deptSessions = sessionData.filter((s: any) => s.session_type === 'CIE');
        
        setExamSessions(deptSessions.map((s: any) => ({
          id: s.id,
          subjectCode: s.subject_list?.length ? s.subject_list.join(', ') : 'Department Level',
          subjectTitle: s.name,
          semester: `Semester ${s.semester || 'N/A'}`,
          examType: s.name.toUpperCase().includes('CIE-2') ? 'CIE-2' : s.name.toUpperCase().includes('CIE') ? 'CIE-1' : 'DEPARTMENT_EXAM',
          examDate: s.start_date ? s.start_date.split('T')[0] : '',
          timeSlot: `${s.start_date ? s.start_date.split('T')[0] : ''} to ${s.end_date ? s.end_date.split('T')[0] : ''}`,
          roomsAllocated: s.rooms || [],
          totalStudentsExpected: s.student_count || 0,
          studentBatches: [],
          paperSetterName: s.created_by_name || 'HOD',
          chiefInvigilatorName: 'TBD',
          evaluatorName: 'Course Handlers',
          status: s.status,
          evaluatorSessionKey: s.id.split('-')[0].toUpperCase(),
          schedulingTaskId: s.scheduling_task_id,
          // Preserve raw backend fields for edit modal
          name: s.name,
          start_date: s.start_date,
          end_date: s.end_date,
          selected_slots: s.selected_slots || [],
          selected_rooms: s.selected_rooms || [],
          exams_per_day: s.exams_per_day,
        })));
      })
      .catch(console.error);
    fetchEligibilityRecords();
    document.addEventListener('visibilitychange', handleVisRefresh);
    // Fetch Hall Tickets from backend
    fetchHallTickets();

    return () => {
      window.removeEventListener('nexai_cie_papers_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      document.removeEventListener('visibilitychange', handleVisRefresh);
    };

    function handleVisRefresh() {
      if (document.visibilityState === 'visible') {
        fetchEligibilityRecords();
        fetchHallTickets();
      }
    }
  }, []);

  // Refetch tickets each time the Hall Tickets tab opens so schedule
  // changes (generation, reschedule, seating) show up immediately.
  useEffect(() => {
    if (activeTab === 'HALL_TICKETS') fetchHallTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);



  // Handlers with backend sync
  const handleUpdateStudent = async (updatedStudent: StudentEligibilityRecord) => {
    // Optimistic update
    setStudents(prev => prev.map(s => (s.id === updatedStudent.id ? updatedStudent : s)));

    // Backend sync
    try {
      await api.put(`/eligibility/records/${updatedStudent.id}/`, {
        usn: updatedStudent.usn,
        name: updatedStudent.name,
        semester: updatedStudent.semester,
        subject_code: updatedStudent.subjectCode,
        subject_title: updatedStudent.subjectTitle,
        faculty_in_charge: updatedStudent.facultyInCharge,
        attendance_percentage: updatedStudent.attendancePercent,
        classes_attended: updatedStudent.classesAttended,
        total_classes_held: updatedStudent.totalClassesHeld,
        cie_marks_avg: updatedStudent.cieMarksAvg,
        status: updatedStudent.hasFeeDues ? 'FEE_BLOCKED' : updatedStudent.status,
        has_fee_dues: updatedStudent.hasFeeDues,
        condonation_approved: updatedStudent.status === 'CONDONABLE' ? updatedStudent.condonationApproved : (updatedStudent.status === 'ELIGIBLE'),
      });
    } catch (err) {
      console.error('Failed to sync update to backend:', err);
      // Could add toast warning here
    }
  };

  const handleBulkAddStudents = (newStudents: StudentEligibilityRecord[]) => {
    setStudents(prev => [...newStudents, ...prev]);
  };

  const handleDeleteStudent = async (studentId: string) => {
    // Optimistic update
    setStudents(prev => prev.filter(s => s.id !== studentId));

    // Backend sync
    try {
      await api.delete(`/eligibility/records/${studentId}/`);
    } catch (err) {
      console.error('Failed to delete from backend:', err);
      // Could add toast warning and rollback
    }
  };

  const handleDeleteAllStudents = async () => {
    // Optimistic update
    setStudents([]);
    try { localStorage.removeItem('nexai_students'); } catch (e) {}

    // Backend sync - would need a bulk delete endpoint or loop
    // For now, just clear localStorage; backend records remain
  };

  const handleUpdateHallTickets = (tickets: HallTicketRecord[]) => {
    setHallTickets(tickets);
    try { localStorage.setItem('nexai_hall_tickets', JSON.stringify(tickets)); } catch (e) {}
  };

  const handleAddFaculty = (newFaculty: FacultyMember) => {
    setFacultyMembers(prev => [...prev, newFaculty]);
  };

  const handleUpdateFaculty = (updatedFaculty: FacultyMember) => {
    setFacultyMembers(prev => prev.map(f => (f.id === updatedFaculty.id ? updatedFaculty : f)));
  };

  const handleDeleteFaculty = (id: string) => {
    setFacultyMembers(prev => prev.filter(f => f.id !== id));
  };

  const sidebarItems = [
    { id: 'OVERVIEW', label: 'Department Overview', icon: <Users size={20} /> },
    { id: 'STUDENTS', label: 'Student Directory (Base)', icon: <Users size={20} /> },
    { id: 'CURRICULUM', label: 'Course & CO-PO Studio', icon: <BookOpen size={20} /> },
    { id: 'ELIGIBILITY', label: 'Eligibility Gateway', icon: <CheckCircle2 size={20} /> },
    { id: 'EXAM_HALLS', label: 'Exam Halls & Rooms', icon: <Building size={20} /> },
    { id: 'DEPT_EXAMS', label: 'Exam Scheduling & Duties', icon: <Calendar size={20} /> },
    { id: 'FACULTY_CIE', label: 'CIE Paper Review', icon: <FileCheck size={20} /> },
    { id: 'HALL_TICKETS', label: 'Hall Tickets (Admit)', icon: <QrCode size={20} /> },
    { id: 'FACULTY', label: 'Faculty Credentials', icon: <UserPlus size={20} /> }
  ];

  const displayName = (!user?.full_name || user.full_name.toLowerCase() === 'head of department' || user.full_name.toLowerCase() === 'hod')
    ? 'Dr. Grace Hopper'
    : user.full_name;

  let userDeptCode = user?.department_code;
  if (!userDeptCode) {
    userDeptCode = displayName.includes('Ezhil') ? 'ME' : 'CSE';
  }

  const headerConfig: Record<HODTab, { title: string; subtitle: string; icon: React.ReactNode; accentColor: string }> = {
    OVERVIEW: {
      title: 'HOD Academic & Examination Operations',
      subtitle: `Department of ${userDeptCode} • Fall Semester 2026 Examination Gateway.`,
      icon: <Users size={26} />,
      accentColor: '#3b82f6',
    },
    STUDENTS: {
      title: 'Base Student Seeding & Directory',
      subtitle: 'Import the foundational student cohort (USN, Name, Email, Semester) via ERP CSV.',
      icon: <Users size={26} />,
      accentColor: '#3b82f6',
    },
    CURRICULUM: {
      title: 'Course Curriculum, CO-PO Mapping & Faculty Assignment',
      subtitle: 'Author department courses, define Bloom-aligned Course Outcomes, and map Program Outcome correlations.',
      icon: <BookOpen size={26} />,
      accentColor: '#4F46E5',
    },
    FACULTY: {
      title: 'Faculty User Provisioning & Credential Generator',
      subtitle: 'Register department teaching faculty, provision portal login credentials, and inspect authorization slips.',
      icon: <UserPlus size={26} />,
      accentColor: '#16A34A',
    },
    EXAM_HALLS: {
      title: 'Department Examination Halls & Room Infrastructure',
      subtitle: 'Annual registration of physical examination halls, bench grid dimensions, seating capacities, and CCTV surveillance.',
      icon: <Building size={26} />,
      accentColor: '#059669',
    },
    DEPT_EXAMS: {
      title: 'Department Examination Scheduling & Duty Allotments',
      subtitle: 'Schedule CIE & lab exams, allocate timetable slots & halls, assign student batches, and appoint faculty duties.',
      icon: <Calendar size={26} />,
      accentColor: '#4F46E5',
    },
    ELIGIBILITY: {
      title: 'Student Eligibility & Attendance Gateway',
      subtitle: 'Monitor attendance cutoffs (≥85%), verify medical condonation waivers, and resolve fee blockages.',
      icon: <CheckCircle2 size={26} />,
      accentColor: '#10b981',
    },
    HALL_TICKETS: {
      title: 'Cryptographic Hall Ticket Generation & Dispatch',
      subtitle: 'Batch generate, digitally sign, and inspect tamper-evident QR code examination admit cards.',
      icon: <QrCode size={26} />,
      accentColor: '#48977f',
    },
    FACULTY_CIE: {
      title: 'Faculty Internal Test (CIE) Question Paper Review',
      subtitle: 'Inspect, verify Bloom taxonomy levels & CO mappings, and approve Continuous Internal Evaluation question papers submitted by teaching faculty.',
      icon: <FileCheck size={26} />,
      accentColor: '#8b5cf6',
    },
  };

  const currentHeader = headerConfig[activeTab];

  return (
    <MainLayout
      userName={displayName}
      userRole={`Head of Department (${userDeptCode})`}
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={id => setActiveTab(id as HODTab)}
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
            right: -60,
            bottom: -60,
            pointerEvents: 'none',
            opacity: 0.08,
            zIndex: 0,
          }}
        >
          {/* Certificate / Shield / Laurel HOD Decorative Motif */}
          <circle cx="170" cy="170" r="140" fill={currentHeader.accentColor} />
          <circle cx="170" cy="170" r="110" fill="none" stroke="white" strokeWidth="6" strokeDasharray="10 10" />
          <path d="M170,70 L210,140 L290,140 L225,185 L250,260 L170,215 L90,260 L115,185 L50,140 L130,140 Z" fill="white" opacity="0.3" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Page Header */}
          <PageHeader
            title={currentHeader.title}
            subtitle={currentHeader.subtitle}
            icon={currentHeader.icon}
            accentColor={currentHeader.accentColor}
          />

          {/* ── Tab Views ── */}
          {activeTab === 'OVERVIEW' && (
            <HODOverviewTab
              students={students}
              hallTickets={hallTickets}
              cieSheets={cieSheets}
              departmentCode={userDeptCode}
              baseStudentsCount={baseStudentsCount}
              onNavigateToEligibility={() => setActiveTab('ELIGIBILITY')}
              onNavigateToHallTickets={() => setActiveTab('HALL_TICKETS')}
              onNavigateToFaculty={() => setActiveTab('FACULTY_CIE')}
            />
          )}

          {activeTab === 'STUDENTS' && (
            <StudentDirectoryTab />
          )}

          {activeTab === 'CURRICULUM' && (
            <HODCurriculumTab
              courses={courses}
              facultyMembers={facultyMembers}
              onAddCourse={(newCourse) => setCourses(prev => [newCourse, ...prev])}
              onUpdateCourse={(updated) => setCourses(prev => prev.map(c => c.code === updated.code ? updated : c))}
              onDeleteCourse={(code) => setCourses(prev => prev.filter(c => c.code !== code))}
            />
          )}

          {activeTab === 'FACULTY' && (
            <FacultyManagementTab
              facultyMembers={facultyMembers}
              courses={courses}
              onAddFaculty={handleAddFaculty}
              onUpdateFaculty={handleUpdateFaculty}
              onDeleteFaculty={handleDeleteFaculty}
            />
          )}

          {activeTab === 'EXAM_HALLS' && (
            <ExamHallsTab
              halls={examHalls}
              onUpdateHalls={setExamHalls}
            />
          )}

          {activeTab === 'DEPT_EXAMS' && (
            <DepartmentExamsTab
              sessions={examSessions}
              courses={courses}
              facultyMembers={facultyMembers}
              halls={examHalls}
              allocatedSeats={allocatedSeats}
              facultyDuties={facultyDuties}
              students={students}
              onUpdateSessions={setExamSessions}
            />
          )}

          {activeTab === 'ELIGIBILITY' && (
            <EligibilityGatewayTab
              students={students}
              courses={courses}
              onUpdateStudent={handleUpdateStudent}
              onBulkAddStudents={handleBulkAddStudents}
              onDeleteStudent={handleDeleteStudent}
              onDeleteAllStudents={handleDeleteAllStudents}
              onNavigateToHallTickets={() => setActiveTab('HALL_TICKETS')}
              departmentFilter={userDeptCode}
              onRefreshData={fetchEligibilityRecords}
            />
          )}

          {activeTab === 'HALL_TICKETS' && (
            <HallTicketsTab
              hallTickets={hallTickets}
              students={students}
              onUpdateHallTickets={handleUpdateHallTickets}
              onRefreshTickets={fetchHallTickets}
            />
          )}

          {activeTab === 'FACULTY_CIE' && (
            <FacultyEndorsementTab
              cieSheets={cieSheets}
              facultyNominations={facultyNominations}
              ciePapers={ciePapers}
              onUpdateCIESheets={setCIESheets}
              onUpdateNominations={setFacultyNominations}
              onUpdateCIEPapers={handleUpdateCIEPapers}
            />
          )}
        </div>
      </div>
    </MainLayout>
  );
}
