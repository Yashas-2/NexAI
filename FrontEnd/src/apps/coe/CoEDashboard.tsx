import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { MainLayout } from '@/components/layout/MainLayout';

// Import Feature Tabs
import { VaultTab } from './features/VaultTab';
import { CurriculumTab } from './features/curriculum/CurriculumTab';
import { ResourcesTab } from './features/resources/ResourcesTab';
import { AllocationsTab } from './features/allocations/AllocationsTab';
import { CredentialManagementTab } from './features/credentials/CredentialManagementTab';
import { RadarTab } from './features/RadarTab';
import { AuditTab } from './features/AuditTab';
import { ShieldAlert, BookOpen, Building, CalendarDays, FileText, KeyRound } from 'lucide-react';

type Tab = 'VAULT' | 'CURRICULUM' | 'RESOURCES' | 'ALLOCATIONS' | 'CREDENTIALS' | 'RADAR' | 'AUDIT';

export default function CoEDashboard() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const [activeTab, setActiveTab] = useState<Tab>('ALLOCATIONS');

  // Dummy State mimicking API calls
  const [papers, setPapers] = useState<any[]>([]);
  const [radarData, setRadarData] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');

  useEffect(() => {
    import('@/services/api').then(({ api }) => {
      // Fetch Audit Logs
      api.get('/coe/audit/')
        .then(res => {
          const rawAudit = res.data.results || res.data;
          setAuditLogs(rawAudit.map((log: any) => ({
            id: log.id,
            timestamp: log.timestamp,
            actor_name: log.actor?.full_name || 'System',
            actor_email: log.actor?.email || 'N/A',
            action: log.action,
            severity: log.severity,
            details: log.details
          })));
        })
        .catch(console.error);

      // We still mock metrics/papers/radar for now unless we need them live
      setTimeout(() => {
        setPapers([
          { id: '1', title: 'Data Structures Final', subject_code: 'CS201', exam_session_name: 'Fall 2026', status: 'VAULTED', ipfs_cid: 'Qm123...' },
          { id: '2', title: 'Algorithms Midterm', subject_code: 'CS301', exam_session_name: 'Fall 2026', status: 'APPROVED' },
          { id: '3', title: 'Operating Systems', subject_code: 'CS401', exam_session_name: 'Fall 2026', status: 'SUBMITTED' },
        ]);
        setRadarData([
          { session_id: '1', student_usn: '1RV20CS001', timetable_slot: 'Morning', high_severity_flags: 1, medium_severity_flags: 2, low_severity_flags: 0, total_flags: 3, latest_event: 'Multiple faces detected' }
        ]);
        setMetrics({ total_students_evaluated: 1250, average_gpa: 7.4, pass_percentage: 82.5 });
        setLoading(false);
      }, 500);
    });
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'VAULT':
        return <VaultTab papers={papers} loading={loading} error={error} />;
      case 'CURRICULUM':
        return <CurriculumTab />;
      case 'RESOURCES':
        return <ResourcesTab />;
      case 'ALLOCATIONS':
        return <AllocationsTab />;
      case 'CREDENTIALS':
        return <CredentialManagementTab />;
      case 'RADAR':
        return <RadarTab data={radarData} loading={loading} error={error} />;
      case 'AUDIT':
        return <AuditTab logs={auditLogs} metrics={metrics} loading={loading} error={error} />;
      default:
        return <div>Select a tab</div>;
    }
  };

  const sidebarItems = [
    { id: 'ALLOCATIONS', label: 'SEE Allocations & Schedules', icon: <CalendarDays size={20} /> },
    { id: 'CREDENTIALS', label: 'User Access & Credentials', icon: <KeyRound size={20} /> },
    { id: 'CURRICULUM', label: 'Curriculum', icon: <BookOpen size={20} /> },
    { id: 'RESOURCES', label: 'Resources', icon: <Building size={20} /> },
    { id: 'AUDIT', label: 'Audit Ledger', icon: <FileText size={20} /> },
    { id: 'VAULT', label: 'Secure Vault', icon: <ShieldAlert size={20} /> },
  ];

  return (
    <MainLayout
      userName={user?.full_name || 'CoE'}
      userRole="Chief Superintendent"
      sidebarItems={sidebarItems}
      activeSidebarItemId={activeTab}
      onSidebarItemClick={(id) => setActiveTab(id as Tab)}
      onLogout={logout}
    >

      {/* Tab Content Area */}
      <div>
        {renderTabContent()}
      </div>
    </MainLayout>
  );
}
