import React, { useEffect } from 'react';
import { Trophy, Medal, Award, Clock, Check, Users, Edit3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sounds } from '../services/AudioCues';

export default function Leaderboard({ leaderboard = [], currentTeamId, isFinal = false, onEditMarks }) {

  useEffect(() => {
    if (isFinal && leaderboard.length > 0) {
      sounds.playFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [isFinal, leaderboard.length]);

  const top3 = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  // Reorder for podium visual: [2nd, 1st, 3rd]
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], place: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], place: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], place: 3 });

  return (
    <div className="glass-panel animate-slide-up" style={{ padding: '32px', width: '100%', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#FBBF24', marginBottom: '8px' }}>
          <Trophy size={28} />
          <span className="font-display" style={{ fontSize: '1.8rem', fontWeight: 800 }}>
            {isFinal ? 'FINAL CHAMPIONSHIP PODIUM' : 'LIVE LEADERBOARD'}
          </span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          {isFinal ? 'Official verified scores and rankings for this tournament' : 'Real-time scores ranked by points & response speed'}
        </p>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: '16px',
          marginBottom: '36px',
          paddingBottom: '16px'
        }}>
          {podiumOrder.map((team) => {
            const isFirst = team.place === 1;
            const isSecond = team.place === 2;
            const isThird = team.place === 3;

            const height = isFirst ? '220px' : isSecond ? '180px' : '160px';
            const badgeBg = isFirst ? '#F59E0B' : isSecond ? '#94A3B8' : '#D97706';
            const cardGlow = isFirst ? 'rgba(245, 158, 11, 0.4)' : isSecond ? 'rgba(148, 163, 184, 0.25)' : 'rgba(217, 119, 6, 0.25)';
            const isMe = currentTeamId === team.team_id;

            return (
              <div
                key={team.team_id}
                style={{
                  flex: 1,
                  maxWidth: '220px',
                  height: height,
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: isMe ? '2px solid #06B6D4' : `1px solid ${badgeBg}66`,
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: `0 8px 30px ${cardGlow}`,
                  position: 'relative'
                }}
              >
                {/* Place Trophy / Medal Badge */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: badgeBg,
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 0 15px ${badgeBg}`
                }}>
                  {team.place}
                </div>

                {/* Team Info */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: isFirst ? '1.15rem' : '1rem',
                    color: '#FFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '180px'
                  }}>
                    {team.team_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {team.team_id}
                  </div>
                </div>

                {/* Score */}
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 800,
                  fontSize: isFirst ? '1.35rem' : '1.15rem',
                  color: isFirst ? '#FBBF24' : '#E2E8F0'
                }}>
                  {team.marks !== undefined ? team.marks : team.total_score} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>marks</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-faint)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>Rank</th>
              <th style={{ padding: '12px 16px' }}>Team</th>
              <th style={{ padding: '12px 16px', textAlign: 'center' }}>Accuracy</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Marks / Score</th>
              {onEditMarks && <th style={{ padding: '12px 16px', textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((team, idx) => {
              const isMe = currentTeamId === team.team_id;
              const displayMarks = team.marks !== undefined ? team.marks : team.total_score;
              return (
                <tr
                  key={team.team_id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: isMe ? 'rgba(6, 182, 212, 0.12)' : idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <td style={{ padding: '14px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    #{team.rank || idx + 1}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: isMe ? '#22D3EE' : '#F1F5F9' }}>
                        {team.team_name}
                      </span>
                      {isMe && (
                        <span style={{
                          fontSize: '0.7rem',
                          background: '#06B6D4',
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 800
                        }}>
                          YOU
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                      {team.team_id}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#34D399', fontSize: '0.85rem' }}>
                      <Check size={14} />
                      <span>{team.correct_count || 0}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {((team.total_time_ms || 0) / 1000).toFixed(2)}s
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', color: '#F1F5F9' }}>
                    {displayMarks}
                  </td>
                  {onEditMarks && (
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => onEditMarks(team)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Edit marks in Supabase & Live"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

