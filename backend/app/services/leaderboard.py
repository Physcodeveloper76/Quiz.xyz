import time
from app.database import db

class LeaderboardService:
    @staticmethod
    def get_leaderboard(quiz_id: str = "default_quiz"):
        """
        Calculates and returns sorted leaderboard for the given quiz.
        Sorted by total_score DESC, total_response_time_ms ASC (tie breaker).
        """
        all_teams = db.teams.find({"is_active": True})
        team_map = {t["team_id"]: t["team_name"] for t in all_teams}

        answers = db.answers.find({"quiz_id": quiz_id})

        stats = {tid: {"team_id": tid, "team_name": team_map.get(tid, tid), "total_score": 0, "correct_count": 0, "total_time_ms": 0} for tid in team_map}

        for ans in answers:
            tid = ans.get("team_id")
            if tid not in stats:
                stats[tid] = {
                    "team_id": tid,
                    "team_name": team_map.get(tid, tid),
                    "total_score": 0,
                    "correct_count": 0,
                    "total_time_ms": 0
                }
            stats[tid]["total_score"] += ans.get("points", 0)
            if ans.get("is_correct"):
                stats[tid]["correct_count"] += 1
            stats[tid]["total_time_ms"] += ans.get("elapsed_ms", 0)

        # Sort: Highest score first, then quickest total time
        sorted_leaderboard = sorted(
            stats.values(),
            key=lambda x: (-x["total_score"], x["total_time_ms"])
        )

        # Assign ranks
        for idx, item in enumerate(sorted_leaderboard):
            item["rank"] = idx + 1
            # Update results collection
            db.results.update_one(
                {"quiz_id": quiz_id, "team_id": item["team_id"]},
                {"$set": {
                    "quiz_id": quiz_id,
                    "team_id": item["team_id"],
                    "team_name": item["team_name"],
                    "total_score": item["total_score"],
                    "correct_count": item["correct_count"],
                    "rank": item["rank"],
                    "finalized_at": time.time()
                }},
                upsert=True
            )

        return sorted_leaderboard

leaderboard_service = LeaderboardService()
