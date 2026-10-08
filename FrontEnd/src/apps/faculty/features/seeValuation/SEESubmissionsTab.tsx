import React, { useState } from 'react';
import { SEESubmissionsPanel } from './SEESubmissionsPanel';
import { AssignedCourse } from '../../types';
import { BundleCodeEntry } from '../../components/BundleCodeEntry';
import { Key, Package } from 'lucide-react';

interface SEESubmissionsTabProps {
  courses: AssignedCourse[];
  selectedCourseCode: string;
  onSelectCourseCode: (code: string) => void;
  examSessionId?: string | null;
  onRedeemSuccess?: (bundle: {
    id: string;
    name: string;
    subject_code: string;
    subject_id: string;
    exam_session_name: string;
    exam_session: string;
    evaluator_name: string | null;
    access_code?: string;
  }) => void;
  redeemedBundle?: {
    id: string;
    name: string;
    subject_code: string;
    subject_id: string;
    exam_session_name: string;
    evaluator_name: string | null;
    access_code?: string;
  } | null;
}

export const SEESubmissionsTab: React.FC<SEESubmissionsTabProps> = ({
  courses,
  selectedCourseCode,
  onSelectCourseCode,
  examSessionId,
  onRedeemSuccess,
  redeemedBundle,
}) => {
  const course = courses.find(c => c.code === selectedCourseCode);
  const [showCodeEntry, setShowCodeEntry] = useState(false);

  // Check if the selected course has a redeemed bundle (evaluator mode)
  const isEvaluatorMode = !!redeemedBundle;
  const bundleId = redeemedBundle?.id;
  const bundleName = redeemedBundle?.name;
  const bundleAccessCode = redeemedBundle?.access_code;
  const bundleSubjectId = redeemedBundle?.subject_id ?? null;

  // In evaluator mode, use bundle's subject_id; otherwise use selected course
  const effectiveSubjectId = isEvaluatorMode && bundleSubjectId ? bundleSubjectId : course?.id;

  if (courses.length === 0) {
    return (
      <BundleCodeEntry onRedeemSuccess={onRedeemSuccess!} />
    );
  }

  return (
    <div>
      {/* Course selector + Bundle code entry button */}
      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center',
      }}>
        {courses.map(c => {
          const active = c.code === selectedCourseCode;
          return (
            <button
              key={c.code}
              onClick={() => onSelectCourseCode(c.code)}
              style={{
                padding: '8px 16px', borderRadius: '999px', cursor: 'pointer',
                border: active ? '1.5px solid #48977F' : '1.5px solid #E2E8F0',
                background: active ? 'linear-gradient(135deg, #48977F 0%, #2F6852 100%)' : 'white',
                color: active ? 'white' : '#334155',
                fontWeight: 800, fontSize: '0.82rem',
              }}
            >
              {c.code}
            </button>
          );
        })}
        {!isEvaluatorMode && (
          <button
            onClick={() => setShowCodeEntry(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '999px', cursor: 'pointer',
              border: '1.5px dashed #94A3B8', background: 'transparent',
              color: '#475569', fontWeight: 700, fontSize: '0.82rem',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#48977F'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#94A3B8'}
          >
            <Key size={16} /> Enter Bundle Code
          </button>
        )}
        {isEvaluatorMode && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '999px',
            background: '#ECFDF5', border: '1.5px solid #A7F3D0',
            color: '#047857', fontWeight: 700, fontSize: '0.82rem',
          }}>
            <Package size={16} /> {bundleName}
          </span>
        )}
      </div>

      {showCodeEntry && !isEvaluatorMode && (
        <div style={{ marginBottom: '16px' }}>
          <BundleCodeEntry
            onRedeemSuccess={(bundle) => {
              onRedeemSuccess?.(bundle);
              setShowCodeEntry(false);
            }}
          />
        </div>
      )}

      {effectiveSubjectId ? (
        <SEESubmissionsPanel
          subjectId={effectiveSubjectId}
          examSessionId={examSessionId}
          canDistribute={!isEvaluatorMode}
          isEvaluatorMode={isEvaluatorMode}
          bundleId={bundleId}
          bundleName={bundleName}
          bundleAccessCode={bundleAccessCode}
        />
      ) : (
        <div style={{
          background: 'white', borderRadius: '16px', border: '1.5px dashed #CBD5E1',
          padding: '36px', textAlign: 'center', color: '#64748B', fontWeight: 700,
        }}>
          Select a course to view its SEE submissions.
        </div>
      )}
    </div>
  );
};
