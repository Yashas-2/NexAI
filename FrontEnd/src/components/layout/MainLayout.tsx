import React from 'react';
import { Sidebar } from './Sidebar';


export interface SidebarItem {
  id: string;
  label: string;
  path?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface MainLayoutProps {
  children: React.ReactNode;
  sidebarItems: SidebarItem[];
  userName: string;
  userRole?: string;
  onLogout?: () => void;
  pageTitle?: string;
  activeSidebarItemId?: string;
  onSidebarItemClick?: (id: string) => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  children, 
  sidebarItems,
  userName,
  userRole,
  onLogout,
  pageTitle,
  activeSidebarItemId,
  onSidebarItemClick
}) => {
  return (
    <div className="main-layout-root" style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      backgroundColor: 'var(--color-bg-base)',
      padding: '24px', // The outer padding for the dark background
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Rich Decorative Vector Background (Global) */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="bgBlob1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <radialGradient id="bgBlob2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(72,151,127,0.25)" />
            <stop offset="100%" stopColor="rgba(72,151,127,0)" />
          </radialGradient>
          <pattern id="dotGrid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="rgba(255,255,255,0.07)" />
          </pattern>
          <pattern id="diagonalLines" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="30" stroke="rgba(255,255,255,0.04)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {/* Dot grid — fills entire background */}
        <rect width="1440" height="900" fill="url(#dotGrid)" />

        {/* Diagonal stripe bands */}
        <rect x="-100" y="600" width="700" height="400" fill="url(#diagonalLines)" />
        <rect x="900" y="-100" width="600" height="500" fill="url(#diagonalLines)" />

        {/* Large soft blob - top left */}
        <ellipse cx="-60" cy="-60" rx="450" ry="450" fill="url(#bgBlob1)" />

        {/* Large soft blob - bottom right */}
        <ellipse cx="1500" cy="950" rx="600" ry="600" fill="url(#bgBlob2)" />

        {/* Decorative large circle ring — top right */}
        <circle cx="1360" cy="100" r="220" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <circle cx="1360" cy="100" r="170" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx="1360" cy="100" r="120" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

        {/* Decorative partial arc — bottom left */}
        <path d="M 0,750 Q 200,600 400,800" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <path d="M 0,790 Q 250,640 450,840" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />

        {/* Floating geometric triangles */}
        <polygon points="120,80 150,130 90,130" fill="rgba(255,255,255,0.04)" />
        <polygon points="1300,600 1340,660 1260,660" fill="rgba(255,255,255,0.04)" />
        <polygon points="700,30 720,70 680,70" fill="rgba(255,255,255,0.05)" />

        {/* Small accent diamonds */}
        <rect x="200" y="400" width="14" height="14" fill="rgba(255,255,255,0.06)" transform="rotate(45 207 407)" />
        <rect x="1100" y="200" width="10" height="10" fill="rgba(255,255,255,0.06)" transform="rotate(45 1105 205)" />
        <rect x="800" y="700" width="12" height="12" fill="rgba(255,255,255,0.05)" transform="rotate(45 806 706)" />

        {/* Horizontal scanline near bottom */}
        <line x1="260" y1="870" x2="1440" y2="870" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <line x1="260" y1="860" x2="1440" y2="860" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
      </svg>

      <Sidebar 
        items={sidebarItems} 
        activeItemId={activeSidebarItemId} 
        onItemClick={onSidebarItemClick} 
        userName={userName}
        userRole={userRole}
        onLogout={onLogout}
      />
      
      {/* The main white canvas floating inside the dark background */}
      <div className="main-layout-content" style={{ 
        flex: 1, 
        marginLeft: '260px', // Matches the width of the sidebar for a perfect 24px gap (due to outer padding)
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-surface)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)'
      }}>

        
        <main style={{ padding: '32px 48px', flex: 1, overflowY: 'auto', position: 'relative' }}>
          {/* Subtle canvas background vectors */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.4, zIndex: 0 }} viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
            <defs>
              <pattern id="canvasDots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.2" fill="var(--color-primary)" opacity="0.18" />
              </pattern>
            </defs>
            <rect width="1000" height="800" fill="url(#canvasDots)" />
            {/* Gentle arc top-right */}
            <path d="M 700,0 Q 1000,200 900,500" fill="none" stroke="var(--color-primary)" strokeWidth="1" opacity="0.07" />
            <path d="M 750,0 Q 1050,200 950,500" fill="none" stroke="var(--color-primary)" strokeWidth="0.6" opacity="0.05" />
            {/* Gentle arc bottom-left */}
            <path d="M 0,500 Q 200,750 500,800" fill="none" stroke="var(--color-primary)" strokeWidth="1" opacity="0.06" />
            {/* Floating rings - far corners, very subtle */}
            <circle cx="950" cy="80"  r="55" fill="none" stroke="var(--color-primary)" strokeWidth="0.8" opacity="0.08" />
            <circle cx="950" cy="80"  r="35" fill="none" stroke="var(--color-primary)" strokeWidth="0.6" opacity="0.06" />
            <circle cx="60"  cy="720" r="65" fill="none" stroke="var(--color-primary)" strokeWidth="0.8" opacity="0.07" />
            <circle cx="60"  cy="720" r="40" fill="none" stroke="var(--color-primary)" strokeWidth="0.5" opacity="0.05" />
          </svg>
          <div style={{ position: 'relative', zIndex: 1 }}>
            {pageTitle && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{pageTitle}</h2>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
