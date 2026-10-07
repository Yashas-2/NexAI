export interface Department {
  code: string;
  name: string;
  color: string;
  prefix: string; // e.g., '1RV24CS'
  hodName: string;
}

export type SemesterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface TimeSlot {
  id: string;
  name: string; // e.g., 'Morning Slot (M1)', 'Afternoon Slot (A1)'
  startTime: string; // '09:30'
  endTime: string; // '12:30'
  sessionPeriod: 'FORENOON' | 'AFTERNOON' | 'EVENING';
}

export interface SubjectExam {
  code: string;
  title: string;
  deptCode: string;
  semester: SemesterNumber;
  credits: number;
  eligibleStudents: number;
  color: string;
  examDate?: string;
  slotId?: string;
}

export interface ExamHall {
  id: string;
  roomNumber: string;
  building: string;
  floor: number; // 0 = Ground Floor (PWD accessible)
  capacity: number;
  cols: number; // visual seating columns
  hasAisle: boolean;
  isAccessiblePWD: boolean;
  blockCode: string;
}

export interface FacultyInvigilator {
  id: string;
  name: string;
  department: string;
  designation: 'Professor' | 'Associate Professor' | 'Assistant Professor';
  email: string;
  phone: string;
  historicalDutyCount: number;
  currentCycleDuties: number;
  maxDutyQuota: number;
  isAvailable: boolean;
}

export interface SeatedCandidate {
  seatIndex: number;
  benchNumber: number;
  deskPosition: 'L' | 'R' | 'SINGLE';
  usn: string;
  name: string;
  department: string;
  subjectCode: string;
  subjectTitle: string;
  color: string;
  isSpecialAccommodated?: boolean;
}

export interface RoomDutyAssignment {
  roomId: string;
  chiefInvigilatorId: string;
  chiefInvigilatorName: string;
  relieverInvigilatorId?: string;
  relieverInvigilatorName?: string;
}

export interface RoomAllocationResult {
  roomId: string;
  roomNumber: string;
  building: string;
  floor: number;
  capacity: number;
  cols: number;
  seatedCandidates: SeatedCandidate[];
  occupiedCount: number;
  emptyCount: number;
  examDate?: string;
  startTime?: string;
  endTime?: string;
  chiefInvigilator: FacultyInvigilator;
  relieverInvigilator?: FacultyInvigilator;
  departmentTallies: Record<string, number>;
}

export interface AIAllocationConfig {
  interleavingStrategy: 'ROUND_ROBIN' | 'CHECKERBOARD_2D' | 'MAX_ENTROPY';
  antiCheatingStrictness: 'MAXIMUM' | 'BALANCED' | 'RELAXED';
  invigilatorRatio: number; // e.g., 30 students per invigilator
  enforceEqualWorkload: boolean;
  avoidDepartmentBias: boolean; // No sole-dept invigilator
  reserveBufferPercentage: number; // e.g., 5% buffer
  prioritizeGroundFloorPWD: boolean;
}

export interface AITelemetryMetrics {
  totalStudentsAllocated: number;
  totalHallsUsed: number;
  spaceUtilizationPercent: number;
  interleavingPurityScore: number; // % of neighbors with different subject
  invigilatorFairnessVariance: number; // standard deviation of duty counts
  conflictViolations: number;
  pwdComplianceRate: number;
  executionTimeMs: number;
}

export interface SessionScopeConfig {
  sessionName: string;
  examType: 'SEE_REGULAR' | 'SEE_SUPPLEMENTARY' | 'SEE_SPECIAL';
  academicYear: string;
  selectedDepartments: string[];
  selectedSemesters: SemesterNumber[];
  examsPerDay: 1 | 2;
  startDate: string;
  endDate: string;
  firstExamDate?: string;
  selectedSlots: TimeSlot[];
  specialInstructions?: string;
}
