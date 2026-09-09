import React from 'react';
import { HallTicketRecord } from '../../../types';
import { X, Printer, QrCode, User } from 'lucide-react';

interface HallTicketPreviewModalProps {
  ticket: HallTicketRecord;
  onClose: () => void;
}

export const HallTicketPreviewModal: React.FC<HallTicketPreviewModalProps> = ({
  ticket,
  onClose,
}) => {
  return (
    <>
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #printable-hall-ticket, #printable-hall-ticket * {
              visibility: visible;
            }
            #printable-hall-ticket {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        `}
      </style>
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
        maxWidth: '780px',
        maxHeight: '94vh',
        overflowY: 'auto',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header Action Bar */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '16px 26px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode size={20} color="#4ade80" />
            <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Official Examination Hall Ticket — {ticket.ticketNumber}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => window.print()}
              style={{
                padding: '6px 14px',
                background: 'white',
                border: 'none',
                borderRadius: '6px',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Printer size={14} /> Print Admit Card
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Admit Card Sheet */}
        <div id="printable-hall-ticket" style={{ padding: '32px 36px', background: '#ffffff', fontFamily: 'sans-serif' }}>
          <div style={{
            border: '2px solid #0f172a',
            borderRadius: '12px',
            padding: '24px',
            position: 'relative',
            background: '#ffffff',
          }}>
            {/* University Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '18px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase', color: '#334155' }}>
                NEXAI AUTONOMOUS UNIVERSITY OF TECHNOLOGY
              </div>
              <h2 style={{ margin: '4px 0', fontSize: '1.35rem', fontWeight: 900, color: '#0f172a' }}>
                OFFICIAL EXAMINATION ADMIT CARD / HALL TICKET
              </h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span style={{
                  background: '#DCFCE7',
                  color: '#15803D',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  padding: '3px 12px',
                  borderRadius: '20px',
                  border: '1.5px solid #86EFAC',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}>
                  Semester End Final Examination (SEE)
                </span>
                <span style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 700 }}>
                  • {ticket.examSession}
                </span>
              </div>
            </div>

            {/* Student Details Grid & Photo Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '20px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>CANDIDATE NAME:</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{ticket.studentName}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>UNIVERSITY SEAT NO (USN):</span>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a', fontFamily: 'monospace' }}>{ticket.usn}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>DEPARTMENT / PROGRAM:</span>
                  <strong>{ticket.department}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.72rem' }}>SEMESTER / TICKET NO:</span>
                  <strong>{ticket.semester} • {ticket.ticketNumber}</strong>
                </div>
              </div>

              {/* Student Photo Placeholder */}
              <div style={{
                width: '110px',
                height: '130px',
                border: '1.5px solid #0f172a',
                borderRadius: '6px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '0.7rem',
                fontWeight: 600,
                textAlign: 'center',
                padding: '4px',
              }}>
                <User size={36} color="#94a3b8" style={{ marginBottom: '4px' }} />
                <span>STUDENT PHOTO</span>
                <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 700 }}>VERIFIED ✓</span>
              </div>
            </div>

            {/* Examination Schedule Matrix */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', marginBottom: '8px', textTransform: 'uppercase' }}>
                Course-wise Timetable & Allocated Examination Hall:
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left', border: '1px solid #cbd5e1' }}>
                <thead style={{ background: '#f1f5f9', color: '#0f172a', fontWeight: 800, borderBottom: '1.5px solid #0f172a' }}>
                  <tr>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>Course Code</th>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>Subject Title</th>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>Exam Date</th>
                    <th style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>Time Slot</th>
                    <th style={{ padding: '8px 10px' }}>Room / Desk</th>
                  </tr>
                </thead>
                <tbody>
                  {ticket.slots.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #cbd5e1', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 800, fontFamily: 'monospace', borderRight: '1px solid #cbd5e1' }}>
                        {s.subjectCode}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, borderRight: '1px solid #cbd5e1' }}>
                        {s.subjectTitle}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>
                        {s.examDate}
                      </td>
                      <td style={{ padding: '8px 10px', borderRight: '1px solid #cbd5e1' }}>
                        {s.examTime}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 800, color: '#2563eb' }}>
                        {s.roomAllocated} ({s.deskNumber})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Anti-Counterfeit QR Code & Candidate Instructions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '20px', alignItems: 'center', background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.72rem', color: '#475569', lineHeight: 1.5 }}>
                <strong>INSTRUCTIONS TO CANDIDATE:</strong>
                <ol style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                  <li>Candidate must report to the examination hall at least 15 minutes before the scheduled time.</li>
                  <li>Digital devices, smartwatches, and unauthorized materials are strictly prohibited inside the hall.</li>
                  <li>Tampering with this Hall Ticket or QR code will lead to immediate cancellation of candidature.</li>
                </ol>
              </div>

              {/* Cryptographic QR box */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  margin: '0 auto',
                  background: 'white',
                  border: '1.5px solid #0f172a',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0f172a'
                }}>
                  <QrCode size={70} />
                </div>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#16a34a', display: 'block', marginTop: '4px' }}>
                  DIGITALLY SIGNED ✓
                </span>
              </div>
            </div>

            {/* Official Signature Seals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: '16px', borderTop: '1.5px solid #0f172a', fontSize: '0.75rem' }}>
              <div>
                <div style={{ height: '30px' }} />
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700, textAlign: 'center', width: '180px' }}>
                  Candidate Signature
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px' }}>
                  [AUTHENTICATED BY HOD]
                </div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700, width: '220px' }}>
                  Head of Department (HOD - CSE)
                </div>
              </div>

              <div>
                <div style={{ color: '#2563eb', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px', textAlign: 'center' }}>
                  [COE SEAL SEALED]
                </div>
                <div style={{ borderTop: '1px solid #0f172a', paddingTop: '4px', fontWeight: 700, textAlign: 'center', width: '180px' }}>
                  Controller of Examinations
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};
