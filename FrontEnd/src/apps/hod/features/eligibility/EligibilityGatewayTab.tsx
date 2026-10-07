import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { StudentEligibilityRecord, CourseRecord } from '../../types';
import { Badge } from '@/components/ui/Badge';
import {
  Search,
  Upload,
  CheckCircle2,
  Award,
  BookOpen,
  AlertTriangle,
  XCircle,
  Users
} from 'lucide-react';
import { CSVUploadModal } from './components/CSVUploadModal';
import { CondonationWaiverModal } from './components/CondonationWaiverModal';

import { toast } from 'react-hot-toast';
import { api } from '@/services/api';

interface EligibilityGatewayTabProps {
  students: StudentEligibilityRecord[];
  courses?: CourseRecord[];
  onUpdateStudent: (student: StudentEligibilityRecord) => void;
  onBulkAddStudents: (newStudents: StudentEligibilityRecord[]) => void;
  onDeleteStudent?: (studentId: string) => void;
  onDeleteAllStudents?: () => void;
  onNavigateToHallTickets?: () => void;
  departmentFilter?: string; // HOD's department code (e.g., "CS", "ME")
  onRefreshData?: () => void; // Added for reloading after bulk generate
}

// Dynamic subjects from the courses prop will be used instead of dummy data

const HOD_ROLES = ['HOD'];

export const EligibilityGatewayTab: React.FC<EligibilityGatewayTabProps> = ({
  students,
  courses,
  onUpdateStudent,
  onBulkAddStudents,
  onNavigateToHallTickets: _onNavigateToHallTickets,
  departmentFilter,
  onRefreshData,
}) => {
  const user = useAuthStore(s => s.user);
  const userRole = user?.role ?? '';
  const userDepartment = user?.department_code;
  const isHod = HOD_ROLES.includes(userRole);

  const [selectedSemester, setSelectedSemester] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>(departmentFilter || 'ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [selectedStudentForCondonation, setSelectedStudentForCondonation] = useState<StudentEligibilityRecord | null>(null);
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  const toggleExpand = (usn: string) => {
    setExpandedStudents(prev => ({ ...prev, [usn]: !prev[usn] }));
  };

  const handleSemesterChange = (newSem: string) => {
    setSelectedSemester(newSem);
    if (newSem !== 'ALL' && selectedSubject !== 'ALL') {
      const semSubjects = (courses || []).filter(c => c.semester === newSem);
      if (!semSubjects.some(s => s.code === selectedSubject)) {
        setSelectedSubject('ALL');
      }
    }
  };

  // Compute available subjects for the dropdown
  const deptCourses = (courses || []).filter(c => 
    !departmentFilter || 
    c.department.toUpperCase().includes(departmentFilter.toUpperCase()) || 
    c.department === 'Computer Science & Engineering' // Fallback for CS
  );

  const uniqueSemesters = Array.from(new Set(deptCourses.map(c => c.semester))).sort();

  const availableSubjects = deptCourses
    .filter(c => selectedSemester === 'ALL' || c.semester === selectedSemester)
    .map(c => ({
      code: c.code,
      title: c.title,
      faculty: c.assignedFacultyName || 'Unassigned'
    }));

  // Filter logic: Filter by Department, Semester, Subject, Status, and Search Query
  const filteredStudents = students.filter(s => {
    if (departmentFilter && s.department && departmentFilter !== s.department && !departmentFilter.includes(s.department) && !s.department.includes(departmentFilter)) return false;
    if (selectedDepartment !== 'ALL' && s.department !== selectedDepartment && !selectedDepartment.includes(s.department) && !s.department.includes(selectedDepartment)) return false;
    if (selectedSemester !== 'ALL' && s.semester !== selectedSemester) return false;
    if (selectedSubject !== 'ALL' && s.subjectCode !== selectedSubject) return false;
    if (selectedStatus !== 'ALL' && s.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.usn.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.subjectCode && s.subjectCode.toLowerCase().includes(q)) ||
        (s.subjectTitle && s.subjectTitle.toLowerCase().includes(q)) ||
        (s.facultyInCharge && s.facultyInCharge.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Group by USN first so metrics can be calculated per student
  const groupedStudents = React.useMemo(() => {
    const groups: Record<string, StudentEligibilityRecord[]> = {};
    filteredStudents.forEach(s => {
      if (!groups[s.usn]) groups[s.usn] = [];
      groups[s.usn].push(s);
    });
    return Object.values(groups).sort((a, b) => a[0].usn.localeCompare(b[0].usn));
  }, [filteredStudents]);

  // Telemetry metrics based on distinct students
  const total = groupedStudents.length;
  let eligibleCount = 0;
  let condonableCount = 0;
  let detainedCount = 0;
  let feeBlockedCount = 0;

  groupedStudents.forEach(group => {
    const hasDetained = group.some(s => s.status === 'DETAINED');
    const hasFeeBlocked = group.some(s => s.status === 'FEE_BLOCKED');
    const hasCondonable = group.some(s => s.status === 'CONDONABLE' && !s.condonationApproved);

    if (hasFeeBlocked) {
      feeBlockedCount++;
    } else if (hasDetained) {
      detainedCount++;
    } else if (hasCondonable) {
      condonableCount++;
    } else {
      eligibleCount++;
    }
  });

  const handleApproveCondonation = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const updated: StudentEligibilityRecord = {
        ...student,
        status: 'ELIGIBLE',
        condonationApproved: true,
      };
      onUpdateStudent(updated);
    }
  };

  const handleResolveFeeBlock = (student: StudentEligibilityRecord) => {
    const updated: StudentEligibilityRecord = {
      ...student,
      hasFeeDues: false,
      status: student.attendancePercent >= 75 ? 'ELIGIBLE' : 'CONDONABLE',
    };
    onUpdateStudent(updated);
  };

  const handleGenerateEligibility = async () => {
    try {
      const toastId = toast.loading('Computing eligibility and 3-CIE averages...');
      await api.post('/eligibility/generate/');
      toast.success('Eligibility calculations completed!', { id: toastId });
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate eligibility');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── Top Metric Stats Ribbon ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {/* Total Evaluated */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #E2E8F0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Evaluated</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A' }}>{total} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>Students</span></div>
          </div>
        </div>

        {/* Eligible */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #BBF7D0',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fully Eligible (All Subjects)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#15803D' }}>{eligibleCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#16A34A' }}>({total > 0 ? Math.round((eligibleCount / total) * 100) : 0}%)</span></div>
          </div>
        </div>

        {/* Condonation Required */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #FDE68A',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FEF3C7', color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#B45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Shortage (Any Subject)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#B45309' }}>{condonableCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B45309' }}>Condonable</span></div>
          </div>
        </div>

        {/* Detained */}
        <div style={{
          background: 'white',
          borderRadius: '14px',
          border: '1.5px solid #FECACA',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <XCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#B91C1C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Detained (Any Subject)</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#B91C1C' }}>{detainedCount} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B91C1C' }}>Barred</span></div>
          </div>
        </div>
      </div>

      {/* ── Multi-Parameter Filter Bar: Semester, Subject, Status & Search ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        padding: '18px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            placeholder="Search USN, student name, subject code, or teacher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1.5px solid var(--color-border)',
              fontSize: '0.82rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Dropdown Filters: Semester, Subject & Status */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          
          {/* 1. Semester Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>Semester:</span>
            <select
              value={selectedSemester}
              onChange={e => handleSemesterChange(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#0F172A',
                background: '#F8FAFC',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">All Semesters</option>
              {uniqueSemesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* 2. Subject Course Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <BookOpen size={13} /> Subject:
            </span>
            <select
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1.5px solid #A5B4FC',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#1E1B4B',
                background: '#EEF2FF',
                cursor: 'pointer',
                maxWidth: '280px',
              }}
            >
              <option value="ALL">
                {selectedSemester === 'ALL' ? 'All Subjects Across Department' : `All ${selectedSemester} Subjects`}
              </option>
              {availableSubjects.map(sub => (
                <option key={sub.code} value={sub.code}>
                  {sub.code}: {sub.title}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Eligibility Status Selector */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1.5px solid #CBD5E1',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#0F172A',
              background: '#F8FAFC',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ELIGIBLE">Eligible (≥85% Attendance)</option>
            <option value="CONDONABLE">Condonable Shortage (65%–74.9%)</option>
            <option value="DETAINED">Detained (&lt;65% Attendance)</option>
            <option value="FEE_BLOCKED">Fee Dues Blocked</option>
          </select>

          {/* Bulk Ingest Action */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleGenerateEligibility}
              style={{
                padding: '8px 16px',
                background: '#4F46E5',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={14} /> Generate Eligibility
            </button>
            <button
              onClick={() => setIsCSVModalOpen(true)}
              style={{
                padding: '8px 16px',
                background: '#3b82f615',
                border: '1.5px solid #3b82f644',
                borderRadius: '8px',
                color: '#3b82f6',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Upload size={14} /> Bulk Ingest CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Subject-Wise Student Eligibility Table ── */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1.5px solid var(--color-border)',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A' }}>
              Subject-Wise Student Eligibility Roster ({filteredStudents.length} Records)
            </span>
            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>
              {selectedSubject !== 'ALL' ? (
                <span>Filtered for Course: <strong style={{ color: '#4F46E5' }}>{selectedSubject}</strong></span>
              ) : selectedSemester !== 'ALL' ? (
                <span>Filtered for <strong style={{ color: '#0F172A' }}>{selectedSemester}</strong> (All Subjects)</span>
              ) : (
                <span>Showing all courses across 3rd, 5th, and 7th Semesters</span>
              )}
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            Attendance Threshold: <strong>≥85%</strong> | Condonation Floor: <strong>65%</strong>
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead style={{ background: '#f8fafc', color: 'var(--color-text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '14px 20px' }}>STUDENT USN & NAME</th>
                <th style={{ padding: '14px 16px' }}>SEMESTER</th>
                <th style={{ padding: '14px 16px' }}>SUBJECTS</th>
                <th style={{ padding: '14px 16px' }}>OVERALL ELIGIBILITY</th>
                <th style={{ padding: '14px 20px', textAlign: 'right' }}>DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {groupedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748B', fontSize: '0.88rem' }}>
                    No student eligibility records found matching the selected Semester / Subject filter.
                  </td>
                </tr>
              ) : (
                groupedStudents.map(studentGroup => {
                  const baseStudent = studentGroup[0];
                  const isExpanded = expandedStudents[baseStudent.usn];
                  const eligibleSubjects = studentGroup.filter(s => s.status === 'ELIGIBLE' || (s.status === 'CONDONABLE' && s.condonationApproved)).length;
                  const totalSubjects = studentGroup.length;
                  const isFullyEligible = eligibleSubjects === totalSubjects;
                  
                  return (
                    <React.Fragment key={baseStudent.usn}>
                      <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #f1f5f9', background: isExpanded ? '#f8fafc' : 'white', transition: 'background 0.15s ease' }}>
                        {/* USN & Name */}
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                            {baseStudent.usn}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                            {baseStudent.name}
                          </div>
                        </td>

                        {/* Semester & Section */}
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {baseStudent.semester} <span style={{ color: '#64748B', fontSize: '0.74rem' }}>({baseStudent.section})</span>
                        </td>

                        {/* Total Subjects */}
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          <span style={{
                            background: '#EEF2FF',
                            color: '#4F46E5',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.8rem'
                          }}>
                            {totalSubjects} Subjects
                          </span>
                        </td>

                        {/* Overall Eligibility Status */}
                        <td style={{ padding: '14px 16px' }}>
                          {isFullyEligible ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                              <CheckCircle2 size={14} /> FULLY ELIGIBLE
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#e11d48', padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                              <AlertTriangle size={14} /> ELIGIBLE FOR {eligibleSubjects} / {totalSubjects}
                            </span>
                          )}
                        </td>

                        {/* Expand Action */}
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => toggleExpand(baseStudent.usn)}
                            style={{
                              padding: '6px 12px',
                              background: isExpanded ? '#e2e8f0' : '#f1f5f9',
                              color: '#334155',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {isExpanded ? 'Hide Subjects ▲' : 'View Subjects ▼'}
                          </button>
                        </td>
                      </tr>
                      
                      {/* Sub-table for Subjects */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: 0, borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px dashed #cbd5e1' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                                <thead style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                                  <tr>
                                    <th style={{ padding: '8px' }}>SUBJECT</th>
                                    <th style={{ padding: '8px' }}>ATTENDANCE</th>
                                    <th style={{ padding: '8px' }}>CIE SCORE</th>
                                    <th style={{ padding: '8px' }}>STATUS</th>
                                    <th style={{ padding: '8px', textAlign: 'right' }}>ACTION</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {studentGroup.map(subjectRecord => {
                                    const isSubEligible = subjectRecord.status === 'ELIGIBLE' || (subjectRecord.status === 'CONDONABLE' && subjectRecord.condonationApproved);
                                    const attColor = subjectRecord.attendancePercent >= 85 ? '#16a34a' : subjectRecord.attendancePercent >= 75 ? '#059669' : subjectRecord.attendancePercent >= 65 ? '#d97706' : '#e11d48';

                                    return (
                                      <tr key={subjectRecord.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 8px' }}>
                                          <div style={{ fontWeight: 800, color: '#334155' }}>{subjectRecord.subjectCode}</div>
                                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{subjectRecord.subjectTitle}</div>
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                          <span style={{ fontWeight: 800, color: attColor }}>{subjectRecord.attendancePercent}%</span>
                                          <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                            {subjectRecord.classesAttended} / {subjectRecord.totalClassesHeld} Classes
                                          </div>
                                        </td>
                                        <td style={{ padding: '10px 8px', fontWeight: 800, color: subjectRecord.cieMarksAvg >= 20 ? '#16A34A' : '#E11D48' }}>
                                          {subjectRecord.cieMarksAvg} / 50
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                          {isSubEligible ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16A34A', fontWeight: 800 }}>
                                              ELIGIBLE
                                            </span>
                                          ) : subjectRecord.status === 'CONDONABLE' ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#D97706', fontWeight: 800 }}>
                                              CONDONABLE ({'<85%'})
                                            </span>
                                          ) : subjectRecord.status === 'FEE_BLOCKED' ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#E11D48', fontWeight: 800 }}>
                                              FEE DUES
                                            </span>
                                          ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#E11D48', fontWeight: 800 }}>
                                              DETAINED ({'<65%'})
                                            </span>
                                          )}
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                          {subjectRecord.status === 'CONDONABLE' && !subjectRecord.condonationApproved && (
                                            <button
                                              onClick={() => setSelectedStudentForCondonation(subjectRecord)}
                                              style={{
                                                padding: '4px 10px',
                                                background: '#FFFBEB',
                                                color: '#D97706',
                                                border: '1px solid #FDE68A',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Approve Condonation
                                            </button>
                                          )}
                                          {subjectRecord.status === 'FEE_BLOCKED' && (
                                            <button
                                              onClick={() => handleResolveFeeBlock(subjectRecord)}
                                              style={{
                                                padding: '4px 10px',
                                                background: '#FEF2F2',
                                                color: '#E11D48',
                                                border: '1px solid #FECACA',
                                                borderRadius: '6px',
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Clear Fee Block
                                            </button>
                                          )}
                                          {!['CONDONABLE', 'FEE_BLOCKED'].includes(subjectRecord.status) && (
                                            <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>No Action</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV Ingestion Modal */}
      {isCSVModalOpen && (
        <CSVUploadModal
          onImportStudents={newStudents => onBulkAddStudents(newStudents)}
          onClose={() => setIsCSVModalOpen(false)}
        />
      )}

      {/* Condonation Review Modal */}
      {selectedStudentForCondonation && (
        <CondonationWaiverModal
          student={selectedStudentForCondonation}
          onApproveCondonation={handleApproveCondonation}
          onClose={() => setSelectedStudentForCondonation(null)}
        />
      )}
    </div>
  );
};
