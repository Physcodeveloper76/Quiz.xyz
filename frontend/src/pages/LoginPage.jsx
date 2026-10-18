import React, { useState } from 'react';
import { Shield, Users, Zap, KeyRound, AlertCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { sounds } from '../services/AudioCues';

export default function LoginPage({ onLoginSuccess }) {
  const [tab, setTab] = useState('team'); // 'team' or 'admin'
  const [teamId, setTeamId] = useState('');
  const [teamPassword, setTeamPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTeamSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.loginTeam(teamId, teamPassword);
      sounds.playLock();
      onLoginSuccess({
        role: 'team',
        token: data.token,
        team: data.team,
        quiz_state: data.quiz_state
      });
    } catch (err) {
      sounds.playWrong();
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.loginAdmin(adminUsername, adminPassword);
      sounds.playLock();
      onLoginSuccess({
        role: 'admin',
        token: data.token,
        quiz_state: data.quiz_state
      });
    } catch (err) {
      sounds.playWrong();
      setError(err.message || 'Host login failed.');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickTeam = (tid, pwd) => {
    setTeamId(tid);
    setTeamPassword(pwd);
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-panel animate-slide-up" style={{
        width: '100%',
        maxWidth: '460px',
        padding: '36px',
        position: 'relative'
      }}>
        {/* Top Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: 'var(--grad-hero)',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(99, 102, 241, 0.6)'
          }}>
            <Zap size={30} color="#FFF" />
          </div>
          <h1 className="font-display gradient-text" style={{ fontSize: '1.9rem', fontWeight: 800 }}>
            WebForge Live
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Synchronized Team Quiz Championship
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '4px',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid var(--border-glass)'
        }}>
          <button
            type="button"
            onClick={() => { setTab('team'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'team' ? 'var(--grad-hero)' : 'transparent',
              color: tab === 'team' ? '#FFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Users size={16} />
            <span>Team Login</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('admin'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: tab === 'admin' ? 'var(--grad-hero)' : 'transparent',
              color: tab === 'admin' ? '#FFF' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={16} />
            <span>Organizer Host</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#FCA5A5',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Team Form */}
        {tab === 'team' ? (
          <form onSubmit={handleTeamSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Team ID (Issued by Host)
              </label>
              <input
                type="text"
                placeholder="e.g. TEAM001"
                className="input-field"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Team Access Password
              </label>
              <input
                type="password"
                placeholder="Enter team password"
                className="input-field"
                value={teamPassword}
                onChange={(e) => setTeamPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
              {loading ? 'Authenticating & Claiming Session...' : 'Enter Championship Arena'}
            </button>

            {/* Quick Demo Credentials */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 700, marginBottom: '8px' }}>
                <Sparkles size={14} />
                <span>QUICK TEST CREDENTIALS (CLICK TO FILL):</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {['TEAM001', 'TEAM002', 'TEAM003', 'TEAM004'].map((tid) => (
                  <button
                    key={tid}
                    type="button"
                    onClick={() => fillQuickTeam(tid, 'pass123')}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: 'var(--text-muted)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer'
                    }}
                  >
                    {tid}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          /* Host Admin Form */
          <form onSubmit={handleAdminSubmit}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Organizer Username
              </label>
              <input
                type="text"
                placeholder="admin"
                className="input-field"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                Organizer Secret Password
              </label>
              <input
                type="password"
                placeholder="admin123"
                className="input-field"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem' }}
            >
              {loading ? 'Entering Command Room...' : 'Launch Mission Control'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
