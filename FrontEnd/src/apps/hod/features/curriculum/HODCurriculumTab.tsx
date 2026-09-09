import React, { useState, useEffect } from 'react';
import { CourseRecord, FacultyMember } from '../../types';
import { api } from '@/services/api';
import {
  BookOpen,
  Plus,
  Target,
  UserCheck,
  Layers,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  courses: CourseRecord[];
  facultyMembers: FacultyMember[];
  onAddCourse: (newCourse: CourseRecord) => void;
  onUpdateCourse: (updated: CourseRecord) => void;
  onDeleteCourse: (code: string) => void;
}

export const HODCurriculumTab: React.FC<Props> = ({
  courses,
  facultyMembers: _facultyMembers,
  onAddCourse,
  onUpdateCourse,
  onDeleteCourse,
}) => {
  const [selectedCourse, setSelectedCourse] = useState<CourseRecord>(courses[0] || null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [isEditingMatrix, setIsEditingMatrix] = useState(false);
  const [draftMatrix, setDraftMatrix] = useState<Record<string, Record<string, number>>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [newCoCode, setNewCoCode] = useState('');
  const [newCoDesc, setNewCoDesc] = useState('');

  useEffect(() => {
    if (selectedCourse) {
      setDraftMatrix(selectedCourse.coPoMapping || {});
      setIsEditingMatrix(false);
    }
  }, [selectedCourse]);

  const handleSaveMatrix = async () => {
    if (!selectedCourse) return;
    setIsSavingMatrix(true);
    try {
      const res = await api.patch(`/scheduling/subjects/${selectedCourse.id}/`, {
        co_po_mapping: draftMatrix
      });
      const updated: CourseRecord = {
        ...selectedCourse,
        coPoMapping: res.data.co_po_mapping,
        outcomes: (res.data.co_list || []).map((coId: string) => ({
          id: coId,
          description: `Outcome ${coId}`,
          mappedPOs: Object.keys((res.data.co_po_mapping || {})[coId] || {}).filter(po => (res.data.co_po_mapping || {})[coId][po] > 0),
          coPoMapping: (res.data.co_po_mapping || {})[coId] || {}
        }))
      };
      onUpdateCourse(updated);
      setSelectedCourse(updated);
      setIsEditingMatrix(false);
      toast.success('CO-PO Matrix updated successfully!');
    } catch (err: any) {
      toast.error('Failed to update matrix');
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleAddCO = async () => {
    if (!selectedCourse || !newCoCode.trim()) return;
    const code = newCoCode.trim().toUpperCase();
    const existing = selectedCourse.coList || [];
    if (existing.includes(code)) {
      toast.error(`${code} already exists`);
      return;
    }
    const updatedCoList = [...existing, code];
    const updatedMapping = { ...(selectedCourse.coPoMapping || {}), [code]: {} };
    try {
      await api.patch(`/scheduling/subjects/${selectedCourse.id}/`, {
        co_list: updatedCoList,
        co_po_mapping: updatedMapping,
      });
      const updated: CourseRecord = {
        ...selectedCourse,
        coList: updatedCoList,
        coPoMapping: updatedMapping,
        outcomes: updatedCoList.map((coId: string) => ({
          id: coId,
          description: newCoDesc.trim() || `Outcome ${coId}`,
          mappedPOs: Object.keys((updatedMapping as any)[coId] || {}).filter(po => (updatedMapping as any)[coId][po] > 0),
          coPoMapping: (updatedMapping as any)[coId] || {},
        })),
      };
      onUpdateCourse(updated);
      setSelectedCourse(updated);
      setNewCoCode('');
      setNewCoDesc('');
      toast.success(`Added ${code}`);
    } catch {
      toast.error('Failed to add course outcome');
    }
  };

  const handleRemoveCO = async (coId: string) => {
    if (!selectedCourse) return;
    const updatedCoList = selectedCourse.coList.filter(c => c !== coId);
    const updatedMapping = { ...(selectedCourse.coPoMapping || {}) };
    delete updatedMapping[coId];
    try {
      await api.patch(`/scheduling/subjects/${selectedCourse.id}/`, {
        co_list: updatedCoList,
        co_po_mapping: updatedMapping,
      });
      const updated: CourseRecord = {
        ...selectedCourse,
        coList: updatedCoList,
        coPoMapping: updatedMapping,
        outcomes: updatedCoList.map((id: string) => ({
          id,
          description: `Outcome ${id}`,
          mappedPOs: Object.keys(updatedMapping[id] || {}).filter(po => updatedMapping[id][po] > 0),
          coPoMapping: updatedMapping[id] || {},
        })),
      };
      onUpdateCourse(updated);
      setSelectedCourse(updated);
      toast.success(`Removed ${coId}`);
    } catch {
      toast.error('Failed to remove course outcome');
    }
  };

  const [enrolledStudents, setEnrolledStudents] = useState<any[]>([]);
  const [isFetchingStudents, setIsFetchingStudents] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFilter, setEnrollFilter] = useState('');

  useEffect(() => {
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0]);
    }
  }, [courses]);

  useEffect(() => {
    if (selectedCourse?.id) {
      setIsFetchingStudents(true);
      api.get(`/scheduling/subjects/${selectedCourse.id}/enrolled-students/`)
        .then(res => {
          const students = res.data.results || res.data;
          setEnrolledStudents(students);
        })
        .catch(err => {
          console.error(err);
          setEnrolledStudents([]);
        })
        .finally(() => setIsFetchingStudents(false));
    } else {
      setEnrolledStudents([]);
    }
  }, [selectedCourse]);

  // Fetch all students for dropdown
  useEffect(() => {
    api.get('/auth/users/?role=STUDENT&page_size=500')
      .then(res => setAllStudents(res.data.results || res.data))
      .catch(() => setAllStudents([]));
  }, []);

  // Filter out already enrolled students from dropdown
  const enrolledUsns = new Set(enrolledStudents.map((s: any) => s.student_usn));
  const availableStudents = allStudents.filter(s => !enrolledUsns.has(s.usn));
  const filteredStudents = availableStudents.filter((s: any) => {
    const q = enrollFilter.toLowerCase();
    return !q || s.usn.toLowerCase().includes(q) || (s.full_name || '').toLowerCase().includes(q);
  });

  const handleEnrollAll = async () => {
    if (selectedStudents.size === 0 || !selectedCourse?.id) return;
    setEnrolling(true);
    try {
      const usns = Array.from(selectedStudents);
      const res = await api.post(`/scheduling/subjects/${selectedCourse.id}/batch-enroll/`, { usns });
      const data = res.data;
      setSelectedStudents(new Set());
      const msg = data.total_enrolled > 0
        ? `Enrolled ${data.total_enrolled} students${data.already_enrolled?.length > 0 ? ` (${data.already_enrolled.length} already enrolled)` : ''}`
        : data.already_enrolled?.length > 0
          ? `All ${data.already_enrolled.length} students already enrolled`
          : 'No students enrolled';
      toast.success(msg);
      setTimeout(async () => {
        try {
          const updated = await api.get(`/scheduling/subjects/${selectedCourse.id}/enrolled-students/`);
          setEnrolledStudents(updated.data.results || updated.data);
        } catch {}
      }, 300);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to enroll students');
    } finally {
      setEnrolling(false);
    }
  };

  const handleEnrollAllDeptStudents = async () => {
    if (!selectedCourse?.id) return;
    setEnrolling(true);
    const toastId = toast.loading('Enrolling all department students...');
    try {
      // Fetch all students in the department
      const studentsRes = await api.get('/auth/users/?role=STUDENT&page_size=500');
      const allDeptStudents = studentsRes.data.results || studentsRes.data;
      const usns = allDeptStudents.map((s: any) => s.usn).filter(Boolean);
      
      const res = await api.post(`/scheduling/subjects/${selectedCourse.id}/batch-enroll/`, { usns });
      const data = res.data;
      const msg = data.total_enrolled > 0
        ? `Enrolled ${data.total_enrolled} students${data.already_enrolled?.length > 0 ? ` (${data.already_enrolled.length} already enrolled)` : ''}`
        : data.already_enrolled?.length > 0
          ? `All ${data.already_enrolled.length} students already enrolled`
          : 'No students enrolled';
      toast.success(msg, { id: toastId });
      setSelectedStudents(new Set());
      setTimeout(async () => {
        try {
          const updated = await api.get(`/scheduling/subjects/${selectedCourse.id}/enrolled-students/`);
          setEnrolledStudents(updated.data.results || updated.data);
        } catch {}
      }, 300);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to enroll students', { id: toastId });
    } finally {
      setEnrolling(false);
    }
  };

  const toggleStudentSelect = (usn: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(usn)) next.delete(usn);
      else next.add(usn);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s: any) => s.usn)));
    }
  };

  // Fetch faculty members from API
  const [apiFaculty, setApiFaculty] = useState<{ id: string; full_name: string; role: string }[]>([]);
  useEffect(() => {
    api.get('/auth/users/', { params: { role: 'FACULTY' } })
      .then(res => {
        const users = res.data.results || res.data;
        setApiFaculty(users.map((u: any) => ({ id: u.id, full_name: u.full_name, role: u.role })));
      })
      .catch(() => {});
  }, []);

  // Form State for New Course
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCredits, setNewCredits] = useState(4);
  const [newSemester, setNewSemester] = useState('5th Semester B.Tech');
  const [newFacultyId, setNewFacultyId] = useState('');
  const [newModulesText, setNewModulesText] = useState('');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse semester number from string (e.g. "5th Semester B.Tech" -> 5)
    const semMatch = newSemester.match(/\d+/);
    const semNum = semMatch ? parseInt(semMatch[0]) : 5;

    const payload: Record<string, any> = {
      code: newCode.trim().toUpperCase(),
      name: newTitle.trim(),
      subject_type: 'CORE',
      semester: semNum,
      credits: Number(newCredits) || 3,
      batch_year: new Date().getFullYear(),
      exam_duration_mins: 180
    };

    // Include coordinator if a faculty member is selected
    if (newFacultyId) {
      payload.coordinator = newFacultyId;
    }

    try {
      const res = await api.post('/scheduling/subjects/', payload);
      
      const assignedFac = apiFaculty.find(f => f.id === newFacultyId);
      const created: CourseRecord = {
        id: res.data.id,
        code: res.data.code,
        title: res.data.name,
        department: res.data.department_name || 'Computer Science & Engineering',
        semester: `${res.data.semester}th Semester`,
        credits: res.data.credits,
        studentsCount: 0,
        status: 'ACTIVE',
        assignedFacultyId: assignedFac?.id || res.data.coordinator,
        assignedFacultyName: assignedFac?.full_name || res.data.coordinator_name,
        syllabusModules: newModulesText.split('\n').filter(m => m.trim()),
        outcomes: []
      };

      onAddCourse(created);
      setSelectedCourse(created);
      setIsCreateModalOpen(false);
      setNewCode('');
      setNewTitle('');
      setNewCredits(4);
      setNewFacultyId('');
      setNewModulesText('');
      toast.success(`Course ${created.code} successfully created!`);
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.response?.data 
          ? JSON.stringify(err.response.data) 
          : err.message || 'Failed to create course'
      );
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;

    const semMatch = newSemester.match(/\d+/);
    const semNum = semMatch ? parseInt(semMatch[0]) : 5;

    const payload: Record<string, any> = {
      code: newCode.trim().toUpperCase(),
      name: newTitle.trim(),
      semester: semNum,
      credits: Number(newCredits) || 3,
    };
    if (newFacultyId) payload.coordinator = newFacultyId;

    try {
      const res = await api.patch(`/scheduling/subjects/${selectedCourse.id}/`, payload);
      const assignedFac = apiFaculty.find(f => f.id === newFacultyId);
      const updated: CourseRecord = {
        ...selectedCourse,
        code: res.data.code,
        title: res.data.name,
        semester: `${res.data.semester}th Semester`,
        credits: res.data.credits,
        assignedFacultyId: assignedFac?.id || res.data.coordinator,
        assignedFacultyName: assignedFac?.full_name || res.data.coordinator_name,
        syllabusModules: newModulesText.split('\n').filter(m => m.trim()),
      };

      onUpdateCourse(updated);
      setSelectedCourse(updated);
      setIsEditModalOpen(false);
      toast.success(`Course ${updated.code} successfully updated!`);
    } catch (err: any) {
      toast.error('Failed to update course');
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this course?")) return;
    try {
      await api.delete(`/scheduling/subjects/${id}/`);
      toast.success('Course deleted successfully');
      // Ideally we call onDeleteCourse from props
      // Wait, onDeleteCourse takes code, but we use ID in API.
      // I'll just pass the code so the parent removes it from state.
      // We also need to clear selectedCourse if it was deleted.
      if (selectedCourse?.id === id) {
        setSelectedCourse(courses.find(c => c.id !== id) || courses[0] || null);
      }
      onDeleteCourse(selectedCourse.code);
    } catch (err) {
      toast.error('Failed to delete course');
    }
  };

  const openEditModal = () => {
    if (!selectedCourse) return;
    setNewCode(selectedCourse.code);
    setNewTitle(selectedCourse.title);
    setNewCredits(selectedCourse.credits);
    setNewSemester(selectedCourse.semester);
    setNewFacultyId(selectedCourse.assignedFacultyId || '');
    setNewModulesText(selectedCourse.syllabusModules.join('\n'));
    setIsEditModalOpen(true);
  };

  const handleAssignFaculty = async (courseId: string, facultyId: string) => {
    const fac = apiFaculty.find(f => f.id === facultyId);
    if (!fac) return;

    try {
      await api.patch(`/scheduling/subjects/${courseId}/`, { coordinator: facultyId });
      const updated = {
        ...selectedCourse,
        assignedFacultyId: fac.id,
        assignedFacultyName: fac.full_name,
      };
      onUpdateCourse(updated);
      setSelectedCourse(updated);
      toast.success(`Assigned ${fac.full_name} as course coordinator!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to assign faculty');
    }
  };

  const PO_LIST = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PO12'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* ── Top Header Banner ── */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        padding: '20px 24px',
        border: '1px solid #E2E8F0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: '#EEF2FF',
              color: '#4F46E5',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
            }}>
              Department Curriculum Authority
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B' }}>• NBA & OBE Compliant</span>
          </div>
          <h2 style={{ margin: '6px 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
            Course Curriculum, CO-PO Mapping & Faculty Allocation
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#64748B' }}>
            HOD manages department course syllabi, defines Bloom's level Course Outcomes, maps PO vectors, and delegates teaching faculty.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
            color: 'white',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
          }}
        >
          <Plus size={16} /> ➕ Add New Course
        </button>
      </div>

      {/* ── Main Two-Column Layout: Left (Course Selector List) & Right (Course & CO-PO Detail) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Course Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', paddingLeft: '4px' }}>
            Department Course Catalog ({courses.length})
          </div>

          {courses.map(c => {
            const isSelected = selectedCourse?.code === c.code;
            return (
              <div
                key={c.code}
                onClick={() => setSelectedCourse(c)}
                style={{
                  background: isSelected ? '#F8FAFC' : '#FFFFFF',
                  borderRadius: '14px',
                  padding: '16px',
                  border: isSelected ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 12px rgba(79,70,229,0.08)' : '0 1px 2px rgba(0,0,0,0.02)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '0.78rem',
                    fontWeight: 900,
                    color: isSelected ? '#4F46E5' : '#0F172A',
                    background: isSelected ? '#EEF2FF' : '#F1F5F9',
                    padding: '3px 8px',
                    borderRadius: '6px',
                  }}>
                    {c.code}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B' }}>
                    {c.credits} Credits
                  </span>
                </div>

                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0F172A', marginBottom: '6px', lineHeight: 1.3 }}>
                  {c.title}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={13} color="#4F46E5" />
                  <span>{c.assignedFacultyName || 'Unassigned'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Active Course Studio */}
        {selectedCourse && (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '18px',
            border: '1px solid #E2E8F0',
            padding: '24px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          }}>
            
            {/* Course Header & Faculty In-Charge Assignment */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              paddingBottom: '20px',
              borderBottom: '1px solid #F1F5F9',
              marginBottom: '20px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 900, color: '#4F46E5' }}>{selectedCourse.code}</span>
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>•</span>
                  <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{selectedCourse.semester}</span>
                  <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>•</span>
                  <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>{selectedCourse.credits} Credits</span>
                </div>
                <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#0F172A' }}>
                  {selectedCourse.title}
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Faculty Delegate Dropdown */}
                <div style={{
                  background: '#F8FAFC',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                      Course In-Charge Faculty
                    </div>
                    <select
                      id="assign-faculty"
                      name="assign-faculty"
                      value={selectedCourse.assignedFacultyId || ''}
                      onChange={(e) => handleAssignFaculty(selectedCourse.id, e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: '0.88rem',
                        fontWeight: 800,
                        color: '#0F172A',
                        cursor: 'pointer',
                        outline: 'none',
                        padding: 0,
                      }}
                    >
                      <option value="">-- Unassigned --</option>
                      {apiFaculty.map(fac => (
                        <option key={fac.id} value={fac.id}>{fac.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Edit and Delete Actions */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', paddingLeft: '8px', borderLeft: '1px solid #E2E8F0' }}>
                  <button
                    onClick={openEditModal}
                    title="Edit Course"
                    style={{
                      background: '#EEF2FF',
                      border: 'none',
                      color: '#4F46E5',
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#E0E7FF'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#EEF2FF'}
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteCourse(selectedCourse.id)}
                    title="Delete Course"
                    style={{
                      background: '#FEF2F2',
                      border: 'none',
                      color: '#EF4444',
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEE2E2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#FEF2F2'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Syllabus Modules */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Layers size={18} color="#4F46E5" />
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                  Syllabus Modules ({selectedCourse.syllabusModules.length})
                </h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedCourse.syllabusModules.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#F8FAFC',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '0.82rem',
                      color: '#334155',
                      fontWeight: 600,
                    }}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* Course Outcomes (CO) & Program Outcome (PO) Matrix */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} color="#4F46E5" />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                    Course Outcomes (CO) & PO Correlation Matrix
                  </h4>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isEditingMatrix ? (
                    <>
                      <button
                        onClick={() => {
                          setDraftMatrix(selectedCourse.coPoMapping || {});
                          setIsEditingMatrix(false);
                        }}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', background: 'white', color: '#64748B', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveMatrix}
                        disabled={isSavingMatrix}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#10B981', color: 'white', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        {isSavingMatrix ? 'Saving...' : 'Save Matrix'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingMatrix(true)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#475569', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit2 size={12} /> Edit Matrix
                    </button>
                  )}
                </div>
              </div>

              {/* Add CO Form */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '12px', background: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ flex: '0 0 100px' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>CO Code *</label>
                  <input
                    type="text"
                    value={newCoCode}
                    onChange={e => setNewCoCode(e.target.value)}
                    placeholder="e.g. CO1"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Description (optional)</label>
                  <input
                    type="text"
                    value={newCoDesc}
                    onChange={e => setNewCoDesc(e.target.value)}
                    placeholder="e.g. Apply mathematical concepts to solve engineering problems"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleAddCO}
                  disabled={!newCoCode.trim()}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    background: newCoCode.trim() ? '#4F46E5' : '#CBD5E1',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: newCoCode.trim() ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Add CO
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 800, color: '#334155', width: '60px' }}>CO #</th>
                      <th style={{ padding: '8px 10px', fontWeight: 800, color: '#334155' }}>Outcome Description</th>
                      {PO_LIST.map(po => (
                        <th key={po} style={{ padding: '8px 4px', fontWeight: 800, color: '#475569', textAlign: 'center', width: '36px' }}>
                          {po}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCourse.outcomes.length === 0 ? (
                      <tr>
                        <td colSpan={14} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                          No course outcomes defined for this subject.
                        </td>
                      </tr>
                    ) : (
                      selectedCourse.outcomes.map(co => (
                        <tr key={co.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '10px', fontWeight: 800, color: '#4F46E5' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {co.id}
                              <button
                                onClick={() => handleRemoveCO(co.id)}
                                title="Remove CO"
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  lineHeight: 1,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '10px', color: '#1E293B', fontWeight: 500, lineHeight: 1.4 }}>{co.description}</td>
                          {PO_LIST.map(po => {
                            const score = isEditingMatrix
                              ? (draftMatrix[co.id]?.[po] || 0)
                              : (selectedCourse.coPoMapping?.[co.id]?.[po] || 0);

                            return (
                              <td key={po} style={{ textAlign: 'center', padding: '6px' }}>
                                {isEditingMatrix ? (
                                  <button
                                    onClick={() => {
                                      setDraftMatrix(prev => {
                                        const currentScore = prev[co.id]?.[po] || 0;
                                        const newScore = currentScore === 3 ? 0 : currentScore + 1;
                                        return {
                                          ...prev,
                                          [co.id]: {
                                            ...(prev[co.id] || {}),
                                            [po]: newScore
                                          }
                                        };
                                      });
                                    }}
                                    style={{
                                      width: '26px',
                                      height: '26px',
                                      borderRadius: '4px',
                                      border: score > 0 ? 'none' : '1px solid #CBD5E1',
                                      background: score === 3 ? '#10B981' : score === 2 ? '#3B82F6' : score === 1 ? '#F59E0B' : 'white',
                                      color: score > 0 ? 'white' : '#94A3B8',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {score > 0 ? score : '-'}
                                  </button>
                                ) : (
                                  <span style={{
                                    display: 'inline-block',
                                    width: 22,
                                    height: 22,
                                    borderRadius: '4px',
                                    background: score === 3 ? '#D1FAE5' : score === 2 ? '#DBEAFE' : score === 1 ? '#FEF3C7' : 'transparent',
                                    color: score === 3 ? '#059669' : score === 2 ? '#1D4ED8' : score === 1 ? '#D97706' : '#CBD5E1',
                                    fontWeight: 900,
                                    fontSize: '0.75rem',
                                    lineHeight: '22px',
                                  }}>
                                    {score > 0 ? score : '-'}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Enrolled Students Section */}
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={18} color="#4F46E5" />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0F172A' }}>
                    Enrolled Students ({enrolledStudents.length})
                  </h4>
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
                {/* Filter input */}
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={enrollFilter}
                    onChange={e => setEnrollFilter(e.target.value)}
                    placeholder="Search by USN or name..."
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Select All + Enroll All */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, accentColor: '#4F46E5' }}
                    />
                    Select All ({filteredStudents.length})
                  </label>
                  <span style={{ color: '#CBD5E1' }}>|</span>
                  <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
                    {selectedStudents.size} selected
                  </span>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={handleEnrollAllDeptStudents}
                    disabled={enrolling}
                    style={{
                      padding: '8px 16px',
                      background: !enrolling ? '#4F46E5' : '#CBD5E1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: !enrolling ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {enrolling ? 'Enrolling...' : 'Enroll All Students'}
                  </button>
                  <button
                    type="button"
                    onClick={handleEnrollAll}
                    disabled={selectedStudents.size === 0 || enrolling}
                    style={{
                      padding: '8px 16px',
                      background: selectedStudents.size > 0 && !enrolling ? '#16A34A' : '#CBD5E1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: selectedStudents.size > 0 && !enrolling ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {enrolling ? 'Enrolling...' : `Enroll Selected (${selectedStudents.size})`}
                  </button>
                </div>

                {/* Student list with checkboxes */}
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white' }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ padding: '12px', fontSize: '0.82rem', color: '#94A3B8', textAlign: 'center' }}>
                      {availableStudents.length === 0 ? 'All students are already enrolled.' : 'No students match your filter.'}
                    </div>
                  ) : (
                    filteredStudents.map((s: any) => (
                      <label
                        key={s.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          background: selectedStudents.has(s.usn) ? '#EEF2FF' : 'white',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(s.usn)}
                          onChange={() => toggleStudentSelect(s.usn)}
                          style={{ width: 16, height: 16, accentColor: '#4F46E5' }}
                        />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', minWidth: '120px' }}>{s.usn}</span>
                        <span style={{ fontSize: '0.82rem', color: '#475569' }}>{s.full_name || s.email}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {isFetchingStudents ? (
                <div style={{ fontSize: '0.85rem', color: '#64748B' }}>Loading students...</div>
              ) : enrolledStudents.length === 0 ? (
                <div style={{ fontSize: '0.85rem', color: '#64748B', fontStyle: 'italic' }}>No students currently enrolled in this subject.</div>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ background: '#F1F5F9' }}>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>USN</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>Enrolled On</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolledStudents.map((enrollment: any) => (
                        <tr key={enrollment.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0F172A' }}>{enrollment.student_usn}</td>
                          <td style={{ padding: '8px 12px', color: '#334155' }}>{enrollment.student_name || 'N/A'}</td>
                          <td style={{ padding: '8px 12px', color: '#64748B' }}>{new Date(enrollment.enrolled_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ── Modal: Create New Course ── */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '600px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                    Create Department Course
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>
                    Define syllabus modules and assign initial teaching faculty
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ padding: '24px', maxHeight: '68vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Course Code *</label>
                    <input
                      id="new-course-code"
                      name="new-course-code"
                      type="text"
                      required
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="e.g. CS303"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Course Title *</label>
                    <input
                      id="new-course-title"
                      name="new-course-title"
                      type="text"
                      required
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g. Computer Networks"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Credits *</label>
                    <input
                      id="new-credits"
                      name="new-credits"
                      type="number"
                      min="1"
                      max="6"
                      required
                      value={newCredits}
                      onChange={e => setNewCredits(parseInt(e.target.value) || 3)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Semester</label>
                    <select
                      id="new-semester"
                      name="new-semester"
                      value={newSemester}
                      onChange={e => setNewSemester(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, background: 'white' }}
                    >
                      <option value="1st Semester B.Tech">1st Semester B.Tech</option>
                      <option value="2nd Semester B.Tech">2nd Semester B.Tech</option>
                      <option value="3rd Semester B.Tech">3rd Semester B.Tech</option>
                      <option value="4th Semester B.Tech">4th Semester B.Tech</option>
                      <option value="5th Semester B.Tech">5th Semester B.Tech</option>
                      <option value="6th Semester B.Tech">6th Semester B.Tech</option>
                      <option value="7th Semester B.Tech">7th Semester B.Tech</option>
                      <option value="8th Semester B.Tech">8th Semester B.Tech</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Assign Teaching Faculty *</label>
                  <select
                    id="new-faculty"
                    name="new-faculty"
                    value={newFacultyId}
                    onChange={e => setNewFacultyId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, background: 'white' }}
                  >
                    {apiFaculty.map(f => (
                      <option key={f.id} value={f.id}>{f.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Syllabus Modules (One per line)</label>
                  <textarea
                    id="new-modules"
                    name="new-modules"
                    rows={5}
                    value={newModulesText}
                    onChange={e => setNewModulesText(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC',
              }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                  }}
                >
                  Create Course & Map Outcomes ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Course ── */}
      {isEditModalOpen && selectedCourse && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            maxWidth: '600px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#F8FAFC',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: '#EEF2FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0F172A' }}>
                    Edit Course Details
                  </h3>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ padding: '24px', maxHeight: '68vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Course Code *</label>
                    <input
                      id="edit-course-code"
                      name="edit-course-code"
                      type="text"
                      required
                      value={newCode}
                      onChange={e => setNewCode(e.target.value)}
                      placeholder="e.g. CS303"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Course Title *</label>
                    <input
                      id="edit-course-title"
                      name="edit-course-title"
                      type="text"
                      required
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      placeholder="e.g. Computer Networks"
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Credits *</label>
                    <input
                      id="edit-credits"
                      name="edit-credits"
                      type="number"
                      min="1"
                      max="6"
                      required
                      value={newCredits}
                      onChange={e => setNewCredits(parseInt(e.target.value) || 3)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Semester</label>
                    <select
                      id="edit-semester"
                      name="edit-semester"
                      value={newSemester}
                      onChange={e => setNewSemester(e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, background: 'white' }}
                    >
                      <option value="1st Semester B.Tech">1st Semester B.Tech</option>
                      <option value="2nd Semester B.Tech">2nd Semester B.Tech</option>
                      <option value="3rd Semester B.Tech">3rd Semester B.Tech</option>
                      <option value="4th Semester B.Tech">4th Semester B.Tech</option>
                      <option value="5th Semester B.Tech">5th Semester B.Tech</option>
                      <option value="6th Semester B.Tech">6th Semester B.Tech</option>
                      <option value="7th Semester B.Tech">7th Semester B.Tech</option>
                      <option value="8th Semester B.Tech">8th Semester B.Tech</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Assign Teaching Faculty *</label>
                  <select
                    id="edit-faculty"
                    name="edit-faculty"
                    value={newFacultyId}
                    onChange={e => setNewFacultyId(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, background: 'white' }}
                  >
                    <option value="">-- Select Faculty --</option>
                    {apiFaculty.map(f => (
                      <option key={f.id} value={f.id}>{f.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Syllabus Modules (One per line)</label>
                  <textarea
                    id="edit-modules"
                    name="edit-modules"
                    rows={5}
                    value={newModulesText}
                    onChange={e => setNewModulesText(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.82rem', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #E2E8F0',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                background: '#F8FAFC',
              }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: 'white', color: '#475569', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                  }}
                >
                  Save Changes ✓
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
