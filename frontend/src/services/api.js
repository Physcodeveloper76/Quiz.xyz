const rawApiUrl = import.meta.env.VITE_API_URL;
const API_BASE = rawApiUrl ? `${rawApiUrl.replace(/\/$/, '')}/api` : '/api';

function getHeaders() {
  const token = localStorage.getItem('quiz_token') || '';
  const teamId = localStorage.getItem('quiz_team_id') || '';
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (teamId) {
    headers['X-Team-ID'] = teamId;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const config = {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {})
    }
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || 'Network request failed');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

export const api = {
  // Auth
  loginTeam: (team_id, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ team_id, password })
  }),
  loginAdmin: (username, password) => request('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  logout: (team_id) => request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ team_id })
  }),
  getMe: () => request('/me'),

  // Participant Quiz
  getCurrentQuiz: () => request('/quiz/current'),
  getQuizResults: () => request('/quiz/results'),

  // Admin Teams
  getTeams: () => request('/admin/teams'),
  createTeam: (team_id, team_name, password) => request('/admin/teams', {
    method: 'POST',
    body: JSON.stringify({ team_id, team_name, password })
  }),
  importTeamsCSV: (csv) => request('/admin/teams/import-csv', {
    method: 'POST',
    body: JSON.stringify({ csv })
  }),
  releaseTeamSession: (team_id) => request(`/admin/teams/${team_id}/release`, {
    method: 'POST'
  }),
  resetPassword: (team_id, password) => request(`/admin/teams/${team_id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password })
  }),
  deleteTeam: (team_id) => request(`/admin/teams/${team_id}`, {
    method: 'DELETE'
  }),

  // Admin Questions
  getQuestions: () => request('/admin/questions'),
  addQuestion: (q) => request('/admin/questions', {
    method: 'POST',
    body: JSON.stringify(q)
  }),
  updateQuestion: (id, q) => request(`/admin/questions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(q)
  }),
  deleteQuestion: (id) => request(`/admin/questions/${id}`, {
    method: 'DELETE'
  }),

  // Admin Control Room
  startQuiz: () => request('/admin/quiz/start', { method: 'POST' }),
  advanceQuiz: () => request('/admin/quiz/advance', { method: 'POST' }),
  pauseQuiz: () => request('/admin/quiz/pause', { method: 'POST' }),
  resumeQuiz: () => request('/admin/quiz/resume', { method: 'POST' }),
  revealQuiz: () => request('/admin/quiz/reveal', { method: 'POST' }),
  resetQuiz: () => request('/admin/quiz/reset', { method: 'POST' }),
  exportCSVUrl: () => `${API_BASE}/admin/export`,

  // Supabase Leaderboard Integration
  getSupabaseStatus: () => request('/admin/supabase/status'),
  pushSupabase: () => request('/admin/supabase/push', { method: 'POST' }),
  pullSupabase: () => request('/admin/supabase/pull', { method: 'POST' }),
  updateTeamMarks: (teamId, marks) => request(`/admin/supabase/team/${teamId}/marks`, {
    method: 'PUT',
    body: JSON.stringify({ marks })
  }),
};

