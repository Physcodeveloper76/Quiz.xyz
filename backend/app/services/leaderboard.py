import time
import logging
from app.database import db
from app.services.supabase_service import supabase_service

logger = logging.getLogger("LeaderboardService")

class LeaderboardService:
    @staticmethod
    def get_leaderboard(quiz_id: str = "default_quiz", sync_to_supabase: bool = True):
        """
        Calculates and returns sorted leaderboard for the given quiz.
        Sorted by total_score/marks DESC, total_response_time_ms ASC (tie breaker).
        Automatically syncs with Supabase if configured.
        """
        all_teams = db.teams.find({"is_active": True})
        team_map = {t["team_id"]: t["team_name"] for t in all_teams}

        answers = db.answers.find({"quiz_id": quiz_id})

        stats = {tid: {"team_id": tid, "team_name": team_map.get(tid, tid), "total_score": 0, "marks": 0, "correct_count": 0, "total_time_ms": 0} for tid in team_map}

        for ans in answers:
            tid = ans.get("team_id")
            if tid not in stats:
                stats[tid] = {
                    "team_id": tid,
                    "team_name": team_map.get(tid, tid),
                    "total_score": 0,
                    "marks": 0,
                    "correct_count": 0,
                    "total_time_ms": 0
                }
            pts = ans.get("points", 0)
            stats[tid]["total_score"] += pts
            stats[tid]["marks"] = stats[tid]["total_score"]
            if ans.get("is_correct"):
                stats[tid]["correct_count"] += 1
            stats[tid]["total_time_ms"] += ans.get("elapsed_ms", 0)

        # Sort: Highest score/marks first, then quickest total time
        sorted_leaderboard = sorted(
            stats.values(),
            key=lambda x: (-x["total_score"], x["total_time_ms"])
        )

        # Assign ranks and update results collection
        for idx, item in enumerate(sorted_leaderboard):
            item["rank"] = idx + 1
            item["marks"] = item["total_score"]
            db.results.update_one(
                {"quiz_id": quiz_id, "team_id": item["team_id"]},
                {"$set": {
                    "quiz_id": quiz_id,
                    "team_id": item["team_id"],
                    "team_name": item["team_name"],
                    "total_score": item["total_score"],
                    "marks": item["marks"],
                    "correct_count": item["correct_count"],
                    "rank": item["rank"],
                    "finalized_at": time.time()
                }},
                upsert=True
            )

        # Auto-sync to Supabase table
        if sync_to_supabase and supabase_service.is_configured():
            try:
                supabase_service.sync_leaderboard_to_supabase(sorted_leaderboard, quiz_id)
            except Exception as e:
                logger.warning(f"Failed to push leaderboard to Supabase: {e}")

        return sorted_leaderboard

    @staticmethod
    def pull_and_sync_from_supabase(quiz_id: str = "default_quiz"):
        """
        Fetches modified marks and leaderboard entries from Supabase.
        Applies changes to the local state, re-sorts, re-ranks, and updates db.results.
        """
        if not supabase_service.is_configured():
            return None, "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in environment."

        rows = supabase_service.fetch_leaderboard_from_supabase(quiz_id)
        if not rows:
            return None, "No leaderboard records found in Supabase table."

        # Re-sort by marks DESC, total_time_ms ASC to ensure fair ranking after manual edits
        sorted_rows = sorted(
            rows,
            key=lambda x: (-float(x.get("marks", x.get("total_score", 0))), float(x.get("total_time_ms", 0)))
        )

        for idx, item in enumerate(sorted_rows):
            item["rank"] = idx + 1
            item["total_score"] = item["marks"]
            # Update local database
            db.results.update_one(
                {"quiz_id": quiz_id, "team_id": item["team_id"]},
                {"$set": {
                    "quiz_id": quiz_id,
                    "team_id": item["team_id"],
                    "team_name": item["team_name"],
                    "total_score": item["total_score"],
                    "marks": item["marks"],
                    "correct_count": item["correct_count"],
                    "rank": item["rank"],
                    "finalized_at": time.time()
                }},
                upsert=True
            )

            # Also ensure team name in db.teams matches if edited in Supabase
            db.teams.update_one(
                {"team_id": item["team_id"]},
                {"$set": {"team_name": item["team_name"]}},
                upsert=False
            )

        logger.info(f"Successfully pulled and applied {len(sorted_rows)} leaderboard entries from Supabase.")
        return sorted_rows, None

leaderboard_service = LeaderboardService()

