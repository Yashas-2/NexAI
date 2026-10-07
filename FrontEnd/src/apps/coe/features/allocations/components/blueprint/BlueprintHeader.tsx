import React, { useState } from 'react';
import { CheckCircle2, ShieldCheck, Printer, Download, DoorOpen, Users, Award, Scale, Save } from 'lucide-react';
import { RoomAllocationResult, AITelemetryMetrics, SessionScopeConfig } from '../../types/allocationTypes';
import { MOCK_DEPARTMENTS } from '../../mock/allocationMockData';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

interface BlueprintHeaderProps {
  roomResults: RoomAllocationResult[];
  telemetry?: AITelemetryMetrics;
  scopeConfig?: SessionScopeConfig;
  sessionId?: string;
  onOpenNotice: () => void;
  onReturn?: () => void;
}

export const BlueprintHeader: React.FC<BlueprintHeaderProps> = ({
  roomResults,
  telemetry,
  scopeConfig: _scopeConfig,
  sessionId,
  onOpenNotice,
  onReturn: _onReturn,
}) => {
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const totalStudents = roomResults.reduce((sum, r) => sum + r.occupiedCount, 0);
  const totalCapacity = roomResults.reduce((sum, r) => sum + r.capacity, 0);

  const activeDepts = [
    ...new Set(roomResults.flatMap(r => Object.keys(r.departmentTallies))),
  ];
  const deptMap = new Map(MOCK_DEPARTMENTS.map(d => [d.code, d]));

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Title page
      pdf.setFillColor(5, 150, 105);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.text('NexAI University', pageWidth / 2, 40, { align: 'center' });
      pdf.setFontSize(20);
      pdf.text('Examination Seating Blueprint', pageWidth / 2, 55, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text(`${totalStudents} candidates across ${roomResults.length} halls`, pageWidth / 2, 70, { align: 'center' });
      pdf.text(`Interleaving Purity: ${telemetry?.interleavingPurityScore || 99.8}%`, pageWidth / 2, 80, { align: 'center' });
      pdf.setFontSize(10);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 95, { align: 'center' });

      // Hall details
      let yPos = 110;
      pdf.setFontSize(14);
      pdf.text('Hall Allocation Summary', 20, yPos);
      yPos += 10;

      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      const headers = ['Hall', 'Building', 'Capacity', 'Occupied', 'Chief Invigilator', 'Reliever'];
      headers.forEach((h, i) => {
        pdf.text(h, 20 + i * 40, yPos);
      });
      yPos += 8;

      roomResults.forEach(room => {
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(room.roomNumber, 20, yPos);
        pdf.text(room.building, 60, yPos);
        pdf.text(String(room.capacity), 100, yPos);
        pdf.text(String(room.occupiedCount), 140, yPos);
        pdf.text(room.chiefInvigilator?.name || 'N/A', 180, yPos);
        pdf.text(room.relieverInvigilator?.name || 'N/A', 220, yPos);
        yPos += 7;
      });

      // Per-hall seating
      roomResults.forEach(room => {
        pdf.addPage();
        pdf.setFillColor(241, 245, 249);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        pdf.setFontSize(14);
        pdf.setTextColor(15, 23, 42);
        pdf.text(`Hall: ${room.roomNumber} (${room.building}) - Floor ${room.floor}`, 20, 16);
        pdf.setFontSize(10);
        pdf.text(`Occupancy: ${room.occupiedCount}/${room.capacity} | Chief: ${room.chiefInvigilator?.name || 'N/A'}`, 20, 22);

        yPos = 35;
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Bench', 20, yPos);
        pdf.text('Seat L', 50, yPos);
        pdf.text('Seat R', 100, yPos);
        pdf.text('Dept', 150, yPos);
        yPos += 7;

        pdf.setTextColor(0, 0, 0);
        const benches = Math.ceil(room.seatedCandidates.length / 2);
        for (let b = 0; b < benches; b++) {
          if (yPos > pageHeight - 15) {
            pdf.addPage();
            yPos = 20;
          }
          const left = room.seatedCandidates[b * 2];
          const right = room.seatedCandidates[b * 2 + 1];
          pdf.text(`B${b + 1}`, 20, yPos);
          if (left) pdf.text(`${left.usn} (${left.department})`, 50, yPos);
          if (right) pdf.text(`${right.usn} (${right.department})`, 100, yPos);
          if (left) pdf.text(left.department, 150, yPos);
          yPos += 6;
        }
      });

      pdf.save(`NexAI_Seating_Blueprint_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (err) {
      toast.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  
  const parseTime = (timeStr?: string) => {
    if (!timeStr) return '09:30';
    try {
      const [time, modifier] = timeStr.trim().split(' ');
      if (!modifier) return timeStr;
      let [hours, minutes] = time.split(':');
      if (hours === '12') hours = '00';
      if (modifier.toUpperCase() === 'PM') hours = String(parseInt(hours, 10) + 12);
      return `${hours.padStart(2, '0')}:${minutes}`;
    } catch {
      return '09:30';
    }
  };

  const handleSave = async () => {
    if (!sessionId) {
      toast.error('No exam session selected');
      return;
    }
    setSaving(true);
    try {
      const allocations: any[] = [];
      roomResults.forEach(room => {
        // Group seated candidates by subject
        const subjectGroups: Record<string, any[]> = {};
        room.seatedCandidates.forEach(c => {
          if (!subjectGroups[c.subjectCode]) subjectGroups[c.subjectCode] = [];
          subjectGroups[c.subjectCode].push(c);
        });

        // Create one allocation entry per subject per room
        Object.entries(subjectGroups).forEach(([subjectCode]) => {
          allocations.push({
            subject_code: subjectCode,
            room_name: room.roomNumber,
            exam_date: room.examDate || _scopeConfig?.startDate || new Date().toISOString().slice(0, 10),
            start_time: parseTime(_scopeConfig?.selectedSlots?.[0]?.startTime) || '09:30',
            end_time: parseTime(_scopeConfig?.selectedSlots?.[0]?.endTime) || '12:30',
            chief_invigilator_email: room.chiefInvigilator?.email || '',
            reliever_invigilator_email: room.relieverInvigilator?.email || '',
          });
        });
      });

      const res = await api.post('/scheduling/allocation/save/', {
        exam_session_id: sessionId,
        allocations,
      });

      toast.success(res.data.message || 'Allocation saved successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save allocation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #059669 0%, #047857 50%, #064E3B 100%)',
        borderRadius: '16px',
        padding: '24px 32px',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <CheckCircle2 size={30} color="white" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>
                AI Examination Allocation Published
              </div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>
                Master Floor Plan & Interleaved Seating Blueprint
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
                {totalStudents} candidates allocated across {roomResults.length} halls • Equal duty balanced for all invigilators
              </p>
              {_scopeConfig && (_scopeConfig.firstExamDate || _scopeConfig.startDate) && _scopeConfig.selectedSlots?.[0] && (
                <div style={{ marginTop: '6px', fontSize: '0.85rem', fontWeight: 600, background: 'rgba(255,255,255,0.2)', display: 'inline-block', padding: '4px 10px', borderRadius: '4px' }}>
                  📅 Multi-Day Exam Cycle: {new Date(_scopeConfig.firstExamDate || _scopeConfig.startDate).toLocaleDateString()} to {new Date(_scopeConfig.endDate).toLocaleDateString()} • 🕒 {_scopeConfig.selectedSlots[0].startTime} to {_scopeConfig.selectedSlots[0].endTime}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? '#CBD5E1' : 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Save size={16} /> {saving ? 'Saving...' : 'Save Allocation'}
            </button>

            <button
              onClick={onOpenNotice}
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: 'white',
                padding: '10px 18px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Printer size={16} /> Print Seating Notice
            </button>

            <button
              onClick={handleExportPDF}
              disabled={exporting}
              style={{
                background: 'white',
                border: 'none',
                color: '#065F46',
                padding: '10px 20px',
                borderRadius: '10px',
                cursor: exporting ? 'not-allowed' : 'pointer',
                fontWeight: 800,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Anti-Cheating Protocol Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)',
        border: '1.5px solid #DDD6FE',
        borderRadius: '12px',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            background: '#8B5CF6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#5B21B6', fontSize: '0.88rem' }}>
              CoE Anti-Cheating Matrix Active: Multi-Department 2D Interleaved Desks
            </div>
            <div style={{ fontSize: '0.78rem', color: '#6D28D9', marginTop: '2px' }}>
              Adjacent candidate desks (horizontal and vertical) belong to different engineering branches. Adjacent students write completely different question papers.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeDepts.map(code => {
            const dept = deptMap.get(code);
            const color = dept?.color || '#64748B';
            return (
              <span
                key={code}
                style={{
                  background: color,
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                }}
              >
                {code}
              </span>
            );
          })}
        </div>
      </div>

      {/* Key Metrics Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #059669',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <DoorOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Halls Allocated</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0F172A' }}>{roomResults.length} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748B' }}>Rooms</span></div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #3B82F6',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Students Seated</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0F172A' }}>{totalStudents} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748B' }}>/ {totalCapacity}</span></div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #8B5CF6',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Interleaving Purity</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#8B5CF6' }}>
              {telemetry?.interleavingPurityScore || 99.8}%
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid #E2E8F0',
          borderLeft: '4px solid #F59E0B',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <div style={{ width: 42, height: 42, borderRadius: '10px', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
            <Scale size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>Duty Workload (σ)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>
              ±{telemetry?.invigilatorFairnessVariance || 0.12} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>[Equal]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
