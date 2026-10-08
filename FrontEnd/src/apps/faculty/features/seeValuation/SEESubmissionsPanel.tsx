import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import {
  Users,
  Send,
  Save,
  ChevronDown,
  ChevronUp,
  Award,
  BookOpen,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

interface SEEAnswerRow {
  answer_id: string;
  question_id: string;
  question_label: string;
  question_text: string;
  max_marks: number;
  answer_text: string;
  answer_image_base64: string;
  extracted_text: string;
  marks_awarded: string | number | null;
}

interface SEESubmissionRow {
  attempt_id: string;
  student_usn: string;
  student_name: string;
  submitted_at: string | null;
  proctor_strikes: number;
  answers: SEEAnswerRow[];
  answers_count: number;
  graded_count: number;
  graded_total: number;
  fully_graded: boolean;
}

interface SEEFormData {
  count: number;
  subject: { id: string; code: string; name: string };
  exam_session: { id: string; name: string };
  bundle: {
    id: string;
    name: string;
    status: string;
    evaluator_id: string | null;
    evaluator_name: string | null;
  } | null;
  submissions: SEESubmissionRow[];
}

interface EvaluatorOption {
  id: string;
  full_name: string;
  email: string;
}

interface SEESubmissionsPanelProps {
  subjectId: string;
  examSessionId?: string | null;
  canDistribute?: boolean;
  isEvaluatorMode?: boolean;
  bundleId?: string | null;
  bundleName?: string;
  bundleAccessCode?: string;
}

const errText = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { error?: string; detail?: string } }; message?: string };
  return e?.response?.data?.error || e?.response?.data?.detail || e?.message || fallback;
};

export const SEESubmissionsPanel: React.FC<SEESubmissionsPanelProps> = ({
  subjectId,
  examSessionId,
  canDistribute = false,
  isEvaluatorMode = false,
  bundleId,
  bundleName,
  bundleAccessCode,
}) => {
  const [data, setData] = useState<SEEFormData | null>(null);
  const [evaluators, setEvaluators] = useState<EvaluatorOption[]>([]);
  const [selectedEvaluator, setSelectedEvaluator] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [openImages, setOpenImages] = useState<Record<string, boolean>>({});
  const [marksDrafts, setMarksDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [distributing, setDistributing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { subject: subjectId };
      if (examSessionId) params.exam_session = examSessionId;
      if (bundleId) params.bundle = bundleId;
      const res = await api.get('/student/see/submissions/', { params });
      setData(res.data);
    } catch (err) {
      const msg = errText(err, 'Failed to load SEE submissions');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [subjectId, examSessionId, bundleId]);

  useEffect(() => {
    if (subjectId) load();
  }, [load, subjectId]);

  useEffect(() => {
    if (!canDistribute) return;
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/student/see/evaluators/');
        if (alive) setEvaluators(Array.isArray(res.data) ? res.data : []);
      } catch {
        // pick list is non-critical; distribute will surface its own errors
      }
    })();
    return () => {
      alive = false;
    };
  }, [canDistribute]);

  const saveGrade = async (answerId: string) => {
    const raw = marksDrafts[answerId];
    const value = Number(raw);
    if (raw === undefined || raw === '' || isNaN(value) || value < 0) {
      toast.error('Enter valid marks (0 or more)');
      return;
    }
    // Find the answer to validate against max_marks
    const answer = data?.submissions.flatMap(s => s.answers).find(a => a.answer_id === answerId);
    if (answer && value > answer.max_marks) {
      toast.error(`Marks cannot exceed maximum ${answer.max_marks}`);
      return;
    }
    setSavingId(answerId);
    try {
      const res = await api.post('/student/see/grade_answer/', {
        answer_id: answerId,
        marks_awarded: value,
      });
      const total = res.data?.see_marks_total;
      setData(prev => {
        if (!prev) return prev;
        const submissions = prev.submissions.map(sub => {
          const answers = sub.answers.map(a =>
            a.answer_id === answerId ? { ...a, marks_awarded: value } : a
          );
          const graded = answers.filter(a => a.marks_awarded !== null);
          return {
            ...sub,
            answers,
            graded_count: graded.length,
            graded_total: graded.reduce((s, a) => s + Number(a.marks_awarded || 0), 0),
            fully_graded: answers.length > 0 && graded.length === answers.length,
          };
        });
        return { ...prev, submissions };
      });
      toast.success(`Marks saved — attempt total ${total ?? value}`);
    } catch (err) {
      toast.error(errText(err, 'Failed to save marks'));
    } finally {
      setSavingId(null);
    }
  };

  const distribute = async () => {
    if (!selectedEvaluator) {
      toast.error('Select an evaluator first');
      return;
    }
    if (!data) return;
    setDistributing(true);
    try {
      const sessionId = examSessionId || data.exam_session?.id;
      if (data.bundle) {
        await api.patch(`/evaluation/bundles/${data.bundle.id}/`, {
          evaluator: selectedEvaluator,
        });
      } else {
        await api.post('/evaluation/bundles/', {
          name: `SEE Valuation - ${data.subject.code} - ${data.exam_session.name}`,
          subject: subjectId,
          exam_session: sessionId,
          evaluator: selectedEvaluator,
        });
      }
      toast.success('Valuation distributed to evaluator');
      await load();
    } catch (err) {
      toast.error(errText(err, 'Failed to distribute valuation'));
    } finally {
      setDistributing(false);
    }
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>
        Loading SEE submissions…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{
        background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '14px',
        padding: '24px', textAlign: 'center',
      }}>
        <p style={{ margin: '0 0 12px 0', color: '#B91C1C', fontWeight: 800 }}>{error}</p>
        <button
          onClick={load}
          style={{
            padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
            background: '#B91C1C', color: 'white', fontWeight: 800,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const totalAnswers = data.submissions.reduce((s, x) => s + x.answers_count, 0);
  const totalGraded = data.submissions.reduce((s, x) => s + x.graded_count, 0);

  const statCard = (label: string, value: React.ReactNode, icon: React.ReactNode, accent: string) => (
    <div style={{
      flex: 1, minWidth: '200px', background: 'white', borderRadius: '14px',
      border: '1.5px solid #E2E8F0', padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: '14px',
      boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '12px', background: `${accent}18`,
        color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      </div>
    </div>
  );

  return (
    <div>
      {/* ── Evaluator Mode Header ── */}
      {isEvaluatorMode && bundleName && (
        <div style={{
          background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
          border: '1.5px solid #C7D2FE', borderRadius: '14px',
          padding: '16px 20px', marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '0.85rem', color: '#3730A3' }}>
                Bundle: {bundleName}
              </span>
              {bundleAccessCode && (
                <span style={{
                  background: '#4F46E5', color: 'white', padding: '2px 10px',
                  borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800,
                  fontFamily: 'monospace', letterSpacing: '0.5px',
                }}>
                  Code: {bundleAccessCode}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.76rem', color: '#5B21B6', fontWeight: 700 }}>
              Evaluator Dashboard — Grade answer scripts and save marks
            </span>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {statCard('Submissions', data.count, <FileText size={20} />, '#48977F')}
        {statCard('Answers graded', `${totalGraded} / ${totalAnswers}`, <Award size={20} />, '#4F46E5')}
        {!isEvaluatorMode && statCard(
          'Distributed to',
          data.bundle?.evaluator_name || 'Not distributed',
          <Users size={20} />,
          data.bundle?.evaluator_name ? '#059669' : '#F59E0B'
        )}
      </div>

      {/* ── Distribution (faculty/coordinator only) ── */}
      {!isEvaluatorMode && canDistribute && (
        <div style={{
          background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0',
          padding: '18px 20px', marginBottom: '16px',
          boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Send size={18} color="#48977F" />
            <span style={{ fontWeight: 900, fontSize: '0.92rem', color: '#0F172A' }}>
              Distribute Valuation to Evaluator
            </span>
            {data.bundle && (
              <span style={{
                background: '#ECFDF5', color: '#047857', padding: '2px 10px',
                borderRadius: '999px', fontSize: '0.72rem', fontWeight: 800,
                border: '1px solid #A7F3D0',
              }}>
                {data.bundle.status} → {data.bundle.evaluator_name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={selectedEvaluator}
              onChange={e => setSelectedEvaluator(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '10px', border: '2px solid #CBD5E1',
                fontSize: '0.88rem', fontWeight: 700, minWidth: '260px', background: 'white',
              }}
            >
              <option value="">
                {evaluators.length ? 'Select evaluator…' : 'No evaluators found (create an EVALUATOR user)'}
              </option>
              {evaluators.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.full_name} — {ev.email}
                </option>
              ))}
            </select>
            <button
              onClick={distribute}
              disabled={distributing || !selectedEvaluator}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: distributing || !selectedEvaluator ? '#94A3B8' : 'linear-gradient(135deg, #48977F 0%, #2F6852 100%)',
                color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px',
                fontWeight: 800, fontSize: '0.86rem',
                cursor: distributing || !selectedEvaluator ? 'not-allowed' : 'pointer',
              }}
            >
              <Send size={15} />
              {distributing ? 'Distributing…' : data.bundle ? 'Reassign Evaluator' : 'Distribute to Evaluator'}
            </button>
          </div>
        </div>
      )}

      {/* ── Submissions ── */}
      {data.submissions.length === 0 && (
        <div style={{
          background: 'white', borderRadius: '14px', border: '1.5px dashed #CBD5E1',
          padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 700,
        }}>
          No submitted SEE attempts for {data.subject.code} yet — answers appear here
          the moment students submit from the exam kiosk.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.submissions.map(sub => {
          const expanded = expandedId === sub.attempt_id;
          return (
            <div key={sub.attempt_id} style={{
              background: 'white', borderRadius: '14px', border: '1.5px solid #E2E8F0',
              overflow: 'hidden', boxShadow: '0 4px 14px rgba(15,23,42,0.05)',
            }}>
              <button
                onClick={() => setExpandedId(expanded ? null : sub.attempt_id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 18px', background: 'white', border: 'none', cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '12px', background: '#EEF2FF',
                  color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 900, fontSize: '0.8rem',
                }}>
                  {sub.student_usn.slice(-2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.92rem' }}>
                    {sub.student_name}
                    <span style={{ color: '#64748B', fontWeight: 700, marginLeft: '8px', fontSize: '0.8rem' }}>
                      {sub.student_usn}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 700 }}>
                    Submitted {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                    {sub.proctor_strikes > 0 && (
                      <span style={{ color: '#DC2626' }}> • {sub.proctor_strikes} proctor strike{sub.proctor_strikes > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <span style={{
                  background: sub.fully_graded ? '#ECFDF5' : '#FFF7ED',
                  color: sub.fully_graded ? '#047857' : '#C2410C',
                  border: `1px solid ${sub.fully_graded ? '#A7F3D0' : '#FED7AA'}`,
                  padding: '4px 12px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                }}>
                  {sub.graded_count}/{sub.answers_count} graded • {sub.graded_total} marks
                </span>
                {expanded ? <ChevronUp size={18} color="#64748B" /> : <ChevronDown size={18} color="#64748B" />}
              </button>

              {expanded && (
                <div style={{ borderTop: '1px solid #F1F5F9', padding: '14px 18px', background: '#F8FAFC' }}>
                  {sub.answers.map(ans => {
                    const imgOpen = !!openImages[ans.answer_id];
                    const draft = marksDrafts[ans.answer_id] ?? (ans.marks_awarded !== null ? String(ans.marks_awarded) : '');
                    return (
                      <div key={ans.answer_id} style={{
                        background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0',
                        padding: '14px 16px', marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{
                            background: '#4F46E5', color: 'white', padding: '3px 10px',
                            borderRadius: '8px', fontSize: '0.78rem', fontWeight: 900,
                          }}>
                            {ans.question_label}
                          </span>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#64748B' }}>
                            max {ans.max_marks}M
                          </span>
                          <span style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 600, flex: 1, minWidth: '200px' }}>
                            {ans.question_text}
                          </span>
                        </div>

                        {ans.answer_text && (
                          <div style={{
                            background: '#F8FAFC', borderRadius: '8px', padding: '10px 12px',
                            fontSize: '0.84rem', color: '#1E293B', whiteSpace: 'pre-wrap',
                            border: '1px solid #E2E8F0', marginBottom: '8px',
                          }}>
                            {ans.answer_text}
                          </div>
                        )}

{ans.answer_image_base64 && (
                            <div style={{ marginBottom: '8px' }}>
                              <button
                                onClick={() => setOpenImages(prev => ({ ...prev, [ans.answer_id]: !imgOpen }))}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                                  background: '#EEF2FF', color: '#4338CA', border: 'none',
                                  padding: '6px 12px', borderRadius: '8px', fontWeight: 800,
                                  fontSize: '0.76rem', cursor: 'pointer',
                                }}
                              >
                                <ImageIcon size={14} />
                                {imgOpen ? 'Hide handwritten page' : 'View handwritten page'}
                              </button>
                              {imgOpen && (
                                <div style={{ marginTop: '8px' }}>
                                  <img
                                    src={ans.answer_image_base64.startsWith('data:') ? ans.answer_image_base64 : `data:image/jpeg;base64,${ans.answer_image_base64}`}
                                    alt={`Handwritten answer ${ans.question_label}`}
                                    style={{
                                      maxWidth: '100%', maxHeight: 380, borderRadius: '10px',
                                      border: '1.5px solid #CBD5E1', display: 'block',
                                    }}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.nextElementSibling;
                                      if (fallback) fallback.style.display = 'block';
                                    }}
                                  />
                                  <div style={{
                                    display: 'none', marginTop: '8px', padding: '16px',
                                    background: '#FEF2F2', border: '1px solid #FECACA',
                                    borderRadius: '8px', color: '#B91C1C', textAlign: 'center',
                                  }}>
                                    Unable to load handwritten image. The image data may be corrupted or in an unsupported format.
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                        {ans.extracted_text && (
                          <details style={{ marginBottom: '8px' }}>
                            <summary style={{
                              fontSize: '0.76rem', fontWeight: 800, color: '#64748B',
                              cursor: 'pointer',
                            }}>
                              OCR extracted text
                            </summary>
                            <div style={{
                              fontSize: '0.8rem', color: '#475569', background: '#F8FAFC',
                              borderRadius: '8px', padding: '8px 10px', marginTop: '6px',
                              whiteSpace: 'pre-wrap',
                            }}>
                              {ans.extracted_text}
                            </div>
                          </details>
                        )}

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0F172A' }}>
                            Marks (/{ans.max_marks}):
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={ans.max_marks}
                            step={0.5}
                            value={draft}
                            onChange={e =>
                              setMarksDrafts(prev => ({ ...prev, [ans.answer_id]: e.target.value }))
                            }
                            style={{
                              width: '90px', padding: '8px 10px', borderRadius: '8px',
                              border: '2px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800,
                            }}
                          />
                          <button
                            onClick={() => saveGrade(ans.answer_id)}
                            disabled={savingId === ans.answer_id}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '6px',
                              background: savingId === ans.answer_id ? '#94A3B8' : '#48977F',
                              color: 'white', border: 'none', padding: '8px 16px',
                              borderRadius: '8px', fontWeight: 800, fontSize: '0.8rem',
                              cursor: savingId === ans.answer_id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Save size={14} />
                            {savingId === ans.answer_id ? 'Saving…' : 'Save'}
                          </button>
                          {ans.marks_awarded !== null && (
                            <span style={{
                              background: '#ECFDF5', color: '#047857', padding: '4px 10px',
                              borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                              border: '1px solid #A7F3D0',
                            }}>
                              Awarded {ans.marks_awarded}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px',
        fontSize: '0.76rem', color: '#64748B', fontWeight: 700,
      }}>
        <BookOpen size={14} />
        {data.subject.code} — {data.subject.name} • {data.exam_session.name} • graded marks sync
        automatically into each student's result ledger.
      </div>
    </div>
  );
};
