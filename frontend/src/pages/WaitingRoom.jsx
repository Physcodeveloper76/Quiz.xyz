import React from 'react';
import { Users, Zap, ShieldAlert, Award, Clock, Sparkles } from 'lucide-react';

export default function WaitingRoom({ team, quizState }) {
  const connectedCount = quizState?.connected_teams_count || 1;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <div className="glass-panel animate-slide-up" style={{ padding: '40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Animated Radar Pulse */}
        <div style={{
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          border: '2px solid rgba(99, 102, 241, 0.4)',
          margin: '0 auto 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '2px solid rgba(6, 182, 212, 0.5)',
            animation: 'pulse-glow 2s infinite'
          }} />
          <Zap size={40} color="#22D3EE" />
        </div>

        {/* Lobby Heading */}
        <div className="status-pill lobby" style={{ marginBottom: '16px' }}>
          STANDBY • QUIZ LOBBY
        </div>

        <h1 className="font-display" style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '12px' }}>
          Waiting for the Host to Launch
        </h1>

        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '540px', margin: '0 auto 28px' }}>
          Your session is authorized and synchronized. When the host opens Question 1, your screen will automatically switch into the live battle arena.
        </p>

        {/* Team Card Banner */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border-glass)',
          padding: '12px 24px',
          borderRadius: '14px',
          marginBottom: '36px'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              REGISTERED SQUAD
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F1F5F9' }}>
              {team?.team_name}
            </div>
          </div>
          <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              IDENTIFIER
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#67E8F9', fontFamily: 'var(--font-mono)' }}>
              {team?.team_id}
            </div>
          </div>
          <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.1)' }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              TEAMS IN LOBBY
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#34D399', fontFamily: 'var(--font-mono)' }}>
              {connectedCount} Ready
            </div>
          </div>
        </div>

        {/* Competition Rules Grid */}
        <div style={{ textAlign: 'left', borderTop: '1px solid var(--border-glass)', paddingTop: '28px' }}>
          <h3 className="font-display" style={{ fontSize: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>
            Tournament Ground Rules
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#67E8F9', fontWeight: 700, marginBottom: '6px' }}>
                <Clock size={16} />
                <span>Speed Scoring</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Faster correct answers earn more points. Score = B × (1 - t/T).
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A5B4FC', fontWeight: 700, marginBottom: '6px' }}>
                <ShieldAlert size={16} />
                <span>One Locked Answer</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                First clicked option is immediately locked and timestamped by the server.
              </p>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FBBF24', fontWeight: 700, marginBottom: '6px' }}>
                <Award size={16} />
                <span>Instant Auto-Reveal</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Results reveal as soon as all teams answer or time runs out.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
