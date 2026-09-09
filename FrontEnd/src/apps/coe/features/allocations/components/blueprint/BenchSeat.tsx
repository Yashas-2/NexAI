import React, { useState, useRef, useCallback } from 'react';
import { SeatedCandidate } from '../../types/allocationTypes';
import { Accessibility, BookOpen, MapPin, User } from 'lucide-react';

interface BenchSeatProps {
  candidate: SeatedCandidate | null;
  seatNumber: number;
  hasAisleGap?: boolean;
}

export const BenchSeat: React.FC<BenchSeatProps> = ({
  candidate,
  seatNumber,
  hasAisleGap = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tipStyle, setTipStyle] = useState<React.CSSProperties>({});
  const seatRef = useRef<HTMLDivElement>(null);

  const TOOLTIP_W = 240;
  const TOOLTIP_H = 160;
  const GAP = 8;

  const computeTipStyle = useCallback((): React.CSSProperties => {
    if (!seatRef.current) return {};
    const rect = seatRef.current.getBoundingClientRect();
    const viewW = window.innerWidth;

    const style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 200,
      pointerEvents: 'none',
    };

    // Horizontal: center, clamp to viewport
    const centerLeft = (rect.width - TOOLTIP_W) / 2;
    if (rect.left + centerLeft < GAP) {
      style.left = GAP - rect.left;
    } else if (rect.right + centerLeft > viewW - GAP) {
      style.left = rect.width - TOOLTIP_W - GAP + (viewW - rect.right);
    } else {
      style.left = centerLeft;
    }

    // Vertical: prefer above, fallback below
    if (rect.top >= TOOLTIP_H + GAP) {
      style.bottom = rect.height + GAP;
    } else {
      style.top = rect.height + GAP;
    }

    return style;
  }, []);

  const handleMouseEnter = () => {
    setTipStyle(computeTipStyle());
    setIsHovered(true);
  };

  return (
    <div
      ref={seatRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1',
        minWidth: '34px',
        maxWidth: '48px',
        borderRadius: '8px',
        background: candidate ? candidate.color : '#F1F5F9',
        border: candidate
          ? `2px solid ${candidate.color}88`
          : '1.5px dashed #CBD5E1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: candidate ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        transform: isHovered && candidate ? 'scale(1.2) translateY(-3px)' : 'scale(1)',
        boxShadow: isHovered && candidate
          ? `0 8px 20px ${candidate.color}55, 0 0 0 2px ${candidate.color}44`
          : candidate
            ? `0 1px 3px ${candidate.color}22`
            : 'none',
        marginRight: hasAisleGap ? '14px' : '0',
        zIndex: isHovered ? 50 : 1,
        overflow: 'visible',
      }}
    >
      {candidate ? (
        <>
          <span style={{
            fontSize: '0.6rem',
            fontWeight: 900,
            color: 'white',
            letterSpacing: '0.3px',
            lineHeight: 1,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>
            {candidate.department}
          </span>
          <span style={{
            fontSize: '0.5rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.9)',
            marginTop: '1px',
          }}>
            {candidate.usn.slice(-3)}
          </span>

          {candidate.isSpecialAccommodated && (
            <div style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#047857',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}>
              <Accessibility size={8} color="white" />
            </div>
          )}
        </>
      ) : (
        <span style={{ fontSize: '0.6rem', color: '#94A3B8', fontWeight: 600 }}>
          {seatNumber}
        </span>
      )}

      {/* Tooltip Card */}
      {isHovered && candidate && (
        <div style={{
          ...tipStyle,
          background: 'white',
          borderRadius: '12px',
          padding: '0',
          fontSize: '0.75rem',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
          border: 'none',
          width: `${TOOLTIP_W}px`,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}>
          {/* Header with department color */}
          <div style={{
            background: `linear-gradient(135deg, ${candidate.color}, ${candidate.color}cc)`,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <User size={14} color="white" />
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.82rem', color: 'white', lineHeight: 1.2 }}>
                  {candidate.name}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  {candidate.usn}
                </div>
              </div>
            </div>
            <span style={{
              background: 'rgba(255,255,255,0.25)',
              color: 'white',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.65rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}>
              {candidate.department}
            </span>
          </div>

          {/* Body */}
          <div style={{ padding: '10px 12px' }}>
            {/* Subject */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              background: `${candidate.color}0D`,
              borderRadius: '6px',
              marginBottom: '8px',
            }}>
              <BookOpen size={12} color={candidate.color} />
              <div>
                <span style={{ fontWeight: 800, color: candidate.color, fontSize: '0.72rem' }}>
                  {candidate.subjectCode}
                </span>
                <span style={{ color: '#64748B', fontSize: '0.68rem', marginLeft: '4px' }}>
                  {candidate.subjectTitle}
                </span>
              </div>
            </div>

            {/* Seat info row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.68rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569' }}>
                <MapPin size={11} />
                <span style={{ fontWeight: 600 }}>Bench {candidate.benchNumber}</span>
                <span style={{ color: '#94A3B8' }}>•</span>
                <span>Desk {candidate.deskPosition}</span>
              </div>
              <span style={{
                background: '#F1F5F9',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                color: '#334155',
                fontSize: '0.65rem',
              }}>
                Seat #{seatNumber}
              </span>
            </div>

            {candidate.isSpecialAccommodated && (
              <div style={{
                marginTop: '6px',
                padding: '4px 8px',
                background: '#ECFDF5',
                borderRadius: '4px',
                color: '#047857',
                fontWeight: 700,
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <Accessibility size={10} />
                PWD Accommodation
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
