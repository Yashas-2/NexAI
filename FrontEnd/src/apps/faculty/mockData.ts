import {
  AssignedCourse,
  StudentGradeRecord,
  FacultyCIEPaper,
  DailyAttendanceRecord,
  CIEScannedScript
} from './types';

export const INITIAL_ASSIGNED_COURSES: AssignedCourse[] = [
  {
    code: 'CS601',
    title: 'Machine Learning',
    department: 'Computer Science & Engineering',
    semester: '6th Semester',
    credits: 4,
    totalEnrolled: 60,
    avgAttendance: 85,
    syllabusCompletion: 70,
    cie1Status: 'APPROVED'
  },
  {
    code: 'CS602',
    title: 'Compiler Design',
    department: 'Computer Science & Engineering',
    semester: '6th Semester',
    credits: 4,
    totalEnrolled: 55,
    avgAttendance: 90,
    syllabusCompletion: 60,
    cie1Status: 'DRAFT'
  }
];

export const INITIAL_DAILY_ATTENDANCE_LOGS: DailyAttendanceRecord[] = [];

export const INITIAL_CIE_SCANNED_SCRIPTS: CIEScannedScript[] = [];

export const INITIAL_STUDENT_ROSTER: StudentGradeRecord[] = [
  {
    id: 'st_1',
    usn: '1MS24CS001',
    name: 'Alice Smith',
    email: 'alice@example.com',
    courseCode: 'CS601',
    attendancePercent: 88,
    cie1: 9,
    cie2: 8,
    cie3: 9,
    labOrProject: 18,
    totalCIE: 44
  },
  {
    id: 'st_2',
    usn: '1MS24CS002',
    name: 'Bob Jones',
    email: 'bob@example.com',
    courseCode: 'CS601',
    attendancePercent: 75,
    cie1: 6,
    cie2: 7,
    cie3: 8,
    labOrProject: 15,
    totalCIE: 36
  }
];

export const INITIAL_FACULTY_CIE_PAPERS: FacultyCIEPaper[] = [];
