import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { sounds } from '../services/AudioCues';

export default function TimerBar({ deadlineAt, durationSeconds = 20, isPaused = false }) {
  const [remainingMs, setRemainingMs] = useState(0);
  const totalMs = durationSeconds * 1000;
  const lastTickSecond = useRef(-1);

  useEffect(() => {
    if (!deadlineAt || isPaused) return;

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, deadlineAt - now);
      setRemainingMs(diff);

      const secondsLeft = Math.ceil(diff / 1000);
      if (secondsLeft <= 5 && secondsLeft > 0 && secondsLeft !== lastTickSecond.current) {
        lastTickSecond.current = secondsLeft;
        sounds.playTick();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 50);
    return () => clearInterval(interval);
  }, [deadlineAt, isPaused]);

  const fraction = Math.max(0, Math.min(1, remainingMs / totalMs));
  const percent = fraction * 100;
  const secondsDisplay = (remainingMs / 1000).toFixed(1);

  // Dynamic color selection
  let barColor = 'linear-gradient(90deg, #06B6D4, #6366F1)';
  let textColor = '#22D3EE';
  if (percent < 25) {
    barColor = 'linear-gradient(90deg, #EF4444, #DC2626)';
    textColor = '#F87171';
  } else if (percent < 50) {
    barColor = 'linear-gradient(90deg, #F59E0B, #D97706)';
    textColor = '#FBBF24';
  }

  return (
    <div style={{ width: '100%', marginBottom: '20px' }}>
      {/* Timer metadata & readout */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
          <Clock size={16} color={textColor} />
          <span>OFFICIAL SERVER CLOCK</span>
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: 800,
          fontSize: '1.4rem',
          color: textColor,
          letterSpacing: '-0.02em',
          textShadow: percent < 25 ? '0 0 12px rgba(239, 68, 68, 0.6)' : 'none'
        }}>
          {secondsDisplay}s
        </div>
      </div>

      {/* Linear progress track */}
      <div style={{
        width: '100%',
        height: '10px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '9999px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <div style={{
          width: `${percent}%`,
          height: '100%',
          background: barColor,
          borderRadius: '9999px',
          transition: 'width 0.05s linear',
          boxShadow: percent < 25 ? '0 0 10px rgba(239, 68, 68, 0.8)' : '0 0 10px rgba(6, 182, 212, 0.5)'
        }} />
      </div>
    </div>
  );
}
