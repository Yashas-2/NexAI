import React, { useState, useEffect } from 'react';
import { WizardStepper } from './wizard/WizardStepper';
import { Step1ScopeSchedule } from './wizard/steps/Step1ScopeSchedule';
import { Step2SubjectMatrix } from './wizard/steps/Step2SubjectMatrix';
import { Step3HallConfiguration } from './wizard/steps/Step3HallConfiguration';
import { Step4InvigilatorRoster } from './wizard/steps/Step4InvigilatorRoster';
import { Step5AIEngineConsole } from './wizard/steps/Step5AIEngineConsole';

import {
  SessionScopeConfig,
  SubjectExam,
  ExamHall,
  FacultyInvigilator,
  RoomAllocationResult,
  AITelemetryMetrics,
  SemesterNumber,
  TimeSlot,
} from '../types/allocationTypes';

import { api } from '@/services/api';
import { generateTimetableDates } from '../services/aiAllocationEngine';

// Standard exam time slots (must match Step1ScopeSchedule.tsx)
const STANDARD_TIME_SLOTS: TimeSlot[] = [
  { id: 'SLOT_M1', name: 'Morning Forenoon Slot (M1)', startTime: '09:30 AM', endTime: '12:30 PM', sessionPeriod: 'FORENOON' },
  { id: 'SLOT_A1', name: 'Afternoon Post-Meridiem Slot (A1)', startTime: '02:00 PM', endTime: '05:00 PM', sessionPeriod: 'AFTERNOON' },
];

interface AllocationWizardProps {
  sessionId?: string;
  onCompleteAllocation: (
    results: RoomAllocationResult[],
    telemetry: AITelemetryMetrics,
    scope: SessionScopeConfig
  ) => void;
  onCancel: () => void;
}

export const AllocationWizard: React.FC<AllocationWizardProps> = ({
  sessionId: propSessionId,
  onCompleteAllocation,
  onCancel: _onCancel,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [createdSessionId, setCreatedSessionId] = useState<string | undefined>(propSessionId);
  const [savingSession, setSavingSession] = useState(false);

  const [availableSubjects, setAvailableSubjects] = useState<SubjectExam[]>([]);
  const [availableRooms, setAvailableRooms] = useState<ExamHall[]>([]);
  const [availableFaculty, setAvailableFaculty] = useState<FacultyInvigilator[]>([]);

  // Dept color palette
  const DEPT_COLORS = ['#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#ef4444', '#f97316'];

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch all reference data in parallel
        const [subRes, roomRes, facRes, deptRes] = await Promise.all([
          api.get('/scheduling/subjects/'),
          api.get('/scheduling/rooms/'),
          api.get('/auth/users/?role=FACULTY'),
          api.get('/auth/departments/')
        ]);

        const subData = subRes.data.results || subRes.data;
        const roomData = roomRes.data.results || roomRes.data;
        const facData = facRes.data.results || facRes.data;
        const deptData = deptRes.data.results || deptRes.data;

        // Map departments with colors
        const deptList = deptData.map((d: any, i: number) => ({
          ...d,
          color: DEPT_COLORS[i % DEPT_COLORS.length],
          prefix: d.usn_prefix || `1RV${d.code}`,
          hodName: d.hod_name || '',
        }));
        setDepartments(deptList);

        // Build a dept color map for subjects
        const deptColorMap: Record<string, string> = {};
        deptList.forEach((d: any) => { deptColorMap[d.code] = d.color; });

        // Always fetch from backend for COE to get cross-department records
        let localEligibilityRecords: any[] = [];
        try {
          const eligRes = await api.get('/eligibility/records/');
          localEligibilityRecords = eligRes.data.results || eligRes.data || [];
        } catch (e) {
          console.error("Failed to load eligibility records:", e);
        }

        const mappedSubs: SubjectExam[] = subData.map((s: any) => {
          const subEligibilityRecords = localEligibilityRecords.filter((rec: any) => 
            (rec.subjectCode || rec.subject_code || '').toLowerCase().trim() === (s.code || '').toLowerCase().trim()
          );

          let eligibleCount = 0;
          if (subEligibilityRecords.length > 0) {
            eligibleCount = subEligibilityRecords.filter((rec: any) => {
              const isAttCleared = rec.status === 'ELIGIBLE' || (rec.status === 'CONDONABLE' && rec.condonationApproved) || rec.is_eligible === true;
              if (!isAttCleared) return false;
              if (rec.status === 'FEE_BLOCKED' || rec.hasFeeDues) return false;
              if ((rec.cieMarksAvg ?? rec.cie_marks ?? 50) < 20) return false;
              return true;
            }).length;
          } else {
            eligibleCount = s.enrolled_students ?? 30;
          }

          return {
            code: s.code,
            title: s.name,
            deptCode: s.department_code || '',
            semester: s.semester as SemesterNumber,
            credits: s.credits || 4,
            color: deptColorMap[s.department_code] || '#6366f1',
            eligibleStudents: eligibleCount,
          };
        });

        const mappedRooms: ExamHall[] = roomData.map((r: any) => ({
          id: String(r.id),
          roomNumber: r.name,
          building: r.building || '',
          floor: r.floor ?? 0,
          capacity: r.exam_capacity || r.total_capacity || 40,
          cols: 5,
          hasAisle: true,
          isAccessiblePWD: (r.floor ?? 0) === 0,
          blockCode: r.building || 'MAIN',
        }));

        const mappedFac: FacultyInvigilator[] = facData.map((f: any) => ({
          id: String(f.id),
          name: f.full_name || f.email,
          department: f.department?.name || 'Central',
          designation: 'Assistant Professor' as const,
          email: f.email,
          phone: f.phone || '',
          historicalDutyCount: 0,
          currentCycleDuties: 0,
          maxDutyQuota: 4,
          isAvailable: f.is_active !== false,
          assignedDutyCount: 0,
        }));

        setAvailableSubjects(mappedSubs);
        setAvailableRooms(mappedRooms);
        setAvailableFaculty(mappedFac);

        // If we have a sessionId, fetch the existing session data to pre-fill
        const sessionIdToLoad = propSessionId || createdSessionId;
        if (sessionIdToLoad) {
          try {
            const sessionRes = await api.get(`/scheduling/sessions/${sessionIdToLoad}/`);
            const sessionData = sessionRes.data;

            // Map backend session data to frontend SessionScopeConfig
            const savedScopeConfig: SessionScopeConfig = {
              sessionName: sessionData.name || '',
              examType: 'SEE_REGULAR' as const,
              academicYear: sessionData.academic_year || new Date().getFullYear() + '-' + (new Date().getFullYear() + 1).toString().slice(2),
              selectedDepartments: sessionData.departments || [],
              selectedSemesters: (sessionData.semesters || []) as SemesterNumber[],
              examsPerDay: sessionData.exams_per_day || 1,
              startDate: sessionData.start_date || new Date().toISOString().split('T')[0],
              endDate: sessionData.end_date || sessionData.start_date || new Date().toISOString().split('T')[0],
              // Convert slot IDs back to full TimeSlot objects
              selectedSlots: (sessionData.selected_slots || [])
                .map((slotId: string) => STANDARD_TIME_SLOTS.find(s => s.id === slotId))
                .filter(Boolean) as TimeSlot[],
            };

            setScopeConfig(savedScopeConfig);

            // Pre-select subjects that are already in this session
            if (sessionData.subject_codes && sessionData.subject_codes.length > 0) {
              const preSelectedSubjects = mappedSubs.filter(s =>
                sessionData.subject_codes.includes(s.code)
              );
              setSelectedSubjects(preSelectedSubjects);
            }
          } catch (sessionErr) {
            console.warn('Could not load existing session data:', sessionErr);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('AllocationWizard data load error:', err);
        setLoading(false);
      }
    };

    loadData();
  }, [propSessionId]);

  // 1. Step 1: Scope & Schedule — start empty so user configures
  const [scopeConfig, setScopeConfig] = useState<SessionScopeConfig>({
    sessionName: '',
    examType: 'SEE_REGULAR',
    academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1).toString().slice(2),
    selectedDepartments: [],
    selectedSemesters: [],
    examsPerDay: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    selectedSlots: [],
  });

  // 2. Step 2: Subjects & Candidate Headcount
  const [selectedSubjects, setSelectedSubjects] = useState<SubjectExam[]>([]);

  // 3. Step 3: Exam Halls
  const [selectedRooms, setSelectedRooms] = useState<ExamHall[]>([]);

  // 4. Step 4: Faculty Invigilators
  const [facultyRoster, setFacultyRoster] = useState<FacultyInvigilator[]>([]);

  const handleScopeChange = (updated: Partial<SessionScopeConfig>) => {
    setScopeConfig(prev => ({ ...prev, ...updated }));
  };

  // Save selected subjects to the session when proceeding from Step 2 to Step 3
  const handleSubjectsSaved = async (subjects: SubjectExam[]) => {
    if (createdSessionId && subjects.length > 0) {
      try {
        const subjectCodes = subjects.map(s => s.code);
        await api.patch(`/scheduling/sessions/${createdSessionId}/`, {
          subject_codes: subjectCodes,
        });
      } catch (err) {
        console.warn('Failed to save subjects to session:', err);
      }
    }
  };

  // Called when user clicks "Continue to Subject Matrix" in Step 1
  // Creates or updates the ExamSession record in the backend
  const handleStep1Next = async () => {
    setSavingSession(true);
    try {
      const payload = {
        name: scopeConfig.sessionName,
        academic_year: scopeConfig.academicYear,
        start_date: scopeConfig.startDate || new Date().toISOString().split('T')[0],
        end_date: scopeConfig.endDate || scopeConfig.startDate || new Date().toISOString().split('T')[0],
        semesters: scopeConfig.selectedSemesters,
        departments: scopeConfig.selectedDepartments,
        semester: scopeConfig.selectedSemesters[0] || null,
        exams_per_day: scopeConfig.examsPerDay,
        selected_slots: scopeConfig.selectedSlots.map(s => s.id),
      };

      if (createdSessionId) {
        // Update existing session with PUT
        await api.put(`/scheduling/sessions/${createdSessionId}/`, payload);
      } else {
        // Create new session with POST
        const res = await api.post('/scheduling/sessions/', payload);
        setCreatedSessionId(res.data.id);
      }
    } catch (err) {
      console.warn('Session save failed (non-fatal):', err);
    } finally {
      setSavingSession(false);
      setCurrentStep(2);
    }
  };

  const handleSolveComplete = (
    results: RoomAllocationResult[],
    telemetry: AITelemetryMetrics
  ) => {
    // Persist the allocation results for the HOD portal to generate accurate Hall Tickets
    try {
      localStorage.setItem('nexai_timetable_slots', JSON.stringify(results));
    } catch (e) {
      console.error('Failed to save allocation results to local storage', e);
    }
    onCompleteAllocation(results, telemetry, scopeConfig);
  };

  const totalRequiredCandidates = selectedSubjects.reduce((sum, s) => sum + s.eligibleStudents, 0);

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚙️</div>
        <p style={{ fontWeight: 600 }}>Loading exam resources from server...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Visual Stepper */}
      <WizardStepper
        currentStep={currentStep}
        onStepClick={targetStep => {
          if (targetStep < currentStep) setCurrentStep(targetStep);
        }}
      />

      {/* Step Views */}
      {currentStep === 1 && (
        <Step1ScopeSchedule
          config={scopeConfig}
          departments={departments}
          onChange={handleScopeChange}
          onNext={handleStep1Next}
          saving={savingSession}
        />
      )}

      {currentStep === 2 && (
        <Step2SubjectMatrix
          scopeConfig={scopeConfig}
          availableSubjects={availableSubjects}
          selectedSubjects={selectedSubjects}
          onSubjectsChange={setSelectedSubjects}
          onNext={async () => {
            // Auto-generate timetable dates with 1-day gaps, skipping Sundays/Holidays
            const startDateStr = scopeConfig.startDate || new Date().toISOString().split('T')[0];
            const generatedDates = generateTimetableDates(startDateStr, selectedSubjects.length);
            
            const subjectsWithDates = selectedSubjects.map((subj, index) => ({
              ...subj,
              examDate: generatedDates[index]
            }));
            
            setSelectedSubjects(subjectsWithDates);

            // Save subjects to session before proceeding
            await handleSubjectsSaved(subjectsWithDates);
            setCurrentStep(3);
          }}
          onBack={() => setCurrentStep(1)}
        />
      )}
      {currentStep === 3 && (
        <Step3HallConfiguration
          availableRooms={availableRooms}
          selectedRooms={selectedRooms}
          onRoomsChange={setSelectedRooms}
          onNext={() => setCurrentStep(4)}
          onBack={() => setCurrentStep(2)}
          totalCandidates={totalRequiredCandidates}
        />
      )}
      {currentStep === 4 && (
        <Step4InvigilatorRoster
          availableFaculty={availableFaculty}
          facultyRoster={facultyRoster}
          onRosterChange={setFacultyRoster}
          onNext={() => setCurrentStep(5)}
          onBack={() => setCurrentStep(3)}
          requiredInvigilators={selectedRooms.length}
        />
      )}
      {currentStep === 5 && (
        <Step5AIEngineConsole
          sessionId={createdSessionId || ''}
          selectedSubjects={selectedSubjects}
          selectedRooms={selectedRooms}
          facultyRoster={facultyRoster}
          onBack={() => setCurrentStep(4)}
          onSolveComplete={handleSolveComplete}
        />
      )}
    </div>
  );
};
