export type BundleStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'CERTIFIED'
  | 'DISPATCHED';

export interface OverviewStats {
  booklets_received: number;
  booklets_unbundled: number;
  bundles_created: number;
  bundles_assigned: number;
  evaluators_active: number;
  awaiting_evaluation: number;
  awaiting_verification: number;
  awaiting_certification: number;
  certified: number;
  dispatched: number;
}

export interface OverviewSubject {
  subject_id: string;
  subject_code: string;
  subject_name: string;
  exam_session_id: string;
  exam_session_name: string;
  received: number;
  unbundled: number;
  bundles: number;
  graded_answers: number;
  total_answers: number;
}

export interface OverviewEvaluator {
  id: string;
  full_name: string;
  email: string;
  active_bundles: number;
}

export interface OverviewData {
  stats: OverviewStats;
  subjects: OverviewSubject[];
  evaluators: OverviewEvaluator[];
}

export interface ApiBundle {
  id: string;
  name: string;
  evaluator: string | null;
  evaluator_name: string | null;
  subject: string;
  subject_code: string;
  subject_name?: string;
  exam_session: string;
  exam_session_name?: string;
  created_at: string;
  status: BundleStatus;
  booklets_total?: number;
  access_code?: string;
}

export interface BundleInfo {
  id: string;
  name: string;
  status: BundleStatus;
  evaluator_id: string | null;
  evaluator_name: string | null;
  booklets: number;
}

export interface SubmissionAnswer {
  answer_id: string;
  question_id: string;
  question_label: string;
  question_text: string;
  max_marks: number;
  answer_text: string;
  answer_image_base64: string;
  extracted_text: string;
  marks_awarded: number | null;
}

export interface SubmissionRow {
  attempt_id: string;
  student_usn: string;
  student_name: string;
  submitted_at: string | null;
  proctor_strikes: number;
  bundle_id: string | null;
  answers: SubmissionAnswer[];
  answers_count: number;
  graded_count: number;
  graded_total: number;
  fully_graded: boolean;
}

export interface SubmissionsData {
  count: number;
  subject: { id: string; code: string; name: string };
  exam_session: { id: string; name: string };
  bundle: BundleInfo | null;
  bundles: BundleInfo[];
  submissions: SubmissionRow[];
}

export interface LedgerBundle {
  id: string;
  name: string;
  status: BundleStatus;
  evaluator_name: string | null;
}

export interface LedgerResult {
  usn: string;
  student_name: string;
  cie_marks: number | null;
  see_marks: number | null;
  total_marks: number | null;
  grade: string | null;
}

export interface LedgerData {
  subject: { id: string; code: string; name: string };
  exam_session: { id: string; name: string };
  bundles: LedgerBundle[];
  status_counts: Record<string, number>;
  certified: boolean;
  dispatched: boolean;
  results_locked: boolean;
  results: LedgerResult[];
}
