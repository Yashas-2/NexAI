import { QuestionPaperSet, VaultSubject, SessionKeyData } from './types';

export const INITIAL_SUBJECTS: VaultSubject[] = [];

export const INITIAL_PAPERS: QuestionPaperSet[] = [];

export const MOCK_SESSION_KEYS: Record<string, SessionKeyData> = {
  'CS201': {
    keyId: 'KEY-2026-CS201-9981',
    subjectCode: 'CS201',
    algorithm: 'AES-256-GCM + CRYSTALS-Dilithium3 Signature',
    generatedAt: '2026-08-31 11:20 IST',
    expiresAt: '2026-10-15 13:30 IST',
    unlockTimestamp: '2026-10-15 09:30 IST (30 mins before exam)',
    thresholdQuorum: {
      required: 2,
      total: 3,
      signed: ['Controller of Examinations', 'Chief Superintendent'],
    },
    keyFingerprint: '9E:B4:7C:11:8A:2F:90:3D:5E:21:44:BC:77:E1:60:FA',
    isUnlocked: false,
  },
  'CS301': {
    keyId: 'KEY-2026-CS301-7712',
    subjectCode: 'CS301',
    algorithm: 'AES-256-GCM + CRYSTALS-Dilithium3 Signature',
    generatedAt: '2026-08-30 09:15 IST',
    expiresAt: '2026-10-18 13:30 IST',
    unlockTimestamp: '2026-10-18 09:30 IST',
    thresholdQuorum: {
      required: 2,
      total: 3,
      signed: ['Controller of Examinations', 'Chief Superintendent', 'University Observer'],
    },
    keyFingerprint: '4A:77:2C:99:0B:E1:5D:88:3F:12:9A:CD:E4:01:88:1C',
    isUnlocked: true,
  },
};
