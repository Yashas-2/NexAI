import React, { useRef } from 'react';
import { AssignedCourse, StudentGradeRecord } from '../../types';
import {
  Search,
  Download,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface StudentRosterMarksTabProps {
  courses: AssignedCourse[];
  selectedCourseCode: string;
  onSelectCourseCode: (code: string) => void;
  students: StudentGradeRecord[];
  setStudents: React.Dispatch<React.SetStateAction<StudentGradeRecord[]>>;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  onStudentFieldChange: (
    id: string,
    field: 'attendancePercent' | 'cie1' | 'cie2' | 'cie3' | 'labOrProject',
    value: number | string
  ) => void;
  onSaveMarksToHOD: () => void;
}

export const StudentRosterMarksTab: React.FC<StudentRosterMarksTabProps> = ({
  courses,
  selectedCourseCode,
  onSelectCourseCode,
  students,
  setStudents,
  searchQuery,
  onSearchQueryChange,
  onStudentFieldChange,
  onSaveMarksToHOD,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter students for active course
  const courseStudents = students.filter(s => s.courseCode === selectedCourseCode);
  const filteredStudents = courseStudents.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.usn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownloadTemplate = () => {
    let csvContent = "data:text/csv;charset=utf-8,USN,Name,AttendancePercent,CIE1,CIE2,CIE3,LabOrProject\n";
    courseStudents.forEach(s => {
      csvContent += `${s.usn},${s.name},${s.attendancePercent || 0},${s.cie1 || 0},${s.cie2 || 0},${s.cie3 || 0},${s.labOrProject || 0}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_marks_template_${selectedCourseCode}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('Template downloaded successfully!');
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = text.split('\n');
      
      const newStudents = [...students];
      let updatedCount = 0;

      rows.forEach((row, index) => {
        if (index === 0 || !row.trim()) return; // Skip header or empty
        const cols = row.split(',');
        if (cols.length >= 7) {
          const usn = cols[0].trim();
          const att = parseInt(cols[2].trim()) || 0;
          const c1 = parseInt(cols[3].trim()) || 0;
          const c2 = parseInt(cols[4].trim()) || 0;
          const c3 = parseInt(cols[5].trim()) || 0;
          const lab = parseInt(cols[6].trim()) || 0;

          const studentIndex = newStudents.findIndex(s => s.usn === usn && s.courseCode === selectedCourseCode);
          if (studentIndex !== -1) {
            newStudents[studentIndex] = {
              ...newStudents[studentIndex],
              attendancePercent: att,
              cie1: c1,
              cie2: c2,
              cie3: c3,
              labOrProject: lab,
              isModified: true,
              saveStatus: 'UNSAVED' as const
            };
            
            newStudents[studentIndex].totalCIE = c1 + c2 + c3 + lab;
            
            updatedCount++;
          }
        }
      });
      
      setStudents(newStudents);
      toast.success(`Successfully imported data for ${updatedCount} students.`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div>
      {/* ── Top Bar: Course Selector ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '18px 24px',
        border: '1.5px solid var(--color-border, #E2E8F0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', display: 'block', marginBottom: '4px' }}>
              ACTIVE COURSE:
            </span>
            <select
              value={selectedCourseCode}
              onChange={e => onSelectCourseCode(e.target.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                fontSize: '0.88rem',
                fontWeight: 800,
                color: '#0F172A',
                background: 'white',
                cursor: 'pointer',
              }}
            >
              {courses.map(c => (
                <option key={c.code} value={c.code}>{c.code} — {c.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        {/* Actions Toolbar */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1.5px solid var(--color-border, #E2E8F0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '18px',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleDownloadTemplate}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1.5px solid #E2E8F0',
                background: 'white',
                color: '#475569',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Download size={16} /> Download CSV Template
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#4F46E5',
                color: 'white',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Upload size={16} /> Import from CSV
            </button>
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleImportCSV}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Search USN or Name..."
              value={searchQuery}
              onChange={e => onSearchQueryChange(e.target.value)}
              style={{
                padding: '7px 12px 7px 30px',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                width: '240px',
              }}
            />
          </div>
        </div>

        {/* Student Marks Table */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid var(--color-border, #E2E8F0)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>USN & STUDENT</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>ATTENDANCE %</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>CIE-1 (10M)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>CIE-2 (10M)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>CIE-3 (10M)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>LAB/PROJ (20M)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>TOTAL CIE (50M)</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#94A3B8' }}>
                      No students found matching the query.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(student => {
                    const attNum = student.attendancePercent !== '' && student.attendancePercent !== null && student.attendancePercent !== undefined ? Number(student.attendancePercent) : null;
                    const isShortage = attNum !== null && attNum < 85;
                    const isCIEPassing = student.totalCIE >= 20;

                    const inputStyle = {
                      width: '58px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid #CBD5E1',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      textAlign: 'center' as const,
                      background: 'white',
                    };

                    return (
                      <tr
                        key={student.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: student.isModified ? '#F0FDF4' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#0F172A' }}>{student.name}</div>
                          <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#64748B' }}>
                            {student.usn}
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={student.attendancePercent !== null && student.attendancePercent !== undefined ? student.attendancePercent : ''}
                              onChange={e =>
                                onStudentFieldChange(student.id, 'attendancePercent', e.target.value === '' ? '' : parseInt(e.target.value))
                              }
                              style={{...inputStyle, borderColor: isShortage ? '#FCA5A5' : '#CBD5E1'}}
                            />
                            <span style={{ fontWeight: 800, color: isShortage ? '#DC2626' : '#16A34A' }}>%</span>
                          </div>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            min="0" max="10"
                            value={student.cie1 !== null && student.cie1 !== undefined ? student.cie1 : 0}
                            onChange={e => onStudentFieldChange(student.id, 'cie1', e.target.value === '' ? 0 : parseInt(e.target.value))}
                            style={inputStyle}
                          />
                        </td>
                        
                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            min="0" max="10"
                            value={student.cie2 !== null && student.cie2 !== undefined ? student.cie2 : 0}
                            onChange={e => onStudentFieldChange(student.id, 'cie2', e.target.value === '' ? 0 : parseInt(e.target.value))}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            min="0" max="10"
                            value={student.cie3 !== null && student.cie3 !== undefined ? student.cie3 : 0}
                            onChange={e => onStudentFieldChange(student.id, 'cie3', e.target.value === '' ? 0 : parseInt(e.target.value))}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <input
                            type="number"
                            min="0" max="20"
                            value={student.labOrProject !== null && student.labOrProject !== undefined ? student.labOrProject : 0}
                            onChange={e => onStudentFieldChange(student.id, 'labOrProject', e.target.value === '' ? 0 : parseInt(e.target.value))}
                            style={inputStyle}
                          />
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '36px', height: '36px',
                            borderRadius: '50%',
                            background: isCIEPassing ? '#DCFCE7' : '#FEE2E2',
                            color: isCIEPassing ? '#16A34A' : '#DC2626',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                            border: `2px solid ${isCIEPassing ? '#4ADE80' : '#F87171'}`,
                          }}>
                            {student.totalCIE}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px' }}>
                          {student.saveStatus === 'SYNCED' ? (
                            <span style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 800, background: '#DCFCE7', padding: '4px 8px', borderRadius: '6px' }}>
                              SYNCED ✓
                            </span>
                          ) : student.saveStatus === 'SAVING' ? (
                            <span style={{ fontSize: '0.72rem', color: '#2563EB', fontWeight: 800, background: '#DBEAFE', padding: '4px 8px', borderRadius: '6px' }}>
                              SAVING...
                            </span>
                          ) : student.saveStatus === 'FAILED' ? (
                            <span style={{ fontSize: '0.72rem', color: '#DC2626', fontWeight: 800, background: '#FEE2E2', padding: '4px 8px', borderRadius: '6px' }}>
                              FAILED ✗
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.72rem', color: '#D97706', fontWeight: 800, background: '#FEF3C7', padding: '4px 8px', borderRadius: '6px' }}>
                              UNSAVED
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
