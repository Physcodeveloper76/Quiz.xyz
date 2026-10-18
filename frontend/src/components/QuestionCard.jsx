import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, Lock, Award, Flame } from 'lucide-react';
import { sounds } from '../services/AudioCues';

const OPTION_STYLES = {
  A: {
    bg: 'linear-gradient(135deg, rgba(79, 70, 229, 0.25) 0%, rgba(67, 56, 202, 0.4) 100%)',
    border: '#6366F1',
    badge: '#818CF8'
  },
  B: {
    bg: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(3, 105, 161, 0.4) 100%)',
    border: '#0284C7',
    badge: '#38BDF8'
  },
  C: {
    bg: 'linear-gradient(135deg, rgba(217, 119, 6, 0.25) 0%, rgba(180, 83, 9, 0.4) 100%)',
    border: '#D97706',
    badge: '#FBBF24'
  },
  D: {
    bg: 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(109, 40, 217, 0.4) 100%)',
    border: '#7C3AED',
    badge: '#C084FC'
  }
};

export default function QuestionCard({
  question,
  selectedOption,
  isLocked,
  isRevealed,
  correctOption,
  pointsEarned,
  onSelectOption
}) {
  if (!question) return null;

  // Keyboard shortcut listener (1-4 or A-D)
  useEffect(() => {
    if (isLocked || isRevealed) return;

    const handleKeyDown = (e) => {
      const key = e.key.toUpperCase();
      const keyMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D' };
      if (keyMap[key]) {
        sounds.playSelect();
        onSelectOption(keyMap[key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isRevealed, onSelectOption]);

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '32px', width: '100%', maxWidth: '850px', margin: '0 auto' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span style={{
          background: 'rgba(255, 255, 255, 0.08)',
          padding: '6px 14px',
          borderRadius: '9999px',
          fontSize: '0.82rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          color: 'var(--text-muted)'
        }}>
          QUESTION {question.order}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24', fontSize: '0.85rem', fontWeight: 700 }}>
          <Flame size={18} />
          <span>UP TO {question.max_points || 1000} PTS (SPEED-SCALED)</span>
        </div>
      </div>

      {/* Question Prompt */}
      <h2 className="font-display" style={{
        fontSize: '1.65rem',
        fontWeight: 700,
        lineHeight: 1.35,
        marginBottom: '32px',
        color: '#FFFFFF'
      }}>
        {question.prompt}
      </h2>

      {/* Options Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {question.options.map((opt) => {
          const style = OPTION_STYLES[opt.id] || OPTION_STYLES.A;
          const isSelected = selectedOption === opt.id;
          const isThisCorrect = isRevealed && correctOption === opt.id;
          const isThisWrongSelection = isRevealed && isSelected && !isThisCorrect;

          let cardBg = style.bg;
          let cardBorder = isSelected ? style.border : 'rgba(255, 255, 255, 0.08)';
          let boxShadow = isSelected ? `0 0 20px ${style.border}66` : 'none';

          if (isRevealed) {
            if (isThisCorrect) {
              cardBg = 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.5) 100%)';
              cardBorder = '#10B981';
              boxShadow = '0 0 25px rgba(16, 185, 129, 0.6)';
            } else if (isThisWrongSelection) {
              cardBg = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.5) 100%)';
              cardBorder = '#EF4444';
              boxShadow = '0 0 20px rgba(239, 68, 68, 0.5)';
            } else {
              cardBg = 'rgba(255, 255, 255, 0.03)';
              cardBorder = 'rgba(255, 255, 255, 0.04)';
            }
          }

          return (
            <button
              key={opt.id}
              onClick={() => {
                if (!isLocked && !isRevealed) {
                  sounds.playSelect();
                  onSelectOption(opt.id);
                }
              }}
              disabled={isLocked || isRevealed}
              style={{
                background: cardBg,
                border: `2px solid ${cardBorder}`,
                borderRadius: '14px',
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                textAlign: 'left',
                cursor: (isLocked || isRevealed) ? 'default' : 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: boxShadow,
                outline: 'none',
                position: 'relative'
              }}
            >
              {/* Option Letter Badge */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: isThisCorrect ? '#10B981' : isThisWrongSelection ? '#EF4444' : style.badge,
                color: '#FFF',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isThisCorrect ? <CheckCircle2 size={24} /> : isThisWrongSelection ? <XCircle size={24} /> : opt.id}
              </div>

              {/* Option Text */}
              <div style={{ flex: 1, fontSize: '1.05rem', fontWeight: 600, color: '#F8FAFC' }}>
                {opt.text}
              </div>

              {/* Status indicator icon if locked */}
              {isSelected && !isRevealed && (
                <Lock size={18} color="#A5B4FC" style={{ flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Lock banner / Reveal result banner */}
      {isLocked && !isRevealed && (
        <div style={{
          marginTop: '28px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: '#C7D2FE',
          fontWeight: 600,
          fontSize: '0.95rem'
        }}>
          <Lock size={18} />
          <span>Answer submitted & locked! Waiting for remaining teams or countdown expiry...</span>
        </div>
      )}

      {isRevealed && (
        <div style={{
          marginTop: '28px',
          padding: '20px',
          borderRadius: '14px',
          background: pointsEarned > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${pointsEarned > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {pointsEarned > 0 ? (
              <CheckCircle2 size={26} color="#34D399" />
            ) : (
              <XCircle size={26} color="#F87171" />
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: pointsEarned > 0 ? '#34D399' : '#F87171' }}>
                {pointsEarned > 0 ? 'CORRECT! SPEED BONUS APPLIED' : 'INCORRECT OR TIMEOUT'}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Correct Answer: Option {correctOption}
              </div>
            </div>
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            fontSize: '1.5rem',
            color: pointsEarned > 0 ? '#34D399' : '#94A3B8'
          }}>
            +{pointsEarned} PTS
          </div>
        </div>
      )}
    </div>
  );
}
