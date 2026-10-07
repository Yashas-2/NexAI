import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/services/api';
import toast from 'react-hot-toast';
import { FileCheck, Eye, Check, X, RotateCw, AlertTriangle, Settings, Plus, Calendar, Clock, BookOpen, User } from 'lucide-react';

interface CIEQuestionPaperScrutiny {
  id: string;
  subject_code: string;
  cie_number: string;
  paper_title: string;
  paper_content: string;
  answer_key: string;
  submitted_by_name: string;
  submitted_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed_by_name: string;
  reviewed_at: string;
  review_note: string;
}

interface CIEConfiguration {
  id: string;
  subject: string;
  subject_code: string;
  exam_session: string;
  exam_session_name: string;
  cie_number: string;
  assigned_faculty: string;
  assigned_faculty_name: string;
  max_marks: number;
  duration_mins: number;
  scheduled_date: string;
  scheduled_time: string;
  is_active: boolean;
}

export const FacultyEndorsementTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'SCRUTINY' | 'CONFIGS'>('SCRUTINY');

  // Scrutiny States
  const [papers, setPapers] = useState<CIEQuestionPaperScrutiny[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);
  const [inspectingPaper, setInspectingPaper] = useState<CIEQuestionPaperScrutiny | null>(null);
  const [remarksText, setRemarksText] = useState<string>('');
  const [editedPaperContent, setEditedPaperContent] = useState<string>('');
  const [editedAnswerKey, setEditedAnswerKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Config States
  const [configs, setConfigs] = useState<CIEConfiguration[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  // Create Config Form State
  const [sessions, setSessions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    subject: '',
    exam_session: '',
    cie_number: 'CIE_1',
    assigned_faculty: '',
    max_marks: 50,
    duration_mins: 60,
    scheduled_date: '',
    scheduled_time: ''
  });

  const fetchPapers = async () => {
    try {
      setLoadingPapers(true);
      const res = await api.get('/cie/scrutiny/');
      const papers = res.data.results || res.data;
      setPapers(papers);
    } catch (err: any) {
      toast.error('Failed to load scrutiny papers');
    } finally {
      setLoadingPapers(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      setLoadingConfigs(true);
      const res = await api.get('/cie/configs/');
      setConfigs(res.data.results || res.data);
    } catch (err: any) {
      toast.error('Failed to load CIE configurations');
    } finally {
      setLoadingConfigs(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [sessRes, subRes, facRes] = await Promise.all([
        api.get('/scheduling/sessions/'),
        api.get('/scheduling/subjects/'),
        api.get('/auth/faculty/')
      ]);
      setSessions(sessRes.data.results || sessRes.data);
      setSubjects(subRes.data.results || subRes.data);
      setFaculty(facRes.data.results || facRes.data);
    } catch (err) {
      console.error("Failed to load dependencies");
    }
  };

  useEffect(() => {
    if (activeSubTab === 'SCRUTINY') fetchPapers();
    if (activeSubTab === 'CONFIGS') {
      fetchConfigs();
      fetchDependencies();
    }
  }, [activeSubTab]);

  // Refresh data when tab becomes visible (catches mid-session deletions)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (activeSubTab === 'SCRUTINY') fetchPapers();
        if (activeSubTab === 'CONFIGS') fetchConfigs();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [activeSubTab]);

  const openInspection = (paper: CIEQuestionPaperScrutiny) => {
    setInspectingPaper(paper);
    setRemarksText(paper.review_note || '');
    setEditedPaperContent(paper.paper_content || '');
    setEditedAnswerKey(paper.answer_key || '');
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    if (!inspectingPaper) return;
    if (action === 'reject' && !remarksText.trim()) {
      toast.error('Rejection note is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/cie/scrutiny/${inspectingPaper.id}/${action}/`, {
        note: remarksText.trim()
      });
      toast.success(`Paper successfully ${action}d`);
      fetchPapers();
      setInspectingPaper(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || `Failed to ${action} paper`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject || !formData.exam_session || !formData.assigned_faculty) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/cie/configs/', formData);
      toast.success('CIE Configuration created successfully');
      setIsConfigModalOpen(false);
      fetchConfigs();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.response?.data?.non_field_errors?.[0] || 'Failed to create config');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleConfigActive = async (id: string, currentlyActive: boolean) => {
    try {
      if (currentlyActive) {
        await api.delete(`/cie/configs/${id}/activate/`);
      } else {
        await api.post(`/cie/configs/${id}/activate/`);
      }
      toast.success(`CIE Configuration ${currentlyActive ? 'deactivated' : 'activated'}`);
      fetchConfigs();
    } catch (err) {
      toast.error('Failed to toggle active status');
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '12px' }}>
            <FileCheck size={28} color="#8b5cf6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#1e293b' }}>HOD CIE Management</h2>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>Configure CIE parameters and scrutinize question papers</p>
          </div>
        </div>
        
        {/* Sub-tab Navigation */}
        <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setActiveSubTab('SCRUTINY')}
            style={{
              padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              background: '#fff',
              color: '#3b82f6',
              fontWeight: 700,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            Paper Scrutiny
          </button>
        </div>
      </div>

      {activeSubTab === 'SCRUTINY' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loadingPapers ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
          ) : papers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <FileCheck size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
              <div>No question papers submitted for scrutiny yet</div>
            </div>
          ) : (
            papers.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {p.paper_title === 'Subject' ? p.subject_code : p.paper_title} 
                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: p.status === 'PENDING' ? '#fef3c7' : p.status === 'APPROVED' ? '#d1fae5' : '#fee2e2', color: p.status === 'PENDING' ? '#b45309' : p.status === 'APPROVED' ? '#047857' : '#b91c1c' }}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '6px', display: 'flex', gap: '16px' }}>
                    <span><strong style={{ color: '#475569' }}>Course:</strong> {p.subject_code}</span>
                    <span><strong style={{ color: '#475569' }}>Test:</strong> {p.cie_number.replace('_', ' ')}</span>
                    <span><strong style={{ color: '#475569' }}>Submitted By:</strong> {p.submitted_by_name}</span>
                  </div>
                </div>
                <button 
                  onClick={() => openInspection(p)}
                  style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Eye size={16} /> {p.status === 'PENDING' ? 'Scrutinize' : 'View Result'}
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              style={{ padding: '10px 20px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> New CIE Configuration
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {loadingConfigs ? (
              <div style={{ textAlign: 'center', padding: '40px', gridColumn: '1 / -1' }}>Loading...</div>
            ) : configs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', gridColumn: '1 / -1' }}>
                <Settings size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
                <div>No CIE Configurations created yet</div>
              </div>
            ) : (
              configs.map(c => (
                <div key={c.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: 16, right: 16 }}>
                    <span style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '12px', background: c.is_active ? '#d1fae5' : '#f1f5f9', color: c.is_active ? '#047857' : '#64748b', fontWeight: 700 }}>
                      {c.is_active ? 'ACTIVE' : 'DRAFT'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.85rem', color: '#8b5cf6', fontWeight: 800, marginBottom: '4px' }}>{c.cie_number.replace('_', ' ')}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '4px' }}>{c.subject_code}</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>Session: {c.exam_session_name}</div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <Calendar size={14} /> {c.scheduled_date || 'TBD'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <Clock size={14} /> {c.duration_mins} mins
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <User size={14} /> {c.assigned_faculty_name || 'Unassigned'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#475569' }}>
                      <BookOpen size={14} /> Max: {c.max_marks} marks
                    </div>
                  </div>

                  <button
                    onClick={() => toggleConfigActive(c.id, c.is_active)}
                    style={{ width: '100%', padding: '8px', background: c.is_active ? '#fef2f2' : '#ecfdf5', color: c.is_active ? '#dc2626' : '#059669', border: `1px solid ${c.is_active ? '#fca5a5' : '#6ee7b7'}`, borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {c.is_active ? 'Deactivate CIE' : 'Activate CIE'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Scrutiny Inspection Modal */}
      {inspectingPaper && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
          <div style={{ background: '#fff', width: '900px', maxWidth: '90vw', maxHeight: '90vh', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '32px' }}></div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>{inspectingPaper.paper_title === 'Subject' ? inspectingPaper.subject_code : inspectingPaper.paper_title}</h3>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>{inspectingPaper.subject_code} • {inspectingPaper.cie_number.replace('_', ' ')} • By {inspectingPaper.submitted_by_name}</div>
              </div>
              <button onClick={() => setInspectingPaper(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.9rem' }}>Question Paper Content</h4>
                  {inspectingPaper.status === 'PENDING' ? (
                    <textarea 
                      value={editedPaperContent}
                      onChange={e => setEditedPaperContent(e.target.value)}
                      style={{ width: '100%', minHeight: '150px', background: '#f1f5f9', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid #e2e8f0', resize: 'vertical' }}
                    />
                  ) : (
                    <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid #e2e8f0' }}>
                      {editedPaperContent || "No content provided."}
                    </div>
                  )}
                </div>
                {(inspectingPaper.answer_key || inspectingPaper.status === 'PENDING') && (
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#475569', fontSize: '0.9rem' }}>Answer Key / Rubric</h4>
                    {inspectingPaper.status === 'PENDING' ? (
                      <textarea
                        value={editedAnswerKey}
                        onChange={e => setEditedAnswerKey(e.target.value)}
                        style={{ width: '100%', minHeight: '100px', background: '#fdf4ff', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#4a044e', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid #fbcfe8', resize: 'vertical' }}
                      />
                    ) : (
                      <div style={{ background: '#fdf4ff', padding: '16px', borderRadius: '12px', fontSize: '0.9rem', color: '#4a044e', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid #fbcfe8' }}>
                        {editedAnswerKey}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', height: 'fit-content' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="#f59e0b" /> Scrutiny Decision
                </h4>

                {inspectingPaper.status !== 'PENDING' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ background: inspectingPaper.status === 'APPROVED' ? '#d1fae5' : '#fee2e2', color: inspectingPaper.status === 'APPROVED' ? '#047857' : '#b91c1c', padding: '12px', borderRadius: '8px', fontWeight: 700, textAlign: 'center' }}>
                      {inspectingPaper.status}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>HOD Remarks</div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        {inspectingPaper.review_note || 'No remarks provided.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>HOD Remarks / Feedback</label>
                      <textarea
                         value={remarksText}
                        onChange={e => setRemarksText(e.target.value)}
                        placeholder="Enter feedback or approval notes..."
                        rows={5}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', resize: 'vertical', fontSize: '0.9rem' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#64748b' }}>
                        If approved, the paper will only be accessible by students during their specified CIE scheduled session.
                      </p>
                      <button
                        onClick={() => handleAction('approve')}
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <Check size={18} /> Approve Paper
                      </button>
                      <button
                        onClick={() => handleAction('reject')}
                        disabled={isSubmitting}
                        style={{ width: '100%', padding: '12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                      >
                        <RotateCw size={18} /> Request Revision
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Create Config Modal */}
      {isConfigModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '500px', maxWidth: '90vw', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>New CIE Configuration</h3>
              <button onClick={() => setIsConfigModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: '#94a3b8' }}><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateConfig} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Subject</label>
                <select 
                  required
                  value={formData.subject}
                  onChange={e => setFormData({...formData, subject: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.code} - {s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Exam Session</label>
                <select 
                  required
                  value={formData.exam_session}
                  onChange={e => setFormData({...formData, exam_session: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="">Select Session</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>CIE Event</label>
                <select 
                  value={formData.cie_number}
                  onChange={e => setFormData({...formData, cie_number: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="CIE_1">CIE 1</option>
                  <option value="CIE_2">CIE 2</option>
                  <option value="CIE_3">CIE 3</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Assign Faculty Coordinator</label>
                <select 
                  required
                  value={formData.assigned_faculty}
                  onChange={e => setFormData({...formData, assigned_faculty: e.target.value})}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                >
                  <option value="">Select Faculty</option>
                  {faculty.map(f => <option key={f.id} value={f.id}>{f.first_name} {f.last_name} ({f.email})</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Date</label>
                  <input type="date" value={formData.scheduled_date} onChange={e => setFormData({...formData, scheduled_date: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Time</label>
                  <input type="time" value={formData.scheduled_time} onChange={e => setFormData({...formData, scheduled_time: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Max Marks</label>
                  <input type="number" required value={formData.max_marks} onChange={e => setFormData({...formData, max_marks: Number(e.target.value)})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Duration (mins)</label>
                  <input type="number" required value={formData.duration_mins} onChange={e => setFormData({...formData, duration_mins: Number(e.target.value)})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
              </div>

              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsConfigModalOpen(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                  {isSubmitting ? 'Creating...' : 'Create Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
