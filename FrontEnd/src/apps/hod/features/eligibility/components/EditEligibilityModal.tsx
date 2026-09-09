import React, { useState } from 'react';
import { X, Edit3, Save } from 'lucide-react';
import { StudentEligibilityRecord } from '../../../types';
import { api } from '@/services/api';
import toast from 'react-hot-toast';

interface EditEligibilityModalProps {
  student: StudentEligibilityRecord;
  onUpdateStudent: (updated: StudentEligibilityRecord) => void;
  onClose: () => void;
}

export const EditEligibilityModal: React.FC<EditEligibilityModalProps> = ({
  student,
  onUpdateStudent,
  onClose,
}) => {
  const [usn, setUsn] = useState(student.usn);
  const [name, setName] = useState(student.name);
  const [semester, setSemester] = useState(student.semester);
  const [subjectCode, setSubjectCode] = useState(student.subjectCode || '');
  const [subjectTitle, setSubjectTitle] = useState(student.subjectTitle || '');
  const [attendancePercent, setAttendancePercent] = useState<number>(student.attendancePercent);
  const [classesAttended, setClassesAttended] = useState<number>(student.classesAttended);
  const [totalClassesHeld, setTotalClassesHeld] = useState<number>(student.totalClassesHeld);
  const [cieMarksAvg, setCieMarksAvg] = useState<number>(student.cieMarksAvg);
  const [status, setStatus] = useState<StudentEligibilityRecord['status']>(student.status);
  const [condonationApproved, setCondonationApproved] = useState<boolean>(student.condonationApproved || false);
  const [hasFeeDues, setHasFeeDues] = useState<boolean>(student.hasFeeDues || false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAttendanceChange = (val: number) => {
    setAttendancePercent(val);
    if (val < 65 || cieMarksAvg < 20) {
      setStatus('DETAINED');
    } else if (val < 75) {
      setStatus('CONDONABLE');
    } else if (!hasFeeDues) {
      setStatus('ELIGIBLE');
    }
  };

  const handleCieChange = (val: number) => {
    setCieMarksAvg(val);
    if (attendancePercent < 65 || val < 20) {
      setStatus('DETAINED');
    } else if (attendancePercent < 75) {
      setStatus('CONDONABLE');
    } else if (!hasFeeDues) {
      setStatus('ELIGIBLE');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student.id) return;

    setIsSaving(true);
    
    try {
      const res = await api.put(`/eligibility/records/${student.id}/`, {
        usn,
        name,
        semester,
        subject_code: subjectCode,
        subject_title: subjectTitle,
        attendance_percentage: attendancePercent,
        classes_attended: classesAttended,
        total_classes_held: totalClassesHeld,
        cie_marks_avg: cieMarksAvg,
        status: hasFeeDues ? 'FEE_BLOCKED' : status,
        has_fee_dues: hasFeeDues,
        condonation_approved: status === 'CONDONABLE' ? condonationApproved : (status === 'ELIGIBLE'),
      });

      const r = res.data;
      const updated: StudentEligibilityRecord = {
        ...student,
        id: r.id,
        usn: r.usn,
        name: r.name,
        email: r.email,
        semester: r.semester,
        department: r.department,
        section: r.section,
        subjectCode: r.subject_code,
        subjectTitle: r.subject_title,
        facultyInCharge: r.faculty_in_charge,
        attendancePercent: parseFloat(r.attendance_percentage || '0'),
        totalClassesHeld: r.total_classes_held,
        classesAttended: r.classes_attended,
        cieMarksAvg: parseFloat(r.cie_marks_avg || '0'),
        status: r.is_eligible ? 'ELIGIBLE' : 'DETAINED',
        hasFeeDues: r.has_fee_dues || false,
        condonationApproved: r.condonation_approved || false,
      };

      onUpdateStudent(updated);
      toast.success(`Updated eligibility record for ${usn}`);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to update';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.7)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '20px 28px',
          color: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Edit3 size={20} color="#38bdf8" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Edit Eligibility Record</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>USN: {student.usn} • {student.subjectCode || 'Course'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Student USN</label>
              <input type="text" value={usn} onChange={e => setUsn(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Student Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Semester</label>
              <input type="text" value={semester} onChange={e => setSemester(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Subject Code</label>
              <input type="text" value={subjectCode} onChange={e => setSubjectCode(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700, boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Subject Title</label>
              <input type="text" value={subjectTitle} onChange={e => setSubjectTitle(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Attendance %</label>
              <input type="number" min="0" max="100" value={attendancePercent} onChange={e => handleAttendanceChange(parseFloat(e.target.value) || 0)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Attended / Total</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="number" value={classesAttended} onChange={e => setClassesAttended(parseInt(e.target.value) || 0)} style={{ width: '50%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'center' }} />
                <span>/</span>
                <input type="number" value={totalClassesHeld} onChange={e => setTotalClassesHeld(parseInt(e.target.value) || 40)} style={{ width: '50%', padding: '8px 6px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem', textAlign: 'center' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>CIE Score (/50)</label>
              <input type="number" min="0" max="50" value={cieMarksAvg} onChange={e => handleCieChange(parseFloat(e.target.value) || 0)} required style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, boxSizing: 'border-box' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Eligibility Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 700, backgroundColor: '#f8fafc' }}>
              <option value="ELIGIBLE">ELIGIBLE (Approved for Exam)</option>
              <option value="CONDONABLE">CONDONABLE SHORTAGE (65% - 74%)</option>
              <option value="DETAINED">DETAINED (&lt;65% or Low CIE)</option>
              <option value="FEE_BLOCKED">FEE DUES BLOCKED</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              <input type="checkbox" checked={condonationApproved} onChange={e => setCondonationApproved(e.target.checked)} />
              Approve Condonation Waiver for Shortage
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600, color: '#e11d48', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasFeeDues} onChange={e => { setHasFeeDues(e.target.checked); if (e.target.checked) setStatus('FEE_BLOCKED'); }} />
              Flag Fee Dues Blockage
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} disabled={isSaving} style={{ padding: '8px 16px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} style={{ padding: '8px 20px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={14} /> {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
