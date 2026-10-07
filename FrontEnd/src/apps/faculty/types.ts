export interface AssignedCourse {
  id?: string;
  code: string;
  title: string;
  department: string;
  semester: string;
  credits: number;
  totalEnrolled: number;
  avgAttendance: number;
  syllabusCompletion: number; // percentage
  nextClassTime?: string;
  cie1Status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'DRAFT';
}

export interface StudentGradeRecord {
  id: string;
  usn: string;
  name: string;
  email: string;
  courseCode: string;
  attendancePercent: number | string;
  cie1: number | string; // conducted for 20, reduced to 10
  cie2: number | string; // conducted for 20, reduced to 10
  cie3: number | string; // conducted for 20, reduced to 10
  labOrProject: number | string; // out of 20
  totalCIE: number; // out of 50
  remarks?: string;
  isModified?: boolean;
  saveStatus?: 'SYNCED' | 'UNSAVED' | 'SAVING' | 'FAILED';
}

export interface FacultyCIEQuestion {
  id: string;
  qNumber: string;
  text: string;
  answer: string;
  marks: number;
  bloomsLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  co: 'CO1' | 'CO2' | 'CO3' | 'CO4' | 'CO5';
}

export interface FacultyCIEPaper {
  id: string;
  courseCode: string;
  courseTitle: string;
  semester: string;
  testType: 'CIE-1' | 'CIE-2' | 'CIE-3' | 'ASSIGNMENT_TEST';
  maxMarks: number;
  status: 'DRAFT' | 'SUBMITTED_TO_HOD' | 'APPROVED' | 'REVISION_REQUESTED';
  hodRemarks?: string;
  auditedAt?: string;
  submittedAt?: string;
  questions: FacultyCIEQuestion[];
  facultyName?: string;
}

export interface SEESessionKeyValidation {
  sessionKey: string;
  bundleId: string;
  subjectCode: string;
  subjectTitle: string;
  totalScripts: number;
  deadline: string;
  assignedOfficer: string;
}

export interface DailyAttendanceRecord {
  id: string;
  courseCode: string;
  date: string;
  sessionNumber: number;
  sessionTopic: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  absentUSNs: string[];
  recordedAt: string;
}

export interface CIECanvasAnnotation {
  id: string;
  pageNumber: number;
  type: 'TICK' | 'CROSS' | 'STEP_MARK' | 'COMMENT';
  x: number;
  y: number;
  marksValue?: number;
  text?: string;
}

export interface CIEScriptQuestionScore {
  id: string;
  questionNumber: string;
  questionText: string;
  maxMarks: number;
  bloomsLevel: string;
  co: string;
  aiSuggestedMarks?: number;
  awardedMarks: number;
  evaluatorRemarks?: string;
  isEvaluated?: boolean;
  answerText?: string;
}

export interface CIEScannedScript {
  id: string;
  studentId: string;
  studentUSN: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  testType: 'CIE-1' | 'CIE-2';
  submittedAt: string;
  totalPages: number;
  status: 'PENDING_VALUATION' | 'EVALUATED' | 'NOT_SUBMITTED';
  maxMarks: number;
  evaluatorTotalMarks?: number;
  aiSuggestedMarks?: number;
  questions: CIEScriptQuestionScore[];
  annotations: CIECanvasAnnotation[];
  evaluatedAt?: string;
  generalFeedback?: string;
}

