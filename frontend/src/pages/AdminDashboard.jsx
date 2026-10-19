import React, { useState, useEffect } from 'react';
import {
  Play, FastForward, Pause, PlayCircle, Eye, RotateCcw,
  Users, HelpCircle, Trophy, Download, Plus, Trash2, Key,
  CheckCircle, AlertCircle, Radio, Clock, ShieldCheck, Sparkles, RefreshCw,
  Database, UploadCloud, DownloadCloud, Edit3, Copy, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import TimerBar from '../components/TimerBar';
import Leaderboard from '../components/Leaderboard';
import { sounds } from '../services/AudioCues';

export default function AdminDashboard({ quizState, onStateUpdate }) {
  const [activeTab, setActiveTab] = useState('control'); // 'control', 'questions', 'teams', 'results'
  const [teams, setTeams] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');

  // Supabase Leaderboard State
  const [supabaseStatus, setSupabaseStatus] = useState(null);
  const [supabaseLoading, setSupabaseLoading] = useState(false);
  const [showMarksModal, setShowMarksModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [editMarksVal, setEditMarksVal] = useState(0);

  // Modals & Forms
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamId, setNewTeamId] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPassword, setNewTeamPassword] = useState('pass123');

  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvContent, setCsvContent] = useState('');

  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [newQPrompt, setNewQPrompt] = useState('');
  const [newQOptA, setNewQOptA] = useState('');
  const [newQOptB, setNewQOptB] = useState('');
  const [newQOptC, setNewQOptC] = useState('');
  const [newQOptD, setNewQOptD] = useState('');
  const [newQCorrect, setNewQCorrect] = useState('A');
  const [newQDuration, setNewQDuration] = useState(20);
  const [newQPoints, setNewQPoints] = useState(1000);

  const showNotice = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  };

  const loadData = async () => {
    try {
      const [tData, qData, rData, sData] = await Promise.all([
        api.getTeams(),
        api.getQuestions(),
        api.getQuizResults(),
        api.getSupabaseStatus().catch(() => null)
      ]);
      setTeams(tData || []);
      setQuestions(qData || []);
      setLeaderboard(rData.leaderboard || []);
      if (sData) setSupabaseStatus(sData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
  };

  const handlePushSupabase = async () => {
    try {
      setSupabaseLoading(true);
      const res = await api.pushSupabase();
      showNotice(res.message || 'Synced leaderboard to Supabase successfully!');
      loadData();
    } catch (err) {
      showNotice(err.message || 'Failed to push to Supabase.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handlePullSupabase = async () => {
    try {
      setSupabaseLoading(true);
      const res = await api.pullSupabase();
      if (res.leaderboard) {
        setLeaderboard(res.leaderboard);
      }
      showNotice(res.message || 'Successfully applied modified marks & leaderboard from Supabase!');
      loadData();
    } catch (err) {
      showNotice(err.message || 'Failed to pull from Supabase.');
    } finally {
      setSupabaseLoading(false);
    }
  };

  const handleOpenEditMarks = (team) => {
    setEditTeam(team);
    setEditMarksVal(team.marks !== undefined ? team.marks : team.total_score);
    setShowMarksModal(true);
  };

  const handleSaveMarks = async (e) => {
    e.preventDefault();
    if (!editTeam) return;
    try {
      const res = await api.updateTeamMarks(editTeam.team_id, editMarksVal);
      if (res.leaderboard) {
        setLeaderboard(res.leaderboard);
      }
      showNotice(`Marks updated for ${editTeam.team_name} (${editTeam.team_id}) to ${editMarksVal}!`);
      setShowMarksModal(false);
      loadData();
    } catch (err) {
      showNotice(err.message || 'Failed to update marks.');
    }
  };

  const handleCopySql = () => {
    const sql = supabaseStatus?.schema_sql || `-- Supabase Leaderboard Table\nCREATE TABLE public.leaderboard (\n  quiz_id TEXT NOT NULL DEFAULT 'default_quiz',\n  team_id TEXT NOT NULL,\n  team_name TEXT NOT NULL,\n  marks NUMERIC NOT NULL DEFAULT 0,\n  total_score NUMERIC NOT NULL DEFAULT 0,\n  correct_count INT NOT NULL DEFAULT 0,\n  total_time_ms NUMERIC NOT NULL DEFAULT 0,\n  rank INT NOT NULL DEFAULT 1,\n  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),\n  PRIMARY KEY (quiz_id, team_id)\n);`;
    navigator.clipboard.writeText(sql);
    showNotice('Copied Supabase SQL table creation script to clipboard!');
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Control Room Actions
  const handleStart = async () => {
    try {
      sounds.playLock();
      const res = await api.startQuiz();
      showNotice('Quiz launched! Question 1 is now open.');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleAdvance = async () => {
    try {
      sounds.playSelect();
      const res = await api.advanceQuiz();
      showNotice('Advanced to next question.');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handlePause = async () => {
    try {
      const res = await api.pauseQuiz();
      showNotice('Quiz countdown paused.');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleResume = async () => {
    try {
      const res = await api.resumeQuiz();
      showNotice('Quiz countdown resumed.');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleForceReveal = async () => {
    try {
      sounds.playCorrect();
      const res = await api.revealQuiz();
      showNotice('Correct answer and scores revealed!');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Are you sure you want to reset the quiz back to Lobby and clear submissions?')) return;
    try {
      const res = await api.resetQuiz();
      showNotice('Quiz reset to Lobby.');
      if (res.state && onStateUpdate) onStateUpdate(res.state);
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  // Team Actions
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await api.createTeam(newTeamId, newTeamName, newTeamPassword);
      showNotice(`Team ${newTeamId} created!`);
      setShowAddTeamModal(false);
      setNewTeamId('');
      setNewTeamName('');
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    try {
      const res = await api.importTeamsCSV(csvContent);
      showNotice(`Successfully imported ${res.imported_count} teams!`);
      setShowCsvModal(false);
      setCsvContent('');
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleReleaseSession = async (tid) => {
    try {
      await api.releaseTeamSession(tid);
      showNotice(`Session for ${tid} released! They can now log in anew.`);
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleDeleteTeam = async (tid) => {
    if (!window.confirm(`Delete ${tid}?`)) return;
    try {
      await api.deleteTeam(tid);
      showNotice(`Deleted ${tid}`);
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  // Question Actions
  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      await api.addQuestion({
        prompt: newQPrompt,
        options: [
          { id: 'A', text: newQOptA },
          { id: 'B', text: newQOptB },
          { id: 'C', text: newQOptC },
          { id: 'D', text: newQOptD }
        ],
        correct_option: newQCorrect,
        duration_seconds: parseInt(newQDuration, 10),
        max_points: parseInt(newQPoints, 10)
      });
      showNotice('New question added to quiz bank!');
      setShowAddQuestionModal(false);
      setNewQPrompt('');
      setNewQOptA('');
      setNewQOptB('');
      setNewQOptC('');
      setNewQOptD('');
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  const handleDeleteQuestion = async (qid) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.deleteQuestion(qid);
      showNotice('Question deleted.');
      loadData();
    } catch (err) {
      showNotice(err.message);
    }
  };

  const status = quizState?.status || 'LOBBY';
  const submittedCount = quizState?.submitted_teams_count || 0;
  const eligibleCount = quizState?.eligible_teams_count || teams.length;
  const currentQ = quizState?.question;

  return (
    <div style={{ maxWidth: '1100px', margin: '24px auto', padding: '0 20px' }}>
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#FFF',
          padding: '12px 20px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
          zIndex: 9999,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Sparkles size={18} />
          <span>{notification}</span>
        </div>
      )}

      {/* Admin Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '6px',
        borderRadius: '14px',
        marginBottom: '24px',
        border: '1px solid var(--border-glass)'
      }}>
        {[
          { id: 'control', label: 'Command Center', icon: Radio },
          { id: 'questions', label: `Question Bank (${questions.length})`, icon: HelpCircle },
          { id: 'teams', label: `Team Roster (${teams.length})`, icon: Users },
          { id: 'results', label: 'Leaderboard & Export', icon: Trophy }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                background: isActive ? 'var(--grad-hero)' : 'transparent',
                color: isActive ? '#FFF' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '0.92rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={18} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: COMMAND CENTER */}
      {activeTab === 'control' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
          {/* Main Stage */}
          <div className="glass-panel" style={{ padding: '32px' }}>
            {/* Status Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <span className={`status-pill ${status === 'QUESTION_OPEN' ? 'live' : status === 'LOBBY' ? 'lobby' : 'warning'}`}>
                  {status.replace('_', ' ')}
                </span>
                <span style={{ marginLeft: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Question {(quizState?.current_question_index || 0) + 1} of {quizState?.total_questions || questions.length}
                </span>
              </div>

              <button onClick={loadData} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                <RefreshCw size={14} />
                <span>Sync</span>
              </button>
            </div>

            {/* Current Question View */}
            {currentQ ? (
              <div style={{ marginBottom: '28px' }}>
                <h2 className="font-display" style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '16px', color: '#FFF' }}>
                  {currentQ.prompt}
                </h2>

                {/* Timer preview */}
                {status === 'QUESTION_OPEN' && (
                  <TimerBar
                    deadlineAt={quizState.deadline_at}
                    durationSeconds={quizState.duration_seconds}
                    isPaused={status === 'PAUSED'}
                  />
                )}

                {/* Submissions Bar */}
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem', fontWeight: 700 }}>
                    <span style={{ color: 'var(--text-muted)' }}>TEAM SUBMISSIONS</span>
                    <span style={{ color: '#67E8F9', fontFamily: 'var(--font-mono)' }}>
                      {submittedCount} / {eligibleCount} ({eligibleCount > 0 ? Math.round((submittedCount / eligibleCount) * 100) : 0}%)
                    </span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${eligibleCount > 0 ? (submittedCount / eligibleCount) * 100 : 0}%`,
                      height: '100%',
                      background: 'var(--grad-hero)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Radio size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
                <h3>No Question Active</h3>
                <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>Click "Launch Question 1" to start the tournament.</p>
              </div>
            )}

            {/* Action Bar */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {status === 'LOBBY' ? (
                <button onClick={handleStart} className="btn btn-primary" style={{ padding: '12px 24px' }}>
                  <Play size={18} />
                  <span>Launch Question 1</span>
                </button>
              ) : (
                <>
                  <button onClick={handleAdvance} className="btn btn-primary">
                    <FastForward size={18} />
                    <span>Next Question</span>
                  </button>

                  {status === 'QUESTION_OPEN' ? (
                    <button onClick={handlePause} className="btn btn-secondary">
                      <Pause size={18} />
                      <span>Pause Countdown</span>
                    </button>
                  ) : status === 'PAUSED' ? (
                    <button onClick={handleResume} className="btn btn-secondary">
                      <PlayCircle size={18} />
                      <span>Resume</span>
                    </button>
                  ) : null}

                  <button onClick={handleForceReveal} className="btn btn-secondary" style={{ color: '#34D399' }}>
                    <Eye size={18} />
                    <span>Force Reveal</span>
                  </button>
                </>
              )}

              <button onClick={handleReset} className="btn btn-secondary" style={{ marginLeft: 'auto', color: '#F87171' }}>
                <RotateCcw size={16} />
                <span>Reset to Lobby</span>
              </button>
            </div>
          </div>

          {/* Telemetry Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                HOST TELEMETRY
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Connected Sockets</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#34D399', fontSize: '1.2rem' }}>
                    {quizState?.connected_teams_count || 0}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Registered Teams</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#F1F5F9', fontSize: '1.2rem' }}>
                    {teams.length}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Total Questions</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#67E8F9', fontSize: '1.2rem' }}>
                    {questions.length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Team Roster Summary */}
            <div className="glass-panel" style={{ padding: '20px', flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
              <h4 style={{ fontSize: '0.8rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                ACTIVE TEAMS MONITOR
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teams.map((t) => (
                  <div key={t.team_id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: t.connected ? '#10B981' : '#64748B'
                      }} />
                      <span style={{ fontWeight: 600 }}>{t.team_name}</span>
                    </div>
                    {t.has_active_session && (
                      <button
                        onClick={() => handleReleaseSession(t.team_id)}
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.7rem', color: '#F87171' }}
                        title="Release stuck session"
                      >
                        Release
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUESTION BANK */}
      {activeTab === 'questions' && (
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Question Bank</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configure questions, options, duration, and maximum speed points.</p>
            </div>
            <button onClick={() => setShowAddQuestionModal(true)} className="btn btn-primary">
              <Plus size={18} />
              <span>Add Question</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {questions.map((q, idx) => (
              <div key={q.question_id} style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      color: '#A5B4FC',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem'
                    }}>
                      Q{idx + 1}
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#FFF' }}>{q.prompt}</h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ⏱️ {q.duration_seconds}s • 🏆 {q.max_points} pts
                    </span>
                    <button
                      onClick={() => handleDeleteQuestion(q.question_id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', color: '#F87171' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {q.options.map((opt) => (
                    <div key={opt.id} style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: opt.id === q.correct_option ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                      border: opt.id === q.correct_option ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontWeight: 800, color: opt.id === q.correct_option ? '#34D399' : 'var(--text-muted)' }}>
                        {opt.id}:
                      </span>
                      <span style={{ color: opt.id === q.correct_option ? '#FFF' : 'var(--text-muted)' }}>
                        {opt.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TEAM ROSTER */}
      {activeTab === 'teams' && (
        <div className="glass-panel" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700 }}>Team Accounts & Active Sessions</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Single-device login policy: release stuck sessions if a device reboots.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowCsvModal(true)} className="btn btn-secondary">
                <span>Bulk CSV Import</span>
              </button>
              <button onClick={() => setShowAddTeamModal(true)} className="btn btn-primary">
                <Plus size={18} />
                <span>Add Single Team</span>
              </button>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-faint)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Team ID</th>
                <th style={{ padding: '12px 16px' }}>Team Name</th>
                <th style={{ padding: '12px 16px' }}>Session Lease</th>
                <th style={{ padding: '12px 16px' }}>Live Socket</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#67E8F9' }}>
                    {t.team_id}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    {t.team_name}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.has_active_session ? (
                      <span className="status-pill warning" style={{ fontSize: '0.7rem' }}>Claimed</span>
                    ) : (
                      <span className="status-pill online" style={{ fontSize: '0.7rem' }}>Available</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.connected ? (
                      <span style={{ color: '#34D399', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                        Connected
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-faint)', fontSize: '0.85rem' }}>Offline</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {t.has_active_session && (
                        <button
                          onClick={() => handleReleaseSession(t.team_id)}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#FBBF24' }}
                          title="Release Session so team can re-login"
                        >
                          Release Session
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTeam(t.team_id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', color: '#F87171' }}
                        title="Delete team"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: RESULTS & EXPORT */}
      {activeTab === 'results' && (
        <div>
          {/* Supabase Leaderboard Sync Banner */}
          <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', border: '1px solid rgba(16, 185, 129, 0.25)', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <Database size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>Supabase Leaderboard & Marks Editor</h4>
                    {supabaseStatus?.configured ? (
                      supabaseStatus.reachable ? (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', border: '1px solid #10B981', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                          ● Synced Live ({supabaseStatus.row_count} rows in {supabaseStatus.table_name})
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', border: '1px solid #F59E0B', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                          ● Configured (Connecting...)
                        </span>
                      )
                    ) : (
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', border: '1px solid #6366F1', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>
                        Local Engine Active (Add SUPABASE_URL to connect)
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Any manual edits to team marks or scores made in your Supabase Table Editor can be pulled and broadcasted immediately to all live screens.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handlePullSupabase}
                  disabled={supabaseLoading}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderColor: '#06B6D4' }}
                  title="Pull manual mark adjustments from Supabase Table Editor"
                >
                  <DownloadCloud size={16} color="#06B6D4" />
                  <span>{supabaseLoading ? 'Syncing...' : 'Pull from Supabase'}</span>
                </button>

                <button
                  onClick={handlePushSupabase}
                  disabled={supabaseLoading}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', borderColor: '#10B981' }}
                  title="Push current leaderboard state to Supabase"
                >
                  <UploadCloud size={16} color="#10B981" />
                  <span>Push to Supabase</span>
                </button>

                <button
                  onClick={handleCopySql}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                  title="Copy Supabase table creation SQL"
                >
                  <Copy size={16} />
                  <span>Copy SQL Setup</span>
                </button>

                <a
                  href={api.exportCSVUrl()}
                  download="quiz_results_export.csv"
                  className="btn btn-success"
                  style={{ padding: '8px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <Download size={16} />
                  <span>Export CSV</span>
                </a>
              </div>
            </div>
          </div>

          <Leaderboard
            leaderboard={leaderboard}
            isFinal={status === 'COMPLETED'}
            onEditMarks={handleOpenEditMarks}
          />
        </div>
      )}

      {/* MODAL: Add Single Team */}
      {showAddTeamModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
            <h3 className="font-display" style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Create Team Account</h3>
            <form onSubmit={handleCreateTeam}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Team ID</label>
                <input
                  type="text"
                  placeholder="TEAM010"
                  className="input-field"
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Team Name</label>
                <input
                  type="text"
                  placeholder="Nova Champions"
                  className="input-field"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Password</label>
                <input
                  type="text"
                  placeholder="pass123"
                  className="input-field"
                  value={newTeamPassword}
                  onChange={(e) => setNewTeamPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddTeamModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CSV Bulk Import */}
      {showCsvModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '540px', padding: '32px' }}>
            <h3 className="font-display" style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Bulk Import Teams (CSV)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
              Format: <code>team_id,team_name,password</code> (one per line)
            </p>
            <form onSubmit={handleImportCsv}>
              <textarea
                rows={8}
                placeholder={`TEAM101,Vortex Legends,pass123\nTEAM102,Cyber Strikers,pass123\nTEAM103,Matrix Runners,pass123`}
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', resize: 'vertical' }}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                required
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
                <button type="button" onClick={() => setShowCsvModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Import All Teams
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Question */}
      {showAddQuestionModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '32px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="font-display" style={{ fontSize: '1.3rem', marginBottom: '16px' }}>Add Question to Bank</h3>
            <form onSubmit={handleAddQuestion}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Question Prompt</label>
                <textarea
                  rows={2}
                  placeholder="What is the capital of..."
                  className="input-field"
                  value={newQPrompt}
                  onChange={(e) => setNewQPrompt(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#818CF8' }}>Option A</label>
                  <input type="text" className="input-field" value={newQOptA} onChange={(e) => setNewQOptA(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#38BDF8' }}>Option B</label>
                  <input type="text" className="input-field" value={newQOptB} onChange={(e) => setNewQOptB(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#FBBF24' }}>Option C</label>
                  <input type="text" className="input-field" value={newQOptC} onChange={(e) => setNewQOptC(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#C084FC' }}>Option D</label>
                  <input type="text" className="input-field" value={newQOptD} onChange={(e) => setNewQOptD(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: '#34D399' }}>Correct Option</label>
                  <select
                    className="input-field"
                    value={newQCorrect}
                    onChange={(e) => setNewQCorrect(e.target.value)}
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Duration (s)</label>
                  <input type="number" min={5} max={120} className="input-field" value={newQDuration} onChange={(e) => setNewQDuration(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Max Points</label>
                  <input type="number" min={100} max={5000} step={100} className="input-field" value={newQPoints} onChange={(e) => setNewQPoints(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setShowAddQuestionModal(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Team Marks (Supabase & Live Sync) */}
      {showMarksModal && editTeam && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '32px', border: '1px solid #10B981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                <Edit3 size={18} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: '1.25rem', margin: 0 }}>Adjust Team Marks</h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Syncs to Supabase and updates live leaderboard ranks
                </p>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#FFF' }}>{editTeam.team_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>ID: {editTeam.team_id}</div>
            </div>

            <form onSubmit={handleSaveMarks}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Total Marks / Score (pts)
                </label>
                <input
                  type="number"
                  step="1"
                  className="input-field"
                  value={editMarksVal}
                  onChange={(e) => setEditMarksVal(Number(e.target.value))}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowMarksModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, background: '#10B981' }}
                >
                  Save & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
