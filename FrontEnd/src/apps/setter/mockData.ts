import { SetterAssignment, QuestionPaperDraft } from './types';

export const INITIAL_ASSIGNMENTS: SetterAssignment[] = [
  {
    id: 'a1',
    subjectCode: 'MECH701',
    subjectTitle: 'Control Engineering',
    examDate: '2026-09-18',
    sessionTime: '09:00 AM - 12:00 PM',
    setsRequired: 3,
    setsSubmitted: 0,
    deadline: '2026-09-01T23:59:00Z',
    status: 'PENDING'
  },
  {
    id: 'a2',
    subjectCode: 'CS301',
    subjectTitle: 'Data Structures and Applications',
    examDate: '2026-09-20',
    sessionTime: '09:00 AM - 12:00 PM',
    setsRequired: 3,
    setsSubmitted: 0,
    deadline: '2026-09-02T23:59:00Z',
    status: 'PENDING'
  }
];

export const INITIAL_DRAFTS: QuestionPaperDraft[] = [
  {
    id: 'd1',
    assignmentId: 'a1',
    subjectCode: 'MECH701',
    questions: [],
    totalMarks: 0,
    status: 'DRAFT',
    lastSavedAt: 'Not started'
  },
  {
    id: 'd2',
    assignmentId: 'a2',
    subjectCode: 'CS301',
    questions: [],
    totalMarks: 0,
    status: 'DRAFT',
    lastSavedAt: 'Not started'
  }
];
