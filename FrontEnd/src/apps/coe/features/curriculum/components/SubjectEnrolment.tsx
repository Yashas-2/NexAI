import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { UserPlus } from 'lucide-react';

import { api } from '@/services/api';

interface SubjectEnrolmentProps {
  subjectId: string;
  subjectCode: string;
  subjectTitle: string;
}

interface EnrolledStudent {
  id: string;
  student_usn: string;
  student_name: string;
  enrolled_at: string;
}

interface StudentOption {
  id: string;
  usn: string;
  full_name: string;
  email: string;
}

export const SubjectEnrolment: React.FC<SubjectEnrolmentProps> = ({ subjectId, subjectCode }) => {
  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollFilter, setEnrollFilter] = useState('');

  const fetchEnrolled = () => {
    if (!subjectId) return;
    api.get(`/scheduling/subjects/${subjectId}/enrolled-students/`)
      .then(res => setStudents(res.data.results || res.data))
      .catch(() => setStudents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEnrolled();
    api.get('/auth/users/?role=STUDENT&page_size=500')
      .then(res => setAllStudents(res.data.results || res.data))
      .catch(() => setAllStudents([]));
  }, [subjectId]);

  const handleEnrollAll = async () => {
    if (selectedStudents.size === 0) return;
    setEnrolling(true);
    try {
      const usns = Array.from(selectedStudents);
      const res = await api.post(`/scheduling/subjects/${subjectId}/batch-enroll/`, { usns });
      const data = res.data;
      setSelectedStudents(new Set());
      if (data.not_found?.length > 0) {
        alert(`Enrolled ${data.total_enrolled} students. ${data.not_found.length} USNs not found.`);
      }
      fetchEnrolled();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to enroll students');
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
      setSelectedStudents(new Set(filteredStudents.map(s => s.usn)));
    }
  };

  const enrolledUsns = new Set(students.map(s => s.student_usn));
  const availableStudents = allStudents.filter(s => !enrolledUsns.has(s.usn));
  const filteredStudents = availableStudents.filter(s => {
    const q = enrollFilter.toLowerCase();
    return !q || s.usn.toLowerCase().includes(q) || (s.full_name || '').toLowerCase().includes(q);
  });

  return (
    <Card variant="flat">
      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
        <div style={{ flex: 1, background: 'var(--color-bg-surface)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Total Enrolled</p>
          <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-primary)' }}>{students.length}</h3>
        </div>
      </div>

      {/* Enroll Student Section */}
      <div style={{
        background: '#F0FDF4',
        border: '1.5px solid #BBF7D0',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <UserPlus size={20} color="#16A34A" />
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#166534' }}>
            Enroll Students into {subjectCode}
          </div>
        </div>

        {/* Filter input */}
        <input
          type="text"
          value={enrollFilter}
          onChange={e => setEnrollFilter(e.target.value)}
          placeholder="Search by USN or name..."
          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #BBF7D0', fontSize: '0.85rem', marginBottom: '10px', boxSizing: 'border-box' }}
        />

        {/* Select All + Enroll All */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#166534', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, accentColor: '#16A34A' }}
            />
            Select All ({filteredStudents.length})
          </label>
          <span style={{ color: '#BBF7D0' }}>|</span>
          <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
            {selectedStudents.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleEnrollAll}
            disabled={selectedStudents.size === 0 || enrolling}
            style={{
              padding: '8px 16px',
              background: selectedStudents.size > 0 && !enrolling ? 'linear-gradient(135deg, #16A34A, #15803D)' : '#CBD5E1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: selectedStudents.size > 0 && !enrolling ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={14} /> {enrolling ? 'Enrolling...' : `Enroll All (${selectedStudents.size})`}
          </button>
        </div>

        {/* Student list with checkboxes */}
        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #BBF7D0', borderRadius: '8px', background: 'white' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '0.82rem', color: '#94A3B8', textAlign: 'center' }}>
              {availableStudents.length === 0 ? 'All students are already enrolled.' : 'No students match your filter.'}
            </div>
          ) : (
            filteredStudents.map(s => (
              <label
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderBottom: '1px solid #F0FDF4',
                  cursor: 'pointer',
                  background: selectedStudents.has(s.usn) ? '#ECFDF5' : 'white',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedStudents.has(s.usn)}
                  onChange={() => toggleStudentSelect(s.usn)}
                  style={{ width: 16, height: 16, accentColor: '#16A34A' }}
                />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', minWidth: '120px' }}>{s.usn}</span>
                <span style={{ fontSize: '0.82rem', color: '#475569' }}>{s.full_name || s.email}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <h3 style={{ marginBottom: '16px' }}>Enrolled Students</h3>
      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading enrolled students...</p>
      ) : students.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No students enrolled in this subject yet. Use the list above to enroll students.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
              <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>USN</th>
              <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Name</th>
              <th style={{ padding: '12px', color: 'var(--color-text-secondary)' }}>Enrolled On</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px', fontWeight: 500 }}>{student.student_usn}</td>
                <td style={{ padding: '12px' }}>{student.student_name}</td>
                <td style={{ padding: '12px' }}>{new Date(student.enrolled_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};
