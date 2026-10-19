import os
import logging
from datetime import datetime, timezone
import requests

logger = logging.getLogger("SupabaseService")

SUPABASE_TABLE_SQL = """-- Run this in your Supabase project's SQL Editor:
CREATE TABLE IF NOT EXISTS leaderboard (
    quiz_id TEXT NOT NULL DEFAULT 'default_quiz',
    team_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    marks NUMERIC NOT NULL DEFAULT 0,
    total_score NUMERIC NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    total_time_ms NUMERIC NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (quiz_id, team_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow public read access to the leaderboard
DROP POLICY IF EXISTS "Allow public read access to leaderboard" ON leaderboard;
CREATE POLICY "Allow public read access to leaderboard"
ON leaderboard FOR SELECT
USING (true);

-- Allow write/update access (for backend and service key)
DROP POLICY IF EXISTS "Allow public insert/update to leaderboard" ON leaderboard;
CREATE POLICY "Allow public insert/update to leaderboard"
ON leaderboard FOR ALL
USING (true)
WITH CHECK (true);
"""

class SupabaseService:
    @staticmethod
    def _clean_url(raw_url: str) -> str:
        url = (raw_url or "").strip().rstrip("/")
        if url.endswith("/rest/v1"):
            url = url[:-len("/rest/v1")].rstrip("/")
        return url

    def __init__(self):
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        self.url = self._clean_url(os.environ.get("SUPABASE_URL", ""))
        self.key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
            os.environ.get("SUPABASE_KEY") or
            os.environ.get("SUPABASE_ANON_KEY") or
            ""
        ).strip()
        self.table_name = os.environ.get("SUPABASE_LEADERBOARD_TABLE", "leaderboard")

        if self.is_configured():
            logger.info(f"Supabase configured: {self.url} (Table: {self.table_name})")
        else:
            logger.info("Supabase not configured. Leaderboard will run with local embedded storage. Set SUPABASE_URL and SUPABASE_KEY to activate.")

    def reload_config(self):
        try:
            from dotenv import load_dotenv
            load_dotenv()
        except ImportError:
            pass

        self.url = self._clean_url(os.environ.get("SUPABASE_URL", ""))
        self.key = (
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or
            os.environ.get("SUPABASE_KEY") or
            os.environ.get("SUPABASE_ANON_KEY") or
            ""
        ).strip()
        self.table_name = os.environ.get("SUPABASE_LEADERBOARD_TABLE", "leaderboard")

    def is_configured(self) -> bool:
        return bool(self.url and self.key)


    def _get_headers(self, prefer_upsert=False):
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if prefer_upsert:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"
        return headers

    def get_status(self):
        self.reload_config()
        configured = self.is_configured()
        reachable = False
        row_count = 0
        error = None

        if configured:
            try:
                endpoint = f"{self.url}/rest/v1/{self.table_name}?select=count"
                headers = self._get_headers()
                headers["Range-Unit"] = "items"
                headers["Prefer"] = "count=exact"
                resp = requests.get(endpoint, headers=headers, timeout=3)
                if resp.status_code in [200, 206]:
                    reachable = True
                    content_range = resp.headers.get("Content-Range", "")
                    if "/" in content_range:
                        row_count = int(content_range.split("/")[-1]) if content_range.split("/")[-1] != "*" else 0
                else:
                    error = f"HTTP {resp.status_code}: {resp.text[:120]}"
            except Exception as e:
                error = str(e)

        return {
            "configured": configured,
            "reachable": reachable,
            "supabase_url": self.url or None,
            "table_name": self.table_name,
            "row_count": row_count,
            "error": error,
            "schema_sql": SUPABASE_TABLE_SQL
        }

    def sync_leaderboard_to_supabase(self, leaderboard_data: list, quiz_id: str = "default_quiz") -> bool:
        """
        Pushes and upserts the sorted leaderboard into Supabase.
        Includes marks, total_score, rank, accuracy, and elapsed time.
        """
        self.reload_config()
        if not self.is_configured() or not leaderboard_data:
            return False

        try:
            records = []
            now_iso = datetime.now(timezone.utc).isoformat()
            for item in leaderboard_data:
                score = item.get("total_score", item.get("marks", 0))
                records.append({
                    "quiz_id": quiz_id,
                    "team_id": item["team_id"],
                    "team_name": item.get("team_name", item["team_id"]),
                    "marks": score,
                    "total_score": score,
                    "correct_count": item.get("correct_count", 0),
                    "total_time_ms": item.get("total_time_ms", 0),
                    "rank": item.get("rank", 1),
                    "updated_at": now_iso
                })

            endpoint = f"{self.url}/rest/v1/{self.table_name}?on_conflict=quiz_id,team_id"
            resp = requests.post(
                endpoint,
                headers=self._get_headers(prefer_upsert=True),
                json=records,
                timeout=5
            )

            if resp.status_code in [200, 201]:
                logger.info(f"Successfully synced {len(records)} leaderboard entries to Supabase table '{self.table_name}'.")
                return True
            else:
                logger.warning(f"Supabase sync returned status {resp.status_code}: {resp.text[:200]}")
                return False
        except Exception as e:
            logger.error(f"Failed to sync leaderboard to Supabase: {e}")
            return False

    def fetch_leaderboard_from_supabase(self, quiz_id: str = "default_quiz") -> list:
        """
        Fetches the leaderboard rows from Supabase table.
        If changes to marks, names, or scores were made directly in the Supabase Table Editor,
        this method returns the authoritative Supabase data.
        """
        self.reload_config()
        if not self.is_configured():
            return []

        try:
            # Query ordering by marks (or total_score) DESC, total_time_ms ASC
            endpoint = f"{self.url}/rest/v1/{self.table_name}?quiz_id=eq.{quiz_id}&select=*&order=marks.desc,total_time_ms.asc"
            resp = requests.get(
                endpoint,
                headers=self._get_headers(),
                timeout=5
            )

            if resp.status_code == 200:
                rows = resp.json()
                # Ensure rank and proper field types
                formatted = []
                for idx, row in enumerate(rows):
                    score = row.get("marks") if row.get("marks") is not None else row.get("total_score", 0)
                    formatted.append({
                        "team_id": str(row.get("team_id")),
                        "team_name": str(row.get("team_name") or row.get("team_id")),
                        "marks": score,
                        "total_score": score,
                        "correct_count": int(row.get("correct_count") or 0),
                        "total_time_ms": float(row.get("total_time_ms") or 0),
                        "rank": int(row.get("rank") or (idx + 1)),
                        "quiz_id": quiz_id,
                        "updated_at": row.get("updated_at")
                    })
                return formatted
            else:
                logger.warning(f"Supabase fetch returned status {resp.status_code}: {resp.text[:200]}")
                return []
        except Exception as e:
            logger.error(f"Failed to fetch leaderboard from Supabase: {e}")
            return []

    def update_team_marks_in_supabase(self, team_id: str, marks: float, quiz_id: str = "default_quiz") -> bool:
        """Directly updates a team's marks and total_score in Supabase."""
        self.reload_config()
        if not self.is_configured():
            return False

        try:
            endpoint = f"{self.url}/rest/v1/{self.table_name}?quiz_id=eq.{quiz_id}&team_id=eq.{team_id}"
            now_iso = datetime.now(timezone.utc).isoformat()
            payload = {
                "marks": marks,
                "total_score": marks,
                "updated_at": now_iso
            }
            resp = requests.patch(
                endpoint,
                headers=self._get_headers(),
                json=payload,
                timeout=4
            )
            return resp.status_code in [200, 204]
        except Exception as e:
            logger.error(f"Failed to update team marks in Supabase: {e}")
            return False

supabase_service = SupabaseService()
