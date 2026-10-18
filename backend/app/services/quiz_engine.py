import time
import threading
import logging
from app.database import db
from app.services.scoring import calculate_score
from app.services.leaderboard import leaderboard_service

logger = logging.getLogger("QuizEngine")

class QuizEngine:
    def __init__(self):
        self.lock = threading.Lock()
        self.timer_thread = None
        self.stop_timer_flag = threading.Event()
        self.socketio = None # Injected by app initialization
        self.connected_teams = set() # team_id's currently connected via socket
        self.default_quiz_id = "default_quiz"
        self._ensure_default_quiz()

    def set_socketio(self, socketio):
        self.socketio = socketio

    def _ensure_default_quiz(self):
        quiz = db.quizzes.find_one({"quiz_id": self.default_quiz_id})
        if not quiz:
            db.quizzes.insert_one({
                "quiz_id": self.default_quiz_id,
                "title": "Championship Live Team Quiz",
                "status": "LOBBY",
                "current_question_index": 0,
                "created_at": time.time()
            })
            # Insert default starter questions if none exist
            if db.questions.count_documents({}) == 0:
                starter_questions = [
                    {
                        "question_id": "q1",
                        "quiz_id": self.default_quiz_id,
                        "order": 1,
                        "prompt": "What is the primary transport mechanism used for real-time bi-directional events in modern web apps?",
                        "options": [
                            {"id": "A", "text": "HTTP Long Polling"},
                            {"id": "B", "text": "WebSockets"},
                            {"id": "C", "text": "Server-Sent Events"},
                            {"id": "D", "text": "FTP Tunneling"}
                        ],
                        "correct_option": "B",
                        "duration_seconds": 20,
                        "max_points": 1000
                    },
                    {
                        "question_id": "q2",
                        "quiz_id": self.default_quiz_id,
                        "order": 2,
                        "prompt": "In speed-based scoring, why is server-authoritative timestamping critical?",
                        "options": [
                            {"id": "A", "text": "To prevent tampering with client-side system clocks"},
                            {"id": "B", "text": "Because client clocks are always faster than servers"},
                            {"id": "C", "text": "To save bandwidth on the participant device"},
                            {"id": "D", "text": "It is required by the HTTP/2 specification"}
                        ],
                        "correct_option": "A",
                        "duration_seconds": 20,
                        "max_points": 1000
                    },
                    {
                        "question_id": "q3",
                        "quiz_id": self.default_quiz_id,
                        "order": 3,
                        "prompt": "Which data structure provides average O(1) time complexity for key lookups?",
                        "options": [
                            {"id": "A", "text": "Binary Search Tree"},
                            {"id": "B", "text": "Linked List"},
                            {"id": "C", "text": "Hash Table"},
                            {"id": "D", "text": "B-Tree Index"}
                        ],
                        "correct_option": "C",
                        "duration_seconds": 15,
                        "max_points": 1000
                    },
                    {
                        "question_id": "q4",
                        "quiz_id": self.default_quiz_id,
                        "order": 4,
                        "prompt": "What is the primary benefit of atomic database operations during team login?",
                        "options": [
                            {"id": "A", "text": "Reduces network latency across regions"},
                            {"id": "B", "text": "Eliminates race conditions and prevents concurrent logins"},
                            {"id": "C", "text": "Compresses user session tokens"},
                            {"id": "D", "text": "Encrypts MongoDB collections at rest"}
                        ],
                        "correct_option": "B",
                        "duration_seconds": 20,
                        "max_points": 1000
                    },
                    {
                        "question_id": "q5",
                        "quiz_id": self.default_quiz_id,
                        "order": 5,
                        "prompt": "When should the correct answer be revealed according to the architecture specification?",
                        "options": [
                            {"id": "A", "text": "Only when the timer reaches 0"},
                            {"id": "B", "text": "Immediately after each team clicks any option"},
                            {"id": "C", "text": "When all eligible teams submit OR when deadline expires"},
                            {"id": "D", "text": "After the host manually reviews each submission"}
                        ],
                        "correct_option": "C",
                        "duration_seconds": 20,
                        "max_points": 1200
                    }
                ]
                for q in starter_questions:
                    db.questions.insert_one(q)

    def get_state(self):
        """Returns the synchronized state of the quiz."""
        with self.lock:
            quiz = db.quizzes.find_one({"quiz_id": self.default_quiz_id})
            if not quiz:
                self._ensure_default_quiz()
                quiz = db.quizzes.find_one({"quiz_id": self.default_quiz_id})

            session = db.quiz_sessions.find_one({"quiz_id": self.default_quiz_id}) or {}
            questions = db.questions.find({"quiz_id": self.default_quiz_id}, sort=[("order", 1)])
            current_q_id = session.get("current_question_id")
            current_q = db.questions.find_one({"question_id": current_q_id}) if current_q_id else None

            # Submissions for current question
            submitted_count = 0
            if current_q_id:
                submitted_count = db.answers.count_documents({
                    "quiz_id": self.default_quiz_id,
                    "question_id": current_q_id
                })

            eligible_count = max(len(self.connected_teams), db.teams.count_documents({"is_active": True}))

            return {
                "quiz_id": self.default_quiz_id,
                "title": quiz.get("title", "Live Quiz"),
                "status": session.get("state", quiz.get("status", "LOBBY")),
                "current_question_index": quiz.get("current_question_index", 0),
                "total_questions": len(questions),
                "current_question_id": current_q_id,
                "opened_at": session.get("opened_at"),
                "deadline_at": session.get("deadline_at"),
                "duration_seconds": session.get("duration_seconds", 20),
                "remaining_ms": max(0, int((session.get("deadline_at", 0) - time.time() * 1000))) if session.get("deadline_at") else 0,
                "submitted_teams_count": submitted_count,
                "eligible_teams_count": eligible_count,
                "connected_teams_count": len(self.connected_teams),
                "question": self._sanitize_question(current_q, session.get("state"))
            }

    def _sanitize_question(self, question, state):
        if not question:
            return None
        sanitized = {
            "question_id": question.get("question_id"),
            "order": question.get("order"),
            "prompt": question.get("prompt"),
            "options": question.get("options", []),
            "duration_seconds": question.get("duration_seconds", 20),
            "max_points": question.get("max_points", 1000)
        }
        # Reveal correct answer ONLY if state is REVEAL, QUESTION_CLOSED, or COMPLETED
        if state in ("REVEAL", "QUESTION_CLOSED", "COMPLETED"):
            sanitized["correct_option"] = question.get("correct_option")
        return sanitized

    def start_quiz(self):
        """Starts quiz from beginning or advances to question 1."""
        return self.open_question(question_index=0)

    def open_question(self, question_index=None):
        with self.lock:
            questions = db.questions.find({"quiz_id": self.default_quiz_id}, sort=[("order", 1)])
            if not questions:
                return False, "No questions found in question bank."

            if question_index is None:
                quiz = db.quizzes.find_one({"quiz_id": self.default_quiz_id})
                question_index = quiz.get("current_question_index", 0)

            if question_index >= len(questions):
                return self.complete_quiz()

            target_q = questions[question_index]
            now_ms = time.time() * 1000
            duration_ms = target_q.get("duration_seconds", 20) * 1000
            deadline_ms = now_ms + duration_ms

            # Update quiz record
            db.quizzes.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"status": "QUESTION_OPEN", "current_question_index": question_index}}
            )

            # Update session
            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {
                    "quiz_id": self.default_quiz_id,
                    "current_question_id": target_q["question_id"],
                    "state": "QUESTION_OPEN",
                    "opened_at": now_ms,
                    "deadline_at": deadline_ms,
                    "duration_seconds": target_q.get("duration_seconds", 20),
                    "version": time.time()
                }},
                upsert=True
            )

            # Cancel existing timer thread
            self.stop_timer_flag.set()
            self.stop_timer_flag = threading.Event()

            # Launch background deadline watcher
            def timer_worker(deadline_timestamp, flag, q_id):
                while not flag.is_set():
                    current_time_ms = time.time() * 1000
                    if current_time_ms >= deadline_timestamp:
                        logger.info(f"Deadline reached for question {q_id}. Triggering reveal.")
                        self.trigger_reveal(reason="deadline_expired")
                        break
                    time.sleep(0.1)

            self.timer_thread = threading.Thread(
                target=timer_worker,
                args=(deadline_ms, self.stop_timer_flag, target_q["question_id"]),
                daemon=True
            )
            self.timer_thread.start()

            # Broadcast to clients
            payload = self.get_state()
            if self.socketio:
                self.socketio.emit("question_open", payload)
            
            return True, "Question opened successfully."

    def submit_answer(self, team_id, question_id, selected_option, request_id=None):
        """
        Receives team answer, validates deadline, checks idempotency, calculates score,
        and triggers early reveal if all eligible teams have submitted.
        """
        server_receipt_ms = time.time() * 1000

        with self.lock:
            session = db.quiz_sessions.find_one({"quiz_id": self.default_quiz_id})
            if not session or session.get("state") != "QUESTION_OPEN":
                return False, "Submissions are currently closed.", 0

            if session.get("current_question_id") != question_id:
                return False, "This question is no longer active.", 0

            # Check if answer already recorded (idempotency check)
            existing = db.answers.find_one({
                "quiz_id": self.default_quiz_id,
                "question_id": question_id,
                "team_id": team_id
            })
            if existing:
                return True, "Answer already recorded.", existing.get("points", 0)

            question = db.questions.find_one({"question_id": question_id})
            if not question:
                return False, "Question not found.", 0

            opened_at = session.get("opened_at", server_receipt_ms)
            deadline_at = session.get("deadline_at", server_receipt_ms)
            duration_ms = question.get("duration_seconds", 20) * 1000
            elapsed_ms = server_receipt_ms - opened_at

            is_correct = (selected_option == question.get("correct_option"))
            max_points = question.get("max_points", 1000)

            # Check if received after official deadline
            if server_receipt_ms >= deadline_at:
                points = 0
                logger.info(f"Team {team_id} submitted after deadline: elapsed {elapsed_ms}ms >= {duration_ms}ms")
            else:
                points = calculate_score(is_correct, elapsed_ms, duration_ms, max_points)

            # Save answer to database
            answer_record = {
                "quiz_id": self.default_quiz_id,
                "question_id": question_id,
                "team_id": team_id,
                "selected_option": selected_option,
                "received_at": server_receipt_ms,
                "elapsed_ms": elapsed_ms,
                "is_correct": is_correct,
                "points": points,
                "request_id": request_id
            }
            try:
                db.answers.insert_one(answer_record)
            except Exception as e:
                logger.warning(f"Duplicate answer caught by unique index: {e}")
                existing = db.answers.find_one({
                    "quiz_id": self.default_quiz_id,
                    "question_id": question_id,
                    "team_id": team_id
                })
                return True, "Answer recorded.", existing.get("points", 0) if existing else 0

            # Notify team of accepted submission
            if self.socketio:
                self.socketio.emit("answer_received", {
                    "question_id": question_id,
                    "selected_option": selected_option,
                    "received_at": server_receipt_ms,
                    "status": "LOCKED"
                }, room=team_id)

            # Check submission counts for early reveal
            submitted_count = db.answers.count_documents({
                "quiz_id": self.default_quiz_id,
                "question_id": question_id
            })
            eligible_count = max(len(self.connected_teams), db.teams.count_documents({"is_active": True}))

            # Broadcast updated telemetry to admin and players
            if self.socketio:
                self.socketio.emit("submission_update", {
                    "submitted_count": submitted_count,
                    "eligible_count": eligible_count,
                    "latest_team": team_id
                })

            # Early reveal logic: reveal if all eligible connected teams have submitted!
            if eligible_count > 0 and submitted_count >= eligible_count:
                logger.info(f"All {submitted_count}/{eligible_count} eligible teams submitted! Triggering early reveal.")
                self.trigger_reveal(reason="all_teams_submitted")

            return True, "Answer accepted and locked.", points

    def trigger_reveal(self, reason="deadline"):
        """Transitions state from QUESTION_OPEN to REVEAL and publishes results."""
        with self.lock:
            session = db.quiz_sessions.find_one({"quiz_id": self.default_quiz_id})
            if not session or session.get("state") != "QUESTION_OPEN":
                return # Already revealed or closed

            self.stop_timer_flag.set()

            q_id = session.get("current_question_id")
            question = db.questions.find_one({"question_id": q_id})
            correct_option = question.get("correct_option") if question else None

            # Atomically update session state
            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"state": "REVEAL"}}
            )
            db.quizzes.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"status": "REVEAL"}}
            )

            # Update leaderboard
            leaderboard = leaderboard_service.get_leaderboard(self.default_quiz_id)

            # Collect team breakdown for this question
            answers = db.answers.find({
                "quiz_id": self.default_quiz_id,
                "question_id": q_id
            })
            breakdown = {
                "A": 0, "B": 0, "C": 0, "D": 0
            }
            team_results = {}
            for ans in answers:
                opt = ans.get("selected_option")
                if opt in breakdown:
                    breakdown[opt] += 1
                team_results[ans.get("team_id")] = {
                    "selected_option": opt,
                    "is_correct": ans.get("is_correct"),
                    "points": ans.get("points"),
                    "elapsed_ms": ans.get("elapsed_ms")
                }

            reveal_payload = {
                "question_id": q_id,
                "correct_option": correct_option,
                "reason": reason,
                "breakdown": breakdown,
                "team_results": team_results,
                "leaderboard": leaderboard,
                "state": "REVEAL"
            }

            if self.socketio:
                self.socketio.emit("question_reveal", reveal_payload)
                self.socketio.emit("leaderboard_update", {"leaderboard": leaderboard})

            logger.info(f"Reveal triggered for question {q_id}. Correct: {correct_option}")

    def advance_question(self):
        """Advances to the next question in sequence."""
        quiz = db.quizzes.find_one({"quiz_id": self.default_quiz_id})
        next_index = quiz.get("current_question_index", 0) + 1
        return self.open_question(question_index=next_index)

    def pause_quiz(self):
        with self.lock:
            session = db.quiz_sessions.find_one({"quiz_id": self.default_quiz_id})
            if not session or session.get("state") != "QUESTION_OPEN":
                return False, "Quiz is not currently open."

            self.stop_timer_flag.set()
            now_ms = time.time() * 1000
            remaining_ms = max(0, session.get("deadline_at", 0) - now_ms)

            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"state": "PAUSED", "paused_remaining_ms": remaining_ms}}
            )

            if self.socketio:
                self.socketio.emit("quiz_paused", {"remaining_ms": remaining_ms})
            return True, "Quiz paused."

    def resume_quiz(self):
        with self.lock:
            session = db.quiz_sessions.find_one({"quiz_id": self.default_quiz_id})
            if not session or session.get("state") != "PAUSED":
                return False, "Quiz is not currently paused."

            remaining_ms = session.get("paused_remaining_ms", 10000)
            now_ms = time.time() * 1000
            new_deadline_ms = now_ms + remaining_ms

            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {
                    "state": "QUESTION_OPEN",
                    "deadline_at": new_deadline_ms
                }, "$unset": {"paused_remaining_ms": ""}}
            )

            self.stop_timer_flag.set()
            self.stop_timer_flag = threading.Event()

            def resume_timer(deadline, flag, q_id):
                while not flag.is_set():
                    if time.time() * 1000 >= deadline:
                        self.trigger_reveal(reason="deadline_expired")
                        break
                    time.sleep(0.1)

            self.timer_thread = threading.Thread(
                target=resume_timer,
                args=(new_deadline_ms, self.stop_timer_flag, session.get("current_question_id")),
                daemon=True
            )
            self.timer_thread.start()

            if self.socketio:
                self.socketio.emit("quiz_resumed", {
                    "deadline_at": new_deadline_ms,
                    "remaining_ms": remaining_ms
                })
            return True, "Quiz resumed."

    def complete_quiz(self):
        with self.lock:
            self.stop_timer_flag.set()
            db.quizzes.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"status": "COMPLETED"}}
            )
            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"state": "COMPLETED"}}
            )
            leaderboard = leaderboard_service.get_leaderboard(self.default_quiz_id)
            if self.socketio:
                self.socketio.emit("quiz_completed", {"leaderboard": leaderboard})
            return True, "Quiz completed."

    def reset_quiz(self):
        """Resets the quiz to LOBBY state and clears submissions."""
        with self.lock:
            self.stop_timer_flag.set()
            db.answers.delete_many({"quiz_id": self.default_quiz_id})
            db.results.delete_many({"quiz_id": self.default_quiz_id})
            db.quizzes.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {"status": "LOBBY", "current_question_index": 0}}
            )
            db.quiz_sessions.update_one(
                {"quiz_id": self.default_quiz_id},
                {"$set": {
                    "state": "LOBBY",
                    "current_question_id": None,
                    "opened_at": None,
                    "deadline_at": None
                }}
            )
            if self.socketio:
                self.socketio.emit("quiz_reset", {"status": "LOBBY"})
            return True, "Quiz has been reset to Lobby."

quiz_engine = QuizEngine()
