import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.heartbeatTimer = null;
    this.connected = false;
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Connects to configured VITE_SOCKET_URL (or VITE_API_URL) when deployed on Vercel, else window.location.origin
    const socketTarget = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
    this.socket = io(socketTarget, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      this._emitToListeners('connection_change', true);
      this._startHeartbeat();
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this._emitToListeners('connection_change', false);
      this._stopHeartbeat();
    });

    // Wire global broadcast events
    const eventNames = [
      'question_open',
      'answer_received',
      'submission_update',
      'submission_status',
      'question_reveal',
      'leaderboard_update',
      'quiz_paused',
      'quiz_resumed',
      'quiz_completed',
      'quiz_reset',
      'session_revoked',
      'telemetry_update',
      'joined_success',
      'auth_error',
      'heartbeat_ack'
    ];

    eventNames.forEach(evt => {
      this.socket.on(evt, (data) => {
        this._emitToListeners(evt, data);
      });
    });

    return this.socket;
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.socket.connected) {
        const token = localStorage.getItem('quiz_token');
        this.socket.emit('heartbeat', { token });
      }
    }, 15000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  join(role, teamId, token) {
    if (!this.socket) {
      this.connect();
    }
    this.socket.emit('join_quiz', {
      role,
      team_id: teamId,
      token
    });
  }

  submitAnswer(questionId, selectedOption) {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Not connected to live quiz server.');
    }
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.socket.emit('submit_answer', {
      question_id: questionId,
      selected_option: selectedOption,
      request_id: requestId
    });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  _emitToListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }

  disconnect() {
    this._stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }
}

export const socketService = new SocketService();
