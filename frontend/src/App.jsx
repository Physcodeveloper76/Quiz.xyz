import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import WaitingRoom from './pages/WaitingRoom';
import LiveQuiz from './pages/LiveQuiz';
import AdminDashboard from './pages/AdminDashboard';
import { api } from './services/api';
import { socketService } from './services/socket';
import { sounds } from './services/AudioCues';

export default function App() {
  const [role, setRole] = useState(null); // 'team' | 'admin' | null
  const [team, setTeam] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [quizState, setQuizState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on mount
  useEffect(() => {
    let cancelled = false;

    const initSession = async () => {
      const storedToken = localStorage.getItem('quiz_token');
      const storedRole = localStorage.getItem('quiz_role');

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const me = await api.getMe();
        if (cancelled) return;
        setRole(me.role);
        if (me.team) setTeam(me.team);
        if (me.quiz_state) setQuizState(me.quiz_state);

        // Connect socket and join authorized room
        socketService.connect();
        socketService.join(me.role, me.team?.team_id, storedToken);
      } catch (err) {
        console.warn('Session expired or invalidated:', err);
        if (!cancelled) handleLogout();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initSession();

    // Safety timeout: if getMe() hangs for >6s, force show login
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 6000);

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
  }, []);

  // Socket event subscriptions
  useEffect(() => {
    const unsubConn = socketService.on('connection_change', (status) => {
      setIsConnected(status);
    });

    // CRITICAL: Handle joined_success to sync quiz state after socket auth
    const unsubJoined = socketService.on('joined_success', (data) => {
      if (data.state) {
        setQuizState(data.state);
      }
    });

    const unsubQOpen = socketService.on('question_open', (data) => {
      setQuizState(data);
      sounds.playLock();
    });

    const unsubReveal = socketService.on('question_reveal', (data) => {
      setQuizState((prev) => ({
        ...prev,
        status: 'REVEAL',
        question: {
          ...prev?.question,
          correct_option: data.correct_option
        },
        leaderboard: data.leaderboard
      }));
    });

    const unsubLeaderboard = socketService.on('leaderboard_update', (data) => {
      setQuizState((prev) => ({ ...prev, leaderboard: data.leaderboard }));
    });

    const unsubSubmission = socketService.on('submission_update', (data) => {
      setQuizState((prev) => ({
        ...prev,
        submitted_teams_count: data.submitted_count,
        eligible_teams_count: data.eligible_count
      }));
    });

    const unsubPause = socketService.on('quiz_paused', (data) => {
      setQuizState((prev) => ({ ...prev, status: 'PAUSED', paused_remaining_ms: data.remaining_ms }));
    });

    const unsubResume = socketService.on('quiz_resumed', (data) => {
      setQuizState((prev) => ({
        ...prev,
        status: 'QUESTION_OPEN',
        deadline_at: data.deadline_at
      }));
    });

    const unsubCompleted = socketService.on('quiz_completed', (data) => {
      setQuizState((prev) => ({
        ...prev,
        status: 'COMPLETED',
        leaderboard: data.leaderboard
      }));
    });

    const unsubReset = socketService.on('quiz_reset', () => {
      setQuizState((prev) => ({
        ...prev,
        status: 'LOBBY',
        current_question_id: null,
        question: null
      }));
    });

    const unsubTelemetry = socketService.on('telemetry_update', (data) => {
      setQuizState((prev) => ({
        ...prev,
        connected_teams_count: data.connected_teams_count
      }));
    });

    const unsubRevoked = socketService.on('session_revoked', () => {
      alert('Your session has been released or revoked by the organizer.');
      handleLogout();
    });

    // Periodic state poll as safety net (covers missed socket events)
    const pollInterval = setInterval(async () => {
      const storedToken = localStorage.getItem('quiz_token');
      if (!storedToken) return;
      try {
        const state = await api.getCurrentQuiz();
        if (state && state.status) {
          setQuizState((prev) => {
            // Update if status changed, question changed, or question data was missing
            if (
              !prev ||
              prev.status !== state.status ||
              prev.current_question_id !== state.current_question_id ||
              (!prev.question && state.question)
            ) {
              return state;
            }
            return prev;
          });
        }
      } catch (e) {
        // Silently ignore poll errors
      }
    }, 4000);

    return () => {
      unsubConn();
      unsubJoined();
      unsubQOpen();
      unsubReveal();
      unsubLeaderboard();
      unsubSubmission();
      unsubPause();
      unsubResume();
      unsubCompleted();
      unsubReset();
      unsubTelemetry();
      unsubRevoked();
      clearInterval(pollInterval);
    };
  }, []);

  const handleLoginSuccess = ({ role, token, team, quiz_state }) => {
    localStorage.setItem('quiz_token', token);
    localStorage.setItem('quiz_role', role);
    if (team) {
      localStorage.setItem('quiz_team_id', team.team_id);
      setTeam(team);
    }
    setRole(role);
    if (quiz_state) setQuizState(quiz_state);

    socketService.connect();
    socketService.join(role, team?.team_id, token);
  };

  const handleLogout = () => {
    if (team?.team_id) {
      api.logout(team.team_id).catch(() => {});
    }
    localStorage.removeItem('quiz_token');
    localStorage.removeItem('quiz_role');
    localStorage.removeItem('quiz_team_id');
    socketService.disconnect();
    setRole(null);
    setTeam(null);
    setIsConnected(false);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div className="status-pill online">Synchronizing Championship Platform...</div>
        <button
          onClick={() => { setLoading(false); handleLogout(); }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Taking too long? Click here to sign in
        </button>
      </div>
    );
  }

  const status = quizState?.status || 'LOBBY';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        role={role}
        team={team}
        isConnected={isConnected}
        onLogout={handleLogout}
      />

      <main style={{ flex: 1, paddingBottom: '40px' }}>
        {!role ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : role === 'admin' ? (
          <AdminDashboard
            quizState={quizState}
            onStateUpdate={(st) => setQuizState(st)}
          />
        ) : status === 'LOBBY' || status === 'READY' ? (
          <WaitingRoom team={team} quizState={quizState} />
        ) : (
          <LiveQuiz
            quizState={quizState}
            team={team}
            onAnswerSubmitted={() => {}}
            onQuizStateUpdate={(st) => setQuizState(st)}
          />
        )}
      </main>
    </div>
  );
}
