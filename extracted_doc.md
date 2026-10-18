LIVE TEAM QUIZPLATFORM

Detailed System Architecture & Implementation Plan

React + Vite • Vercel • Flask + Socket.IO • MongoDB Atlas

Target: 100 simultaneous teamsRestricted team logins • Synchronized questions • Speed-based scoring

Document Contents

Executive Summary

1. Goals and Scope

2. High-Level Architecture

3. User Roles and Permissions

4. Restricted Team Login and Session Control

5. Quiz Lifecycle and State Machine

6. Speed-Based Scoring

7. Answer Reveal Logic

8. MongoDB Collections and Indexes

9. API and Socket.IO Contract

10. Admin Dashboard and Participant UI

11. Capacity and Performance Plan

12. Security and Anti-Cheating

13. Project Structure

14. Deployment Steps

15. Load-Test Acceptance Criteria

16. Implementation Roadmap

Appendix: Key Design Decisions

Executive Summary

This document defines the architecture for a Quiz.com-style live team quiz platform. Organizers supply their own questions, teams use pre-created credentials, all teams receive synchronized questions, and correct answers earn points based on response speed. Answers are revealed when every eligible team has submitted or the question deadline expires.

Target: 100 simultaneously connected teams. This is a design target that must be validated through load testing against the selected hosting plans and configuration.

Frontend: React + Vite on Vercel.

Backend: Python Flask with Flask-SocketIO on a persistent web service.

Database: MongoDB Atlas.

Optional Redis for cross-instance Socket.IO messaging and coordination.

One organizer-created account and one active authorized quiz session per team.

Server-authoritative question state, deadlines, answer validation, scoring, and leaderboard.

1. Goals and Scope

Run a live, host-controlled quiz where all teams see the same question during the same official time window.

Allow organizers to create and manage their own MCQs, correct options, question order, duration, and maximum points.

Require organizer-issued Team ID and password; no public team registration during the event.

Enforce one active authorized session per team account and prevent concurrent logins using the same credentials.

Score correct answers according to how quickly the server accepts them; incorrect and late answers earn zero.

Reveal the correct answer after all eligible teams submit or the deadline expires.

Show a live team leaderboard and final results, with export for organizers.

Handle refreshes, disconnections, duplicate requests, and backend recovery safely.

One active session is an account-level control. It cannot prove that only one physical person is using a device, and advanced proctoring is outside the initial scope.

2. High-Level Architecture

Layer

Technology

Responsibilities

Frontend

React + Vite on Vercel

Login, waiting room, question UI, countdown, host dashboard, leaderboard

Backend

Flask + Flask-SocketIO

Authentication, authorization, quiz state, validation, scoring, event broadcasting

Persistent hosting

Render or equivalent

Runs Flask-SocketIO and supports long-lived connections

Database

MongoDB Atlas

Teams, questions, quiz state, submissions, scores, results

Optional coordination

Redis

Cross-instance Socket.IO messages and shared coordination

Load testing

k6 or Locust

Concurrent logins, persistent connections, answer bursts, reconnect tests

Recommended starting point: one appropriately configured persistent Flask instance for 100 concurrent teams, plus MongoDB Atlas. Validate through load testing. Multiple instances require Socket.IO message distribution, appropriate load-balancer/session affinity where needed, and coordinated shared state.

3. User Roles and Permissions

Admin / Quiz Host

Create, edit, import, reorder, preview, and delete questions before the event.

Create team accounts manually or by CSV import; reset credentials and enable/disable teams.

Start, pause, resume, close, and advance the quiz.

Set question duration, maximum points, and reveal behaviour.

Monitor connected teams, submissions, current question, remaining time, and disconnections.

Release stuck sessions, revoke compromised sessions, inspect audit logs, and export results.

Team / Participant

Log in with organizer-issued Team ID and password.

Enter a waiting room until the host starts the quiz.

Receive synchronized questions, options, and official deadlines.

Submit one answer per question; the first accepted answer locks.

See the correct answer and points after reveal.

View team score and leaderboard position.

Every admin operation must be authorized on the backend. Hiding admin controls in the frontend is not a security control.

4. Restricted Team Login and Session Control

Each registered team receives a unique Team ID (for example, TEAM001) and password. Store passwords as secure hashes, never plaintext. Public registration is disabled during the competition.

Login flow

Team submits credentials over HTTPS.

Flask verifies the password hash and checks whether the account is active.

The backend atomically claims the team's active session. If another authorized session is active, reject the new login.

The backend issues a secure session credential and associates the connection with the authenticated team.

Answer submissions derive team identity from the authenticated session, never from a Team ID supplied by the browser.

On logout or admin release, revoke the session. A crashed device can recover through a defined lease and reconnection policy.

Session and reconnect rules

Reject a second active device; do not silently replace the current session.

Allow the same authorized session to reconnect after refresh or short Wi-Fi loss.

Use heartbeat, session lease, and a grace period for temporary network loss.

Lease expiry must not permit an unsafe takeover; revalidate and use explicit recovery rules.

Admin can release a stuck session or revoke a compromised one.

Rate-limit login attempts and log session events.

Implement session claiming with a conditional atomic database update and a unique index on team_id. A read-then-write sequence can allow two simultaneous logins.

5. Quiz Lifecycle and State Machine

State

Behaviour

LOBBY

Teams authenticate and wait; host checks roster

READY

Host prepares the quiz

QUESTION_OPEN

Teams may submit one answer before deadline

REVEAL

Submissions close; correct answer and results publish

QUESTION_CLOSED

Question result finalized

COMPLETED

Final results available

CANCELLED

Authorized host stops quiz

Synchronized question flow

Host starts the quiz; backend persists the state transition.

Backend records question ID, official opening timestamp, deadline, and version.

Backend broadcasts the question and deadline to authorized team connections.

Browsers render a countdown using the server-provided deadline; browser clocks do not determine scoring.

Flask validates and records answers; each accepted answer locks for that team.

Reveal begins when every eligible team submits or the deadline is reached, whichever happens first.

Backend finalizes results and broadcasts the correct option, points, and leaderboard update.

Host or configured schedule advances to the next question; the last question transitions to COMPLETED.

Define eligible team count before each question opens. A disconnected team does not silently disappear from the denominator. Pause/resume must store remaining time, establish a new deadline, and broadcast the updated state. State transitions must be serialized.

6. Speed-Based Scoring

Recommended configurable formula: correct answers earn points proportional to remaining time. Incorrect answers, timeouts, and late answers earn zero.

S = 0 if incorrect or late; otherwise S = floor(B × (1 − t/T))

B = maximum points for the question.

T = allowed duration.

t = elapsed time from official opening to server-accepted answer receipt.

Example: B = 1000 points and T = 20 seconds.

Accepted time

Correct answer score

1 second

950

2 seconds

900

5 seconds

750

10 seconds

500

15 seconds

250

19 seconds

50

Incorrect at any time

0

At/after deadline

0

Reference Python scoring function

import mathdef calculate_score(is_correct, elapsed_ms, duration_ms, max_points=1000):    if not is_correct:        return 0    if elapsed_ms < 0 or duration_ms <= 0:        return 0    # Deadline is exclusive: elapsed >= duration is late.    if elapsed_ms >= duration_ms:        return 0    remaining_fraction = 1 - elapsed_ms / duration_ms    return max(0, math.floor(max_points * remaining_fraction))

This function calculates points only. Before calling it, authenticate the team, verify the active question, enforce the deadline, check uniqueness, and use server receipt timestamps. Keep correct answers server-side until reveal.

Server-receipt timing is simple and auditable, but network latency may affect teams differently. Document the policy before the event.

7. Answer Reveal Logic

Reveal when all eligible teams have submitted OR the official deadline has been reached.

def should_reveal(eligible_team_count, submitted_team_count, deadline_reached):    all_submitted = (        eligible_team_count > 0        and submitted_team_count >= eligible_team_count    )    return all_submitted or deadline_reached

Close the question before publishing the reveal.

Reject new submissions after transition to REVEAL.

Unanswered teams receive zero for that question.

Do not include the correct answer in question-open payloads or participant API responses before reveal.

Serialize the reveal transition so simultaneous submissions and the deadline handler cannot finalize twice.

8. MongoDB Collections and Indexes

Collection

Representative fields / purpose

teams

team_id, team_name, password_hash, is_active, created_at

team_sessions

team_id, session_id, lease_expires_at, last_heartbeat_at, revoked_at

quizzes

quiz_id, status, duration settings, question order, scoring settings

questions

question_id, quiz_id, prompt, options, correct_option, duration_seconds, max_points

quiz_sessions

quiz_id, current_question_id, state, opened_at, deadline_at, version

answers

quiz_id, question_id, team_id, selected_option, received_at, is_correct, points, request_id

results

quiz_id, team_id, total_score, correct_count, rank, finalized_at

audit_logs

actor, action, timestamp, entity and safe metadata

Indexes and integrity

Unique index: teams.team_id.

Unique index: team_sessions.team_id.

Unique compound index: answers(quiz_id, question_id, team_id).

Unique compound index: results(quiz_id, team_id).

Use idempotency keys so retries do not award points twice.

Use atomic conditional updates for session claims; use transactions when multiple document changes must be all-or-nothing and supported.

9. API and Socket.IO Contract

REST API endpoints

Method

Endpoint

Purpose

POST

/api/auth/login

Authenticate team

POST

/api/auth/logout

Release/revoke session

GET

/api/me

Authenticated identity/status

GET

/api/quiz/current

Current question state

GET

/api/quiz/results

Permitted results

POST

/api/admin/teams

Create team accounts

POST

/api/admin/questions

Create question

POST

/api/admin/quiz/start

Start quiz

POST

/api/admin/quiz/advance

Advance question

POST

/api/admin/teams/{id}/release

Release team session

GET

/api/admin/export

Export results

Socket.IO events

Event

Direction

Purpose

join_quiz

Client → server

Join authorized team room

question_open

Server → clients

Question, options, deadline

submit_answer

Client → server

Submit selected option

answer_received

Server → team

Confirm accepted submission

question_reveal

Server → clients

Reveal answer and results

leaderboard_update

Server → clients

Updated ranking

quiz_paused

Server → clients

Synchronize pause

quiz_resumed

Server → clients

Synchronize new deadline

quiz_completed

Server → clients

Final status/results

session_revoked

Server → client

Invalidate session

Every socket event must authenticate and authorize the sender. A client cannot join another team's room by providing an arbitrary team ID. The submission may include quiz_id, question_id, selected_option, and request_id; team_id is derived from the session.

10. Admin Dashboard and Participant UI

Admin sections

Overview: registered/connected teams, submissions, current question, remaining time, and status.

Team management: create teams, CSV import, reset credentials, enable/disable, release sessions.

Question manager: add/edit/reorder MCQs, correct options, duration, points, and preview.

Live control room: start/pause/resume/close/advance; view submissions and connections.

Leaderboard/results: live rankings, answer audit, tie-break rules, final results, CSV export.

Participant screens

Team login: Team ID and password.

Waiting room: team identity, connection status, waiting for host.

Live question: question number, options, countdown, and answer selection.

Answer submitted: locked state and waiting-for-reveal message.

Question results: correctness, points, and current rank.

Final results: final score and rank, according to event rules.

Design mobile-first, show connection status, and avoid requiring refresh during live gameplay.

11. Capacity and Performance Plan

Target 100 authenticated concurrent Socket.IO connections.

Test a burst of 100 submissions for one question.

Do not send countdown updates every second from the backend; send a deadline and let browsers render the countdown.

Use indexed queries and efficient leaderboard updates.

Keep backend and database in nearby regions where possible.

Use one persistent backend instance initially if load tests support it.

For multiple instances, configure Redis-backed Socket.IO distribution, appropriate session affinity, and coordinated quiz/session state.

Do not acknowledge an answer as accepted until it is safely persisted.

Scenario

Expected result

100 teams connect

All authorized teams can join

100 simultaneous submissions

Each valid answer stored once

Team loses Wi-Fi

Other teams continue; team can reconnect

Browser refresh

Authorized session/state restored

Duplicate answer/retry

No duplicate score

Deadline expires

Question closes and reveal begins

Backend restart

Recover persisted state or require safe resume

Temporary database failure

Do not claim unpersisted answer was accepted

12. Security and Anti-Cheating

Hash passwords with Argon2id or another suitable password-hashing algorithm.

Use HTTPS, secure session cookies or carefully managed tokens, and appropriate SameSite settings.

Keep secrets and MongoDB credentials in server-side environment variables.

Restrict CORS to the deployed frontend origin.

Rate-limit login attempts and validate request payloads.

Authorize every admin endpoint and audit sensitive actions.

Keep correct answers server-side until reveal.

Use server timestamps and deadlines; never trust browser scores or client time.

Enforce one answer per team/question with unique indexes and idempotent retries.

Revoke old sessions after admin recovery.

Use database backups, health checks, logs, and a recovery procedure.

The frontend countdown is display-only. Security decisions and scoring happen on the backend.

13. Project Structure

quiz-platform/├── frontend/│   ├── src/│   │   ├── components/ (Timer, QuestionCard, Leaderboard)│   │   ├── pages/ (Login, WaitingRoom, LiveQuiz, Results, AdminDashboard)│   │   ├── services/ (api.js, socket.js)│   │   └── App.jsx│   ├── package.json│   └── .env                 # local only; do not commit├── backend/│   ├── app/│   │   ├── routes/ (auth.py, admin.py, quiz.py)│   │   ├── services/ (authentication.py, session_manager.py,│   │   │             quiz_engine.py, scoring.py, leaderboard.py)│   │   ├── sockets/ (events.py)│   │   ├── database.py│   │   └── __init__.py│   ├── tests/│   ├── requirements.txt│   ├── wsgi.py│   └── .env                 # local only; do not commit└── README.md

Keep frontend and backend independently deployable. Add tests for authentication, scoring boundaries, duplicate submissions, state transitions, and session claims.

14. Deployment Steps

Step 1: MongoDB Atlas

Create a cluster and dedicated database user with least-privilege access.

Configure network access securely and create collections/indexes.

Store the connection URI in backend environment variables.

Test database connectivity from Flask.

Step 2: Flask backend

Deploy to a persistent service such as Render or equivalent that supports long-lived WebSocket connections.

Install Flask, Flask-SocketIO, compatible production server, PyMongo, and required dependencies.

Configure production Socket.IO, allowed frontend origin, secret key, MongoDB URI, and admin credentials.

Test login, session claims, answer validation, scoring, reveals, reconnection, and simultaneous submissions.

Step 3: Vercel frontend

Connect frontend repository to Vercel.

Set build command to npm run build and output directory to dist.

Configure public API and Socket.IO URLs.

Configure SPA rewrites if required; test mobile and desktop.

Step 4: Production hardening

Enable HTTPS, secure cookies, CORS restrictions, and rate limits.

Configure health checks, logs, backups, and recovery procedures.

Keep frontend and backend secrets separate; never expose server secrets in Vite variables.

Step 5: Load test

Simulate 100 team logins and persistent connections.

Open a question for all teams and submit answers in a burst.

Test deadline expiry, early reveal, duplicates, disconnections, reconnection, and admin controls.

Verify persisted scores and final ranking against answer records.

Example environment variables

# Backend environment (server only)MONGODB_URI=<your-private-mongodb-uri>MONGODB_DB=quiz_platformSECRET_KEY=<strong-random-secret>FRONTEND_ORIGIN=https://your-quiz.vercel.appADMIN_USERNAME=organizer# Frontend environment (public values only)VITE_API_URL=https://your-backend.example.comVITE_SOCKET_URL=https://your-backend.example.com

Never put MONGODB_URI, SECRET_KEY, or an admin password in a VITE_ variable. Do not use Flask's development server as the production deployment configuration.

15. Load-Test Acceptance Criteria

Test

Acceptance criterion

Concurrent logins

100 registered teams can connect

Duplicate login

Second active session for a team is rejected

Submission burst

Every valid answer recorded exactly once

Scoring

Points match formula and timing boundary

Early reveal

Reveal starts when all eligible teams submit

Deadline reveal

Reveal starts when deadline expires

Answer secrecy

Correct answer hidden before reveal

Reconnect

Team resumes without losing score or duplicating session

Leaderboard

Rankings match persisted score records

Backend restart

State recovers without duplicate scoring or host safely resumes

Export

Final results can be exported and checked

Use k6 or Locust to test realistic persistent connections and burst traffic. A test that makes 100 ordinary HTTP requests does not adequately test 100 persistent Socket.IO connections.

16. Implementation Roadmap

Phase 1: Authentication and database. Build admin login, team creation/import, password hashing, atomic session claims, and reconnect policy.

Phase 2: Quiz management. Build question CRUD, quiz settings, and host controls.

Phase 3: Live engine. Add synchronized events, official deadlines, answer submission, idempotency, and scoring.

Phase 4: Reveal and leaderboard. Implement all-submitted/deadline reveal, rankings, recovery, final results, and CSV export.

Phase 5: Deployment and validation. Deploy frontend/backend/database, configure security, and load-test 100 teams.

Core design principle: Flask is authoritative for identity, time, correctness, score, and quiz state. React renders the experience, Socket.IO distributes live events, and MongoDB persists records.

Appendix: Key Design Decisions

One account per team, created by organizers.

One active authorized session per team, with safe reconnect and admin recovery.

One accepted answer per team per question.

First accepted answer locks; no changes after submission.

Correct + speed scoring; wrong, unanswered, and late answers earn zero.

Reveal after all eligible teams submit or deadline expires.

Backend-owned deadlines and scores; browser countdown is display-only.

Vercel hosts frontend; persistent Flask host runs Socket.IO; MongoDB Atlas stores data.

100 simultaneous teams is a target to validate with load testing, not an untested guarantee.