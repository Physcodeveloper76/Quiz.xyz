import React, { useState } from 'react';
import { Volume2, VolumeX, LogOut, Radio, Shield, Users, Zap } from 'lucide-react';
import { sounds } from '../services/AudioCues';

export default function Navbar({ role, team, isConnected, onLogout }) {
  const [muted, setMuted] = useState(sounds.muted);

  const toggleSound = () => {
    const isNowMuted = sounds.toggleMute();
    setMuted(isNowMuted);
    if (!isNowMuted) {
      sounds.playSelect();
    }
  };

  return (
    <header className="glass-panel" style={{ margin: '12px 16px', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 50 }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'var(--grad-hero)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
        }}>
          <Zap size={22} color="#FFF" />
        </div>
        <div>
          <div className="font-display gradient-text" style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            WebForge Live
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Championship Arena
          </div>
        </div>
      </div>

      {/* Status & Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Connection status */}
        <div className={`status-pill ${isConnected ? 'online' : 'live'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Radio size={13} />
          <span>{isConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
        </div>

        {/* User / Team Badge */}
        {role === 'admin' ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            padding: '6px 14px',
            borderRadius: '10px',
            color: '#A5B4FC',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            <Shield size={16} />
            <span>HOST MISSION CONTROL</span>
          </div>
        ) : team ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(6, 182, 212, 0.12)',
            border: '1px solid rgba(6, 182, 212, 0.3)',
            padding: '6px 14px',
            borderRadius: '10px',
            color: '#67E8F9',
            fontSize: '0.85rem',
            fontWeight: 700
          }}>
            <Users size={16} />
            <span>{team.team_name}</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({team.team_id})</span>
          </div>
        ) : null}

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', borderRadius: '10px' }}
          title={muted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {muted ? <VolumeX size={17} color="var(--text-faint)" /> : <Volume2 size={17} color="var(--accent-cyan)" />}
        </button>

        {/* Logout */}
        {(role || team) && (
          <button
            onClick={onLogout}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', color: '#F87171' }}
            title="Leave / Log Out"
          >
            <LogOut size={16} />
            <span style={{ fontSize: '0.85rem' }}>Exit</span>
          </button>
        )}
      </div>
    </header>
  );
}
