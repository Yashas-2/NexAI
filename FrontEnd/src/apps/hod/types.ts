export type EligibilityStatus = 'ELIGIBLE' | 'CONDONABLE' | 'DETAINED' | 'FEE_BLOCKED';

export interface StudentEligibilityRecord {
  id: string;
  usn: string;
  name: string;
  email: string;
  semester: string; // e.g. "3rd Sem", "5th Sem", "7th Sem"
  department: string;
  section: string; // e.g. "A", "B", "C"
  subjectCode?: string; // e.g. "CS201"
  subjectTitle?: string; // e.g. "Data Structures & Algorithms"
  facultyInCharge?: string; // e.g. "Prof. Alan Turing"
  attendancePercent: number;
  totalClassesHeld: number;
  classesAttended: number;
  cie1Score?: number; // Internal Assessment 1 score out of 50
  cie2Score?: number; // Internal Assessment 2 score out of 50
  cieMarksAvg: number; // Continuous Internal Evaluation out of 50
  status: EligibilityStatus;
  hasFeeDues: boolean;
  dueAmount?: string;
  condonationReason?: string;
  condonationApproved?: boolean;
  hallTicketIssued?: boolean;
  hallTicketNumber?: string;
}

export interface TimetableSlot {
  subjectCode: string;
  subjectTitle: string;
  examDate: string;
  examTime: string;
  roomAllocated: string;
  deskNumber: string;
}

export type ExamCycleType = 'CIE-1' | 'CIE-2' | 'CIE-3' | 'SEE_FINAL';

export interface HallTicketRecord {
  id: string;
  ticketNumber: string;
  usn: string;
  studentName: string;
  semester: string;
  department: string;
  examSession: string;
  examCycle?: ExamCycleType; // e.g. "CIE-1", "CIE-2", "SEE_FINAL"
  generatedAt: string;
  isRevoked: boolean;
  revokeReason?: string;
  qrPayload: string;
  slots: TimetableSlot[];
}

export interface FacultyNomination {
  id: string;
  facultyId: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  experienceYears: number;
  assignedRole: 'SETTER' | 'EVALUATOR' | 'CHIEF_INVIGILATOR' | 'LAB_EXAMINER';
  subjectCode: string;
  subjectTitle: string;
  status: 'NOMINATED' | 'ACCEPTED' | 'DECLINED';
}

export interface CIEMarksSheet {
  subjectCode: string;
  subjectTitle: string;
  semester: string;
  facultyInCharge: string;
  totalStudents: number;
  averageScore: number;
  maxMarks: number;
  isEndorsedByHOD: boolean;
  endorsedAt?: string;
}

export interface CourseOutcome {
  id: string; // e.g. "CO1"
  description: string;
  mappedPOs: string[]; // Legacy/simplified display
  coPoMapping?: Record<string, number>; // Maps PO id to score 1-3
}

export interface CourseRecord {
  id: string;
  code: string;
  title: string;
  department: string;
  semester: string;
  credits: number;
  studentsCount: number;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  assignedFacultyId?: string;
  assignedFacultyName?: string;
  outcomes: CourseOutcome[];
  coList: string[]; // "CO1", "CO2"
  coPoMapping: Record<string, Record<string, number>>;
  syllabusModules: string[];
}

export interface FacultyMember {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  designation: string; // e.g. "Associate Professor"
  department: string;
  assignedCourses: string[]; // array of course codes
  tempPassword?: string;
  status: 'ACTIVE' | 'INVITED' | 'ON_LEAVE';
  createdDate: string;
}

export interface CIEQuestion {
  id: string;
  qNumber: string;
  text: string;
  marks: number;
  bloomsLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  co: string; // "CO1", "CO2"
}

export interface CIEQuestionPaper {
  id: string;
  courseCode: string;
  courseTitle: string;
  semester: string;
  testType: 'CIE-1' | 'CIE-2' | 'ASSIGNMENT_TEST';
  maxMarks: number;
  facultyName: string;
  facultyEmail: string;
  status: 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED';
  hodRemarks?: string;
  auditedAt?: string;
  submittedAt: string;
  questions: CIEQuestion[];
}

export interface DepartmentExamSession {
  id: string;
  title: string;
  examType: 'CIE-1' | 'CIE-2' | 'LAB_INTERNAL' | 'SEE_THEORY';
  subjectCode: string;
  subjectTitle: string;
  semester: string;
  examDate: string;
  timeSlot: string;
  roomsAllocated: string[];
  studentBatches: string[];
  totalStudentsExpected: number;
  paperSetterId: string;
  paperSetterName: string;
  chiefInvigilatorId: string;
  chiefInvigilatorName: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorSessionKey?: string;
  status: 'SCHEDULED' | 'FACULTY_APPOINTED' | 'QP_APPROVED' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface ExamHall {
  id: string;
  roomNumber: string; // e.g. "Hall C-101"
  blockName: string; // e.g. "Aryabhata Block - 1st Floor"
  rowsCount: number; // e.g. 6
  colsCount: number; // e.g. 6
  capacity: number; // rows * cols
  benchType: 'SINGLE_SEATER' | 'DOUBLE_SEATER';
  isCCTVEnabled: boolean;
  isAC: boolean;
  status: 'ACTIVE' | 'MAINTENANCE';
  lastAnnualAuditDate: string;
}

export interface AllocatedSeat {
  seatId: string; // e.g. "C101-A1"
  roomNumber: string; // "Hall C-101"
  rowLabel: string; // "A"
  colNumber: number; // 1
  seatNumber: string; // "A-01"
  studentUSN: string; // "1RV23CS001"
  studentName: string; // "Aarav Sharma"
  semester: string; // "3rd Sem"
  subjectCode: string; // "CS201"
  subjectTitle: string; // "Data Structures & Algorithms"
  examDate: string; // "2026-09-15"
  timeSlot: string; // "09:30 AM - 11:00 AM"
  colorTheme: string; // "#3B82F6" for 3rd sem, "#10B981" for 5th sem, "#8B5CF6" for 7th sem
}

export interface FacultyDutyAllocation {
  id: string;
  facultyId: string;
  facultyName: string;
  employeeId: string;
  dutyCount: number;
  assignments: {
    roomNumber: string;
    examDate: string;
    timeSlot: string;
    role: 'CHIEF_INVIGILATOR' | 'RELIEVER_PROCTOR';
  }[];
}

export interface AISeatingSchedulePlan {
  id: string;
  generatedAt: string;
  term: string;
  sessionsCount: number;
  totalRoomsUsed: number;
  totalStudentsSeated: number;
  antiCheatingScore: number; // e.g. 99.8% (0 adjacent same-semesters)
  dutyEqualityScore: number; // e.g. 100% (equal duties per faculty)
  allocations: AllocatedSeat[];
  facultyDuties: FacultyDutyAllocation[];
}



