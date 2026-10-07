export type BloomsLevel = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface QuestionItem {
  id: string;
  number: number;
  part?: string;
  section: string; // e.g. "Part A", "Part B", "Part C"
  text: string;
  marks: number;
  bloomsLevel: BloomsLevel;
  coMapping: string; // Course Outcome, e.g. "CO1", "CO2"
  module: number; // Syllabus Unit / Module (1 - 5)
  hasOrChoice?: boolean;
  orQuestionText?: string;
  schemeNotes?: string; // Scheme of evaluation / answer key pointers
}

export interface QuestionPaperDraft {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  examSession: string;
  semester: string;
  setLabel: 'Set A' | 'Set B' | 'Set C' | 'Set D';
  status: 'DRAFT' | 'READY_FOR_SIGNING' | 'SIGNED_AND_VAULTED';
  totalMarks: number;
  maxMarks: number;
  durationMinutes: number;
  questions: QuestionItem[];
  aiQualityScore: number; // 0 - 100
  similarityScore: number; // 0 - 100%
  lastSavedAt: string;
  digitalSignature?: {
    signedBy: string;
    algorithm: string;
    signedAt: string;
    sha256Digest: string;
    ipfsCid: string;
    signatureHex: string;
  };
}

export interface SyllabusModule {
  moduleNumber: number;
  title: string;
  targetWeightagePercent: number;
  description: string;
}

export interface SetterAssignment {
  id: string;
  subjectCode: string;
  subjectTitle: string;
  department: string;
  semester: string;
  examSession: string;
  deadline: string;
  daysRemaining: number;
  setsRequired: number;
  setsSubmitted: number;
  maxMarks: number;
  durationMinutes: number;
  syllabusModules: SyllabusModule[];
  guidelinesAcknowledged: boolean;
  honorariumAmount: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PENDING_REVIEW';
}

export interface AICheckResult {
  bloomsDistribution: Record<BloomsLevel, number>;
  syllabusCoverage: { moduleNumber: number; questionCount: number; percentage: number; isCovered: boolean }[];
  similarityMatches: { source: string; similarityPercent: number; matchedText: string }[];
  overallQualityScore: number;
  recommendations: string[];
}
