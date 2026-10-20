import React, { useState, useEffect } from 'react';
import TimerBar from '../components/TimerBar';
import QuestionCard from '../components/QuestionCard';
import Leaderboard from '../components/Leaderboard';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { sounds } from '../services/AudioCues';
import { Award, Pause, Sparkles, Loader } from 'lucide-react';

export default function LiveQuiz({ quizState, team, onAnswerSubmitted }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  const currentQ = quizState?.question;
  const status = quizState?.status;
  const isRevealed = status === 'REVEAL' || status === 'QUESTION_CLOSED' || status === 'COMPLETED';

  // Check if team already submitted an answer in existing state
  useEffect(() => {
    if (quizState?.team_submission) {
      setSelectedOption(quizState.team_submission.selected_option);
      setIsLocked(true);
      if (quizState.team_submission.points !== null) {
        setPointsEarned(quizState.team_submission.points);
      }
    } else {
      setSelectedOption(null);
      setIsLocked(false);
      setPointsEarned(0);
    }
  }, [quizState?.current_question_id]);

  // Listen for answer lock confirmation
  useEffect(() => {
    const unsubAnswer = socketService.on('answer_received', (data) => {
      setSelectedOption(data.selected_option);
      setIsLocked(true);
      sounds.playLock();
      if (onAnswerSubmitted) onAnswerSubmitted(data);
    });

    const unsubReveal = socketService.on('question_reveal', (data) => {
      if (team && data.team_results && data.team_results[team.team_id]) {
        const myResult = data.team_results[team.team_id];
        setPointsEarned(myResult.points || 0);
        if (myResult.is_correct) {
          sounds.playCorrect();
        } else {
          sounds.playWrong();
        }
      }
    });

    return () => {
      unsubAnswer();
      unsubReveal();
    };
  }, [team, onAnswerSubmitted]);

  const handleSelectOption = (optionId) => {
    if (isLocked || isRevealed || !currentQ) return;
    setSelectedOption(optionId);
    try {
      socketService.submitAnswer(currentQ.question_id, optionId);
      setIsLocked(true);
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }
  };

  if (status === 'COMPLETED') {
    return (
      <div style={{ padding: '20px' }}>
        <Leaderboard
          leaderboard={quizState?.leaderboard || []}
          currentTeamId={team?.team_id}
          isFinal={true}
        />
      </div>
    );
  }

  // If quiz is active but question data hasn't arrived yet, show loading state
  if (!currentQ && (status === 'QUESTION_OPEN' || status === 'REVEAL')) {
    return (
      <div style={{ maxWidth: '850px', margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="glass-panel animate-slide-up" style={{ padding: '48px 32px' }}>
          <Loader size={40} color="#6366F1" style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
          <h2 className="font-display" style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Loading Question...
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Syncing with quiz server. This should only take a moment.
          </p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '850px', margin: '20px auto', padding: '0 20px' }}>
      {/* Paused Banner */}
      {status === 'PAUSED' && (
        <div className="glass-panel animate-slide-up" style={{
          padding: '16px 24px',
          background: 'rgba(245, 158, 11, 0.2)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          color: '#FBBF24',
          borderRadius: '14px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontWeight: 700
        }}>
          <Pause size={20} />
          <span>QUIZ PAUSED BY ORGANIZER — TIMER FROZEN</span>
        </div>
      )}

      {/* Countdown Timer */}
      {!isRevealed && status === 'QUESTION_OPEN' && currentQ && (
        <TimerBar
          deadlineAt={quizState?.deadline_at}
          durationSeconds={quizState?.duration_seconds}
          isPaused={status === 'PAUSED'}
        />
      )}

      {/* Main Question Arena */}
      {currentQ && (
        <QuestionCard
          question={currentQ}
          selectedOption={selectedOption}
          isLocked={isLocked}
          isRevealed={isRevealed}
          correctOption={currentQ?.correct_option}
          pointsEarned={pointsEarned}
          onSelectOption={handleSelectOption}
        />
      )}
    </div>
  );
}
