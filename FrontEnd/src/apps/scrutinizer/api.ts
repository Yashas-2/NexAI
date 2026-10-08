import { api } from '@/services/api';
import type {
  ApiBundle,
  LedgerData,
  OverviewData,
  SubmissionsData,
} from './types';

export const errText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
};

export const fetchOverview = async (): Promise<OverviewData> => {
  const res = await api.get('/evaluation/bundles/overview/');
  return res.data;
};

export const createBundles = async (payload: {
  subject_id: string;
  exam_session_id: string;
  bundle_size: number;
}) => {
  const res = await api.post('/evaluation/bundles/create_from_attempts/', payload);
  return res.data as {
    message: string;
    bundles_created: number;
    booklets_bundled: number;
    bundles: ApiBundle[];
  };
};

export const fetchBundles = async (): Promise<ApiBundle[]> => {
  const res = await api.get('/evaluation/bundles/');
  const raw = res.data;
  return Array.isArray(raw) ? raw : raw?.results || [];
};

export const fetchEvaluators = async () => {
  const res = await api.get('/student/see/evaluators/');
  const raw = res.data;
  return (Array.isArray(raw) ? raw : raw?.results || []) as {
    id: string;
    full_name: string;
    email: string;
  }[];
};

export const assignEvaluator = async (bundleId: string, evaluatorId: string) => {
  const res = await api.post(`/evaluation/bundles/${bundleId}/assign_evaluator/`, {
    evaluator_id: evaluatorId,
  });
  return res.data;
};

export const bundleAction = async (bundleId: string, action: string) => {
  const res = await api.post(`/evaluation/bundles/${bundleId}/${action}/`, {});
  return res.data;
};

export const fetchSubmissions = async (
  subjectId: string,
  examSessionId?: string,
): Promise<SubmissionsData> => {
  const params: Record<string, string> = { subject: subjectId };
  if (examSessionId) params.exam_session = examSessionId;
  const res = await api.get('/student/see/submissions/', { params });
  return res.data;
};

export const fetchLedger = async (
  subjectId: string,
  examSessionId: string,
): Promise<LedgerData> => {
  const res = await api.get('/evaluation/results/ledger/', {
    params: { subject: subjectId, exam_session: examSessionId },
  });
  return res.data;
};

export const certifyLedger = async (subjectId: string, examSessionId: string) => {
  const res = await api.post('/evaluation/results/certify/', {
    subject_id: subjectId,
    exam_session_id: examSessionId,
  });
  return res.data as { message: string; certified: number };
};

export const dispatchLedger = async (subjectId: string, examSessionId: string) => {
  const res = await api.post('/evaluation/results/dispatch/', {
    subject_id: subjectId,
    exam_session_id: examSessionId,
  });
  return res.data as {
    message: string;
    bundles_dispatched: number;
    results_created: number;
    results_updated: number;
  };
};
