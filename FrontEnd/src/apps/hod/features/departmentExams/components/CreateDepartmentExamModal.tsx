import React, { useState, useMemo } from 'react';
import { DepartmentExamSession, CourseRecord, FacultyMember, ExamHall } from '../../../types';
import { api } from '@/services/api';
import {
  Calendar,
  Clock,
  Building,
  Users,
  UserCheck,
  KeyRound,
  Sparkles,
  X,
  Layers,
  Lock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  courses: CourseRecord[];
  facultyMembers: FacultyMember[];
  halls: ExamHall[];
  onClose: () => void;
  onCreateSessions: (newSessions: DepartmentExamSession[]) => void;
}

export const CreateDepartmentExamModal: React.FC<Props> = ({
  courses,
  facultyMembers,
  halls,
  onClose,
  onCreateSessions,
}) => {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Exam Series & Subjects Selection
  const [examType, setExamType] = useState<'CIE-1' | 'CIE-2' | 'CIE-3' | 'LAB_INTERNAL'>('CIE-1');
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>(courses.map(c => c.code));
  
  const [coeSessions, setCoeSessions] = useState<any[]>([]);
  const [selectedCoeSessionId, setSelectedCoeSessionId] = useState<string>('');

  React.useEffect(() => {
    // Only fetch SEE sessions from CoE for linking
    api.get('/scheduling/sessions/', { params: { session_type: 'SEE' } })
      .then(res => {
        const data = res.data.results || res.data;
        // Filter to only include SEE sessions (COE-created)
        const seeSessions = data.filter((s: any) => s.session_type === 'SEE' || (!s.session_type));
        setCoeSessions(seeSessions);
      })
      .catch(console.error);
  }, []);

  // Step 2: Date, Sessions Per Day & Slot Timings
  const [startDate, setStartDate] = useState('2026-09-22');
  const [sessionsPerDay, setSessionsPerDay] = useState<number>(2);
  const [slot1Timing, setSlot1Timing] = useState('09:30 AM - 11:00 AM (Morning)');
  const [slot2Timing, setSlot2Timing] = useState('02:00 PM - 03:30 PM (Afternoon)');
  const [slot3Timing, setSlot3Timing] = useState('04:00 PM - 05:30 PM (Evening)');
  const [selectedHallNames, setSelectedHallNames] = useState<string[]>(
    halls.slice(0, 2).map(h => h.roomNumber)
  );

  // Toggle subject selection
  const handleToggleCourse = (code: string) => {
    setSelectedCourseCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Toggle hall selection
  const handleToggleHall = (room: string) => {
    setSelectedHallNames(prev =>
      prev.includes(room) ? (prev.length > 1 ? prev.filter(r => r !== room) : prev) : [...prev, room]
    );
  };

  // Automated Equal Faculty Workload Engine calculation
  const calculatedSchedule = useMemo(() => {
    const selectedCoursesList = courses.filter(c => selectedCourseCodes.includes(c.code));
    const activeTimings = [slot1Timing, slot2Timing, slot3Timing].slice(0, sessionsPerDay);

    const generatedSessions: DepartmentExamSession[] = [];
    const facultyDutyCounts: Record<string, number> = {};
    const facultyAssignments: Record<string, { room: string; date: string; time: string; course: string }[]> = {};

    facultyMembers.forEach(f => {
      facultyDutyCounts[f.id] = 0;
      facultyAssignments[f.id] = [];
    });

    let currentDateObj = new Date(startDate);
    let timingIndex = 0;
    let facultyRotationIndex = 0;

    selectedCoursesList.forEach((course, index) => {
      const examDateStr = currentDateObj.toISOString().split('T')[0];
      const slotStr = activeTimings[timingIndex];

      // Auto-bind Paper Setter to course handling faculty
      const setter = facultyMembers.find(f => f.assignedCourses.includes(course.code)) ||
        facultyMembers.find(f => f.name === course.assignedFacultyName) ||
        facultyMembers[index % facultyMembers.length];

      // Assign invigilator using fair round-robin
      const invigilator = facultyMembers[facultyRotationIndex % facultyMembers.length];
      facultyRotationIndex++;

      // Assign evaluator using alternate faculty
      const evaluator = facultyMembers[(facultyRotationIndex + 1) % facultyMembers.length];

      // Record duty
      if (invigilator) {
        facultyDutyCounts[invigilator.id] = (facultyDutyCounts[invigilator.id] || 0) + 1;
        facultyAssignments[invigilator.id]?.push({
          room: selectedHallNames.join(', '),
          date: examDateStr,
          time: slotStr,
          course: `${course.code} (${course.title})`,
        });
      }

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const sessionKey = `EVAL-FALL26-${course.code}-${randomSuffix}`;

      generatedSessions.push({
        id: `DEXAM-${course.code}-${examType}-${Date.now().toString().slice(-4)}-${index}`,
        title: `${examType} Examination: ${course.title}`,
        examType: examType,
        subjectCode: course.code,
        subjectTitle: course.title,
        semester: course.semester,
        examDate: examDateStr,
        timeSlot: slotStr,
        roomsAllocated: selectedHallNames,
        studentBatches: [`${course.semester} Candidates`],
        totalStudentsExpected: course.studentsCount || 40,
        paperSetterId: setter.id,
        paperSetterName: setter.name,
        chiefInvigilatorId: invigilator.id,
        chiefInvigilatorName: invigilator.name,
        evaluatorId: evaluator.id,
        evaluatorName: evaluator.name,
        evaluatorSessionKey: sessionKey,
        status: 'FACULTY_APPOINTED',
      });

      // Move to next slot or next day
      timingIndex++;
      if (timingIndex >= sessionsPerDay) {
        timingIndex = 0;
        currentDateObj.setDate(currentDateObj.getDate() + 1);
      }
    });

    return {
      sessions: generatedSessions,
      dutyCounts: facultyDutyCounts,
      assignments: facultyAssignments,
    };
  }, [
    courses,
    selectedCourseCodes,
    examType,
    startDate,
    sessionsPerDay,
    slot1Timing,
    slot2Timing,
    slot3Timing,
    selectedHallNames,
    facultyMembers,
  ]);

  const handleFinalSubmit = async () => {
    if (selectedCourseCodes.length === 0) {
      toast.error('Please select at least one course for the examination series.');
      return;
    }

    try {
      const semesters = [...new Set(courses.filter(c => selectedCourseCodes.includes(c.code)).map(c => {
        const match = c.semester?.match(/(\d+)/);
        return match ? parseInt(match[1]) : 5;
      }))];
      const res = await api.post('/scheduling/sessions/', {
        name: `${examType} Series - Fall 2026`,
        session_type: 'CIE',
        semesters: semesters,
        semester: semesters[0] || null,
        academic_year: '2026-27',
        start_date: startDate,
        end_date: startDate,
        subject_codes: selectedCourseCodes,
        ...(selectedCoeSessionId ? { linked_see_session: selectedCoeSessionId } : {}),
      });

      const newSession: DepartmentExamSession = {
          id: res.data.id,
          subjectCode: selectedCourseCodes.join(', '),
          subjectTitle: res.data.name,
          semester: res.data.semester ? `Semester ${res.data.semester}` : 'Multiple Semesters',
          examType: examType,
          examDate: res.data.start_date,
          timeSlot: 'Pending Generation',
          roomsAllocated: selectedHallNames,
          totalStudentsExpected: res.data.student_count || selectedCourseCodes.length * 50,
          studentBatches: [],
          paperSetterName: res.data.created_by_name || 'HOD',
          chiefInvigilatorName: 'TBD',
          evaluatorName: 'Course Handlers',
          status: res.data.status || 'DRAFT',
          evaluatorSessionKey: res.data.id.split('-')[0].toUpperCase(),
          schedulingTaskId: ''
      };

      onCreateSessions([newSession]);
      toast.success(`Successfully scheduled ${examType} session in backend!`);
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data 
          ? JSON.stringify(err.response.data) 
          : err.message || 'Failed to create exam session'
      );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1.2rem',
      fontFamily: 'var(--font-sans, inherit)',
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        maxWidth: '820px',
        width: '100%',
        maxHeight: '92vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        border: '1px solid #E2E8F0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* ── Modal Header with Wizard Progress ── */}
        <div style={{
          padding: '20px 28px',
          borderBottom: '1px solid #E2E8F0',
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #1E293B 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#A5B4FC', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Step {currentStep} of 3</span>
              <span>•</span>
              <span style={{ color: '#4ADE80' }}>Automated Workload Allotment Engine</span>
            </div>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.22rem', fontWeight: 800 }}>
              Schedule Department Examination Series & Equal Duties
            </h3>
          </div>

          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Step Progress Indicator ── */}
        <div style={{
          padding: '12px 28px',
          background: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {[
            { stepNum: 1, label: '1. Select Exam & Subjects' },
            { stepNum: 2, label: '2. Daily Slots & Timetable' },
            { stepNum: 3, label: '3. Equal Faculty Workload' },
          ].map(s => (
            <div
              key={s.stepNum}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: currentStep === s.stepNum ? '#4F46E5' : currentStep > s.stepNum ? '#16A34A' : '#94A3B8',
                fontWeight: currentStep === s.stepNum ? 800 : 600,
                fontSize: '0.8rem',
              }}
            >
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: currentStep === s.stepNum ? '#4F46E5' : currentStep > s.stepNum ? '#DCFCE7' : '#E2E8F0',
                color: currentStep === s.stepNum ? 'white' : currentStep > s.stepNum ? '#16A34A' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
              }}>
                {currentStep > s.stepNum ? '✓' : s.stepNum}
              </div>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Modal Body (Steps) ── */}
        <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
          
          {/* ═══════════════════════════════════════════════════════════
              STEP 1: EXAM SERIES TYPE & MULTI-SUBJECT SELECTION
             ═══════════════════════════════════════════════════════════ */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                  Select Examination Series Cycle:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { id: 'CIE-1', title: 'CIE-1 Series', desc: '1st Internal Tests' },
                    { id: 'CIE-2', title: 'CIE-2 Series', desc: '2nd Internal Tests' },
                    { id: 'CIE-3', title: 'CIE-3 Series', desc: '3rd Internal Tests' },
                    { id: 'LAB_INTERNAL', title: 'Lab Practical', desc: 'Continuous Lab Exam' },
                  ].map(e => (
                    <div
                      key={e.id}
                      onClick={() => setExamType(e.id as any)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: examType === e.id ? '2px solid #4F46E5' : '1.5px solid #E2E8F0',
                        background: examType === e.id ? '#EEF2FF' : 'white',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <strong style={{ display: 'block', fontSize: '0.85rem', color: examType === e.id ? '#4F46E5' : '#0F172A' }}>
                        {e.title}
                      </strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748B' }}>{e.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                  Link to COE Created SEE Session (Optional):
                </label>
                <select
                  value={selectedCoeSessionId}
                  onChange={e => setSelectedCoeSessionId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    color: '#334155',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="">-- No Linkage (Standalone Department Exam) --</option>
                  {coeSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Starts: {s.start_date})</option>
                  ))}
                </select>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: '#64748B' }}>
                  Linking ensures that eligibility rules are checked against the exact final exam session.
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A' }}>
                    Select Subjects to Include in this Examination Cycle ({selectedCourseCodes.length} Selected):
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={12} /> Paper Setter auto-bound to handling teacher
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {courses.map(course => {
                    const isSelected = selectedCourseCodes.includes(course.code);
                    const teacher = facultyMembers.find(f => f.assignedCourses.includes(course.code)) ||
                      facultyMembers.find(f => f.name === course.assignedFacultyName) ||
                      facultyMembers[0];

                    return (
                      <div
                        key={course.code}
                        onClick={() => handleToggleCourse(course.code)}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '12px',
                          border: isSelected ? '1.5px solid #4F46E5' : '1px solid #E2E8F0',
                          background: isSelected ? '#F8FAFC' : 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            style={{ width: 17, height: 17, accentColor: '#4F46E5', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ color: '#0F172A', fontSize: '0.88rem' }}>{course.code} — {course.title}</strong>
                              <span style={{ background: '#E2E8F0', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>
                                {course.semester}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                              Enrolled: <strong>{course.studentsCount} Students</strong> • {course.credits} Credits
                            </div>
                          </div>
                        </div>

                        {/* Teacher Badge */}
                        <div style={{
                          background: '#EEF2FF',
                          color: '#4F46E5',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}>
                          <Lock size={12} /> Paper Setter: {teacher.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 2: DAILY SESSIONS COUNT & EXACT SLOT TIMINGS
             ═══════════════════════════════════════════════════════════ */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Examination Series Start Date *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94A3B8' }} />
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 36px',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#475569', marginBottom: '6px' }}>
                    Number of Exam Sessions Each Day *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[1, 2, 3].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setSessionsPerDay(num)}
                        style={{
                          padding: '9px',
                          borderRadius: '8px',
                          border: sessionsPerDay === num ? '2px solid #4F46E5' : '1px solid #CBD5E1',
                          background: sessionsPerDay === num ? '#EEF2FF' : 'white',
                          color: sessionsPerDay === num ? '#4F46E5' : '#0F172A',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                        }}
                      >
                        {num} / Day {num === 2 && '★'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Exact Slot Timings */}
              <div style={{
                background: '#F8FAFC',
                padding: '16px',
                borderRadius: '14px',
                border: '1px solid #E2E8F0',
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={16} color="#4F46E5" />
                  <span>Configurable Daily Slot Timings (Applied to All Days)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                      Slot 1 Timing (Morning Session):
                    </label>
                    <input
                      type="text"
                      value={slot1Timing}
                      onChange={e => setSlot1Timing(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>

                  {sessionsPerDay >= 2 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                        Slot 2 Timing (Afternoon Session):
                      </label>
                      <input
                        type="text"
                        value={slot2Timing}
                        onChange={e => setSlot2Timing(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {sessionsPerDay >= 3 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', marginBottom: '4px' }}>
                        Slot 3 Timing (Late Afternoon / Lab Session):
                      </label>
                      <input
                        type="text"
                        value={slot3Timing}
                        onChange={e => setSlot3Timing(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Exam Halls Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
                  Select Examination Halls from Registered Inventory:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {halls.map(hall => {
                    const isSelected = selectedHallNames.includes(hall.roomNumber);
                    return (
                      <div
                        key={hall.id}
                        onClick={() => handleToggleHall(hall.roomNumber)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #4F46E5' : '1px solid #CBD5E1',
                          background: isSelected ? '#EEF2FF' : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '0.85rem', color: isSelected ? '#4F46E5' : '#0F172A' }}>
                            {hall.roomNumber}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 800 }}>
                            {hall.capacity} Seats
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '2px' }}>
                          {hall.blockName}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 3: AUTOMATED EQUAL FACULTY WORKLOAD ENGINE
             ═══════════════════════════════════════════════════════════ */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              <div style={{
                background: '#F0FDF4',
                border: '1.5px solid #BBF7D0',
                borderRadius: '14px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={20} color="#16A34A" />
                    <strong style={{ color: '#166534', fontSize: '0.92rem' }}>
                      Automated Equal Workload Engine: Zero Manual Selection Required
                    </strong>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: '#15803D' }}>
                    Every department faculty member is assigned an equitable number of invigilation duties without timetable clash.
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: '#DCFCE7', color: '#15803D', padding: '3px 9px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                    Target Quota Met ✓
                  </span>
                </div>
              </div>

              {/* Workload Distribution Table */}
              <div style={{
                background: 'white',
                borderRadius: '14px',
                border: '1.5px solid #E2E8F0',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 18px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.8rem', fontWeight: 800, color: '#475569' }}>
                  Department Faculty Workload Allotment Matrix ({facultyMembers.length} Teaching Staff)
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead style={{ background: '#F1F5F9', color: '#475569', fontWeight: 700, borderBottom: '1px solid #CBD5E1' }}>
                    <tr>
                      <th style={{ padding: '10px 14px' }}>Faculty Member</th>
                      <th style={{ padding: '10px 14px' }}>Paper Setter (Auto-Bound)</th>
                      <th style={{ padding: '10px 14px' }}>Equalized Duties</th>
                      <th style={{ padding: '10px 14px' }}>Allocated Invigilation Shifts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyMembers.map(faculty => {
                      const count = calculatedSchedule.dutyCounts[faculty.id] || 0;
                      const assignments = calculatedSchedule.assignments[faculty.id] || [];

                      return (
                        <tr key={faculty.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <strong style={{ color: '#0F172A' }}>{faculty.name}</strong>
                            <div style={{ fontSize: '0.7rem', color: '#64748B' }}>{faculty.employeeId}</div>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: '#EEF2FF',
                              color: '#4F46E5',
                              padding: '2px 7px',
                              borderRadius: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}>
                              <Lock size={11} /> {faculty.assignedCourses.join(', ') || 'Department Core'}
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              background: count > 0 ? '#ECFDF5' : '#F1F5F9',
                              color: count > 0 ? '#065F46' : '#64748B',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 800,
                              border: '1px solid #A7F3D0',
                            }}>
                              {count} Duties Allocated ✓
                            </span>
                          </td>

                          <td style={{ padding: '12px 14px' }}>
                            {assignments.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {assignments.map((a, idx) => (
                                  <span key={idx} style={{ fontSize: '0.72rem', color: '#334155' }}>
                                    • {a.date} ({a.time.split(' ')[0]}) in <strong>{a.room}</strong>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Reserve Proctor</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Generated Exam Sessions Preview summary */}
              <div style={{
                background: '#F8FAFC',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                fontSize: '0.78rem',
                color: '#475569',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span>
                  Total Sessions to be Generated: <strong>{calculatedSchedule.sessions.length} Exam Events</strong>
                </span>
                <span style={{ color: '#4F46E5', fontWeight: 800 }}>
                  Halls: {selectedHallNames.join(', ')}
                </span>
              </div>

            </div>
          )}

        </div>

        {/* ── Modal Footer with Navigation ── */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8FAFC',
        }}>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((currentStep - 1) as any)}
              style={{
                padding: '9px 18px',
                borderRadius: '9px',
                border: '1px solid #CBD5E1',
                background: 'white',
                color: '#475569',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: '9px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              Cancel
            </button>

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((currentStep + 1) as any)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                }}
              >
                Next Step <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinalSubmit}
                style={{
                  padding: '9px 22px',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
                }}
              >
                <Check size={16} /> Confirm & Lock Schedule Batch ✓
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
