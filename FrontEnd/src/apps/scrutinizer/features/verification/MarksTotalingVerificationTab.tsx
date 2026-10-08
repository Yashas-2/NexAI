import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import { errText, fetchOverview, fetchSubmissions } from '../../api';
import type { OverviewSubject, SubmissionsData, SubmissionRow } from '../../types';
import { statusMeta } from '../../statusMeta';

const answerState = (ans: SubmissionRow['answers'][number]) => {
  const answered = Boolean(ans.answer_text?.trim() || ans.answer_image_base64);
  if (ans.marks_awarded !== null) return { key: 'GRADED' as const, label: `Graded — ${ans.marks_awarded}/${ans.max_marks}`, color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' };
  if (!answered) return { key: 'UNANSWERED' as const, label: 'Unanswered', color: '#94A3B8', bg: '#F8FAFC', border: '#E2E8F0' };
  return { key: 'MISSING' as const, label: 'Marks missing', color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' };
};

const AnswerRow: React.FC<{ ans: SubmissionRow['answers'][number] }> = ({ ans }) => {
  const [showImage, setShowImage] = useState(false);
  const st = answerState(ans);
  return (
    <tr style={{ borderTop: '1px solid #F1F5F9' }}>
      <td style={{ padding: '8px 12px', fontWeight: 800 }}>
        {ans.question_label}
        <div style={{ fontSize: '0.7rem', fontWeight: 500, color: '#94A3B8', maxWidth: '340px' }}>
          {ans.question_text}
        </div>
      </td>
      <td style={{ padding: '8px 12px', fontWeight: 700 }}>{ans.max_marks}</td>
      <td style={{ padding: '8px 12px', fontWeight: 800 }}>
        {ans.marks_awarded !== null ? ans.marks_awarded : '—'}
      </td>
      <td style={{ padding: '8px 12px' }}>
        <span style={{
          padding: '2px 9px', borderRadius: '999px', fontSize: '0.7rem',
          fontWeight: 800, background: st.bg, color: st.color, border: `1px solid ${st.border}`,
        }}>
          {st.label}
        </span>
      </td>
      <td style={{ padding: '8px 12px', maxWidth: '320px' }}>
        <div style={{ fontSize: '0.72rem', color: '#475569' }}>
          {ans.answer_text
            || ans.extracted_text
            || <span style={{ color: '#94A3B8' }}>(no text answer)</span>}
        </div>
        {ans.answer_image_base64 && (
          <button
            onClick={() => setShowImage(v => !v)}
            style={{
              marginTop: '4px', padding: '3px 9px', borderRadius: '6px',
              border: '1px solid var(--color-border)', background: '#F8FAFC',
              fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}
          >
            <ImageIcon size={11} /> {showImage ? 'Hide' : 'View'} handwriting
          </button>
        )}
        {showImage && ans.answer_image_base64 && (
          <img
            src={ans.answer_image_base64}
            alt="answer"
            style={{ display: 'block', marginTop: '6px', maxWidth: '260px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
          />
        )}
      </td>
    </tr>
  );
};

export const MarksTotalingVerificationTab: React.FC = () => {
  const [subjects, setSubjects] = useState<OverviewSubject[]>([]);
  const [subjectKey, setSubjectKey] = useState('');
  const [data, setData] = useState<SubmissionsData | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    setError(null);
    try {
      const ov = await fetchOverview();
      setSubjects(ov.subjects);
      if (ov.subjects.length > 0) {
        setSubjectKey(prev => prev || `${ov.subjects[0].subject_id}|${ov.subjects[0].exam_session_id}`);
      }
    } catch (err) {
      const msg = errText(err, 'Failed to load courses');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  const loadSubmissions = useCallback(async (key: string) => {
    if (!key) return;
    const [subjectId, sessionId] = key.split('|');
    setLoading(true);
    setError(null);
    try {
      setData(await fetchSubmissions(subjectId, sessionId));
    } catch (err) {
      const msg = errText(err, 'Failed to load answer booklets');
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);
  useEffect(() => { loadSubmissions(subjectKey); }, [subjectKey, loadSubmissions]);

  const summary = useMemo(() => {
    const rows = data?.submissions ?? [];
    let fullyGraded = 0;
    let missingMarks = 0;
    let unanswered = 0;
    let totalMismatches = 0;
    let totalMarks = 0;
    for (const row of rows) {
      if (row.fully_graded) fullyGraded += 1;
      let clientSum = 0;
      for (const ans of row.answers) {
        const st = answerState(ans);
        if (st.key === 'MISSING') missingMarks += 1;
        if (st.key === 'UNANSWERED') unanswered += 1;
        if (ans.marks_awarded !== null) clientSum += Number(ans.marks_awarded);
      }
      if (Math.abs(clientSum - row.graded_total) > 0.001) totalMismatches += 1;
      totalMarks += row.graded_total;
    }
    return {
      booklets: rows.length,
      fullyGraded,
      awaitingGrading: rows.length - fullyGraded,
      missingMarks,
      unanswered,
      totalMismatches,
      totalMarks,
    };
  }, [data]);

  if (loadingSubjects) {
    return <div style={{ padding: '48px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading courses…</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* ── Subject Switcher ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        padding: '16px 22px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '14px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
            Course under verification:
          </span>
          <select
            value={subjectKey}
            onChange={e => setSubjectKey(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1.5px solid var(--color-border)', fontSize: '0.85rem', fontWeight: 800 }}
          >
            <option value="">— Select course —</option>
            {subjects.map(s => (
              <option key={`${s.subject_id}|${s.exam_session_id}`} value={`${s.subject_id}|${s.exam_session_id}`}>
                {s.subject_code} — {s.exam_session_name} ({s.received} booklets)
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => loadSubmissions(subjectKey)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
            borderRadius: '9px', border: '1.5px solid var(--color-border)', background: 'white',
            color: '#48977F', fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          <RefreshCw size={14} /> Reload
        </button>
      </div>

      {error && (
        <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '14px', padding: '16px 20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <AlertTriangle size={20} color="#D97706" />
          <div>
            <strong style={{ color: '#92400E', fontSize: '0.88rem' }}>Failed to load data</strong>
            <div style={{ fontSize: '0.78rem', color: '#B45309' }}>{error}</div>
          </div>
        </div>
      )}

      {/* ── Verification Summary ── */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Booklets Received', value: summary.booklets, color: '#3b82f6' },
            { label: 'Fully Graded', value: summary.fullyGraded, color: '#16a34a' },
            { label: 'Awaiting Grading', value: summary.awaitingGrading, color: summary.awaitingGrading > 0 ? '#C2410C' : '#64748B' },
            { label: 'Missing Marks', value: summary.missingMarks, color: summary.missingMarks > 0 ? '#C2410C' : '#64748B' },
            { label: 'Unanswered Questions', value: summary.unanswered, color: summary.unanswered > 0 ? '#D97706' : '#64748B' },
            { label: 'Incorrect Totaling', value: summary.totalMismatches, color: summary.totalMismatches > 0 ? '#E11D48' : '#64748B' },
          ].map((c, i) => (
            <div key={i} style={{
              background: 'white', borderRadius: '13px', border: `1px solid ${c.color}22`,
              borderTop: `4px solid ${c.color}`, padding: '14px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
              <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</p>
              <h3 style={{ margin: '4px 0 0 0', fontSize: '1.35rem', fontWeight: 900, color: c.color }}>{c.value}</h3>
            </div>
          ))}
        </div>
      )}

      {/* ── Bundle context ── */}
      {data && data.bundles.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--color-text-secondary)' }}>Bundles:</span>
          {data.bundles.map(b => (
            <span key={b.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px', borderRadius: '999px', fontSize: '0.76rem', fontWeight: 800,
              background: statusMeta[b.status]?.bg || '#F1F5F9',
              color: statusMeta[b.status]?.fg || '#475569',
              border: `1px solid ${statusMeta[b.status]?.border || '#CBD5E1'}`,
            }}>
              {b.name} — {statusMeta[b.status]?.label || b.status}
              <span style={{ fontWeight: 700, opacity: 0.8 }}>{b.booklets} booklets</span>
              {b.evaluator_name && <span style={{ fontWeight: 600, opacity: 0.8 }}>· {b.evaluator_name}</span>}
            </span>
          ))}
        </div>
      )}

      {/* ── Question-wise table ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1.5px solid var(--color-border)',
        overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '0.95rem' }}>
            Marks Totaling &amp; Verification — {data ? `${data.subject.code} · ${data.exam_session.name}` : 'Select a course'}
            {data ? ` · Total awarded: ${summary.totalMarks}` : ''}
          </strong>
        </div>

        {loading ? (
          <div style={{ padding: '44px', textAlign: 'center', color: '#64748B', fontWeight: 700 }}>Loading answer booklets…</div>
        ) : !data || data.submissions.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748B' }}>
            <ClipboardCheck size={26} style={{ margin: '0 auto 8px auto' }} />
            <div style={{ fontWeight: 800 }}>No completed answer booklets to verify</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
              Booklets appear here after students submit and the SEE attempt is locked.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead style={{ background: '#f8fafc', color: 'var(--color-text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
                <tr>
                  <th style={{ padding: '13px 20px' }}>USN</th>
                  <th style={{ padding: '13px 16px' }}>Student</th>
                  <th style={{ padding: '13px 16px' }}>Evaluator Status</th>
                  <th style={{ padding: '13px 16px' }}>Question Total</th>
                  <th style={{ padding: '13px 16px' }}>Missing Marks</th>
                  <th style={{ padding: '13px 16px' }}>Unanswered</th>
                  <th style={{ padding: '13px 16px' }}>Totaling Check</th>
                  <th style={{ padding: '13px 20px', textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map(row => {
                  const missing = row.answers.filter(a => answerState(a).key === 'MISSING').length;
                  const unans = row.answers.filter(a => answerState(a).key === 'UNANSWERED').length;
                  const clientSum = row.answers.reduce(
                    (acc, a) => acc + (a.marks_awarded !== null ? Number(a.marks_awarded) : 0), 0,
                  );
                  const mismatch = Math.abs(clientSum - row.graded_total) > 0.001;
                  const isOpen = expanded === row.attempt_id;

                  return (
                    <React.Fragment key={row.attempt_id}>
                      <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '13px 20px', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{row.student_usn}</td>
                        <td style={{ padding: '13px 16px' }}>
                          <div style={{ fontWeight: 700 }}>{row.student_name}</div>
                          {row.proctor_strikes > 0 && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#E11D48' }}>
                              ⚠ {row.proctor_strikes} proctor strike(s)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '13px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 800,
                            background: row.fully_graded ? '#ECFDF5' : '#FFF7ED',
                            color: row.fully_graded ? '#047857' : '#C2410C',
                            border: `1px solid ${row.fully_graded ? '#A7F3D0' : '#FED7AA'}`,
                          }}>
                            {row.graded_count}/{row.answers_count} {row.fully_graded ? '✓ submitted' : 'grading in progress'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', fontWeight: 800 }}>
                          {row.graded_total} marks
                          <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8' }}>
                            sum of questions: {clientSum}
                          </div>
                        </td>
                        <td style={{ padding: '13px 16px', fontWeight: 800, color: missing > 0 ? '#C2410C' : '#64748B' }}>{missing}</td>
                        <td style={{ padding: '13px 16px', fontWeight: 800, color: unans > 0 ? '#D97706' : '#64748B' }}>{unans}</td>
                        <td style={{ padding: '13px 16px' }}>
                          {mismatch ? (
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#E11D48' }}>
                              Mismatch ✗
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#047857' }}>Match ✓</span>
                          )}
                        </td>
                        <td style={{ padding: '13px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => setExpanded(isOpen ? null : row.attempt_id)}
                            style={{
                              padding: '6px 12px', background: isOpen ? '#EEF2FF' : '#F8FAFC',
                              border: `1.5px solid ${isOpen ? '#C7D2FE' : 'var(--color-border)'}`,
                              color: isOpen ? '#4338CA' : 'var(--color-text-primary)',
                              borderRadius: '7px', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                            }}
                          >
                            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            Question-wise
                          </button>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr style={{ borderBottom: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                          <td colSpan={8} style={{ padding: '14px 20px' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.8rem', marginBottom: '10px', color: '#334155' }}>
                              Question-wise marks — {row.student_usn}
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                              <thead>
                                <tr style={{ background: '#F1F5F9', textAlign: 'left' }}>
                                  <th style={{ padding: '8px 12px', fontWeight: 800, color: '#64748B' }}>Question</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 800, color: '#64748B' }}>Max</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 800, color: '#64748B' }}>Awarded</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 800, color: '#64748B' }}>Status</th>
                                  <th style={{ padding: '8px 12px', fontWeight: 800, color: '#64748B' }}>Answer</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.answers.map(ans => (
                                  <AnswerRow key={ans.answer_id} ans={ans} />
                                ))}
                              </tbody>
                            </table>

                            <div style={{ marginTop: '10px', fontSize: '0.74rem', fontWeight: 700, color: mismatch ? '#E11D48' : '#047857', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {mismatch
                                ? <><AlertTriangle size={13} /> Incorrect totaling: recorded {row.graded_total}, question sum {clientSum}</>
                                : <><CheckCircle2 size={13} /> Totaling correct: question-wise sum equals recorded total ({row.graded_total})</>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
