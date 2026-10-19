import os
import logging
from datetime import datetime, timezone
import requests

logger = logging.getLogger("SupabaseService")

SUPABASE_TABLE_SQL = """-- ================================================================
-- SUPABASE COMPLETE SETUP (login_credentials & leaderboard)
-- Run this in your Supabase Project -> SQL Editor
-- ================================================================

-- 1. LOGIN CREDENTIALS TABLE (Unified Sheet for BOTH Teams and Organizers)
CREATE TABLE IF NOT EXISTS public.login_credentials (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'team', -- 'team' or 'organizer'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. LEADERBOARD TABLE (Synced live marks, scores & rankings)
CREATE TABLE IF NOT EXISTS public.leaderboard (
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
ALTER TABLE public.login_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow public read & write access
DROP POLICY IF EXISTS "Allow public read login_credentials" ON public.login_credentials;
CREATE POLICY "Allow public read login_credentials" ON public.login_credentials FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write login_credentials" ON public.login_credentials;
CREATE POLICY "Allow public write login_credentials" ON public.login_credentials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public read leaderboard" ON public.leaderboard FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public write leaderboard" ON public.leaderboard;
CREATE POLICY "Allow public write leaderboard" ON public.leaderboard FOR ALL USING (true) WITH CHECK (true);

-- Insert Starter Credentials (Both Organizers and Teams in one sheet!)
INSERT INTO public.login_credentials (username, name, password, role) VALUES
('admin', 'Head Organizer', 'admin123', 'organizer'),
('organizer', 'Host', 'admin123', 'organizer'),
('TEAM001', 'Quantum Voyagers', 'pass123', 'team'),
('TEAM002', 'Cyber Knights', 'pass123', 'team'),
('TEAM003', 'Binary Bandits', 'pass123', 'team'),
('TEAM004', 'Neural Ninjas', 'pass123', 'team'),
('TEAM005', 'Apex Legends', 'pass123', 'team')
ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, name = EXCLUDED.name;
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

    def get_team_from_supabase(self, identifier: str) -> dict | None:
        """
        Fetches team by team_id OR team_name from Supabase public.teams table.
        Allows logging in with either ID or Team Name as defined in Supabase.
        """
        self.reload_config()
        if not self.is_configured() or not identifier:
            return None

        try:
            import urllib.parse
            clean_id = urllib.parse.quote(identifier.strip())
            # Search by team_id OR team_name
            endpoint = f"{self.url}/rest/v1/teams?or=(team_id.ilike.{clean_id},team_name.ilike.{clean_id})&select=*&limit=1"
            resp = requests.get(endpoint, headers=self._get_headers(), timeout=4)
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    return rows[0]
        except Exception as e:
            logger.error(f"Error fetching team '{identifier}' from Supabase: {e}")
        return None

    def get_all_teams_from_supabase(self) -> list:
        """Fetches all teams defined in the Supabase public.teams table."""
        self.reload_config()
        if not self.is_configured():
            return []

        try:
            endpoint = f"{self.url}/rest/v1/teams?select=*&order=created_at.asc"
            resp = requests.get(endpoint, headers=self._get_headers(), timeout=4)
            if resp.status_code == 200:
                return resp.json()
        except Exception as e:
            logger.error(f"Error fetching all teams from Supabase: {e}")
        return []

    def create_team_in_supabase(self, team_id: str, team_name: str, password: str) -> bool:
        """Creates or updates a team record directly in Supabase public.teams table."""
        self.reload_config()
        if not self.is_configured():
            return False

        try:
            endpoint = f"{self.url}/rest/v1/teams?on_conflict=team_id"
            now_iso = datetime.now(timezone.utc).isoformat()
            payload = [{
                "team_id": team_id.strip().upper(),
                "team_name": team_name.strip(),
                "password": password.strip(),
                "is_active": True,
                "created_at": now_iso
            }]
            resp = requests.post(endpoint, headers=self._get_headers(prefer_upsert=True), json=payload, timeout=4)
            return resp.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Error creating team in Supabase: {e}")
            return False

    def delete_team_in_supabase(self, team_id: str) -> bool:
        """Deletes a team record from Supabase public.teams table."""
        self.reload_config()
        if not self.is_configured():
            return False

        try:
            endpoint = f"{self.url}/rest/v1/teams?team_id=eq.{team_id.strip().upper()}"
            resp = requests.delete(endpoint, headers=self._get_headers(), timeout=4)
            return resp.status_code in [200, 204]
        except Exception as e:
            logger.error(f"Error deleting team from Supabase: {e}")
            return False

    def get_admin_from_supabase(self, username: str) -> dict | None:
        """Fetches admin credentials from Supabase public.admins table."""
        self.reload_config()
        if not self.is_configured() or not username:
            return None

        try:
            import urllib.parse
            clean_u = urllib.parse.quote(username.strip())
            endpoint = f"{self.url}/rest/v1/admins?username=ilike.{clean_u}&select=*&limit=1"
            resp = requests.get(endpoint, headers=self._get_headers(), timeout=4)
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    return rows[0]
        except Exception as e:
            logger.error(f"Error fetching admin '{username}' from Supabase: {e}")
        return None

    # --- UNIFIED LOGIN CREDENTIALS METHODS ---

    def get_credential_from_supabase(self, identifier: str, role: str = None) -> dict | None:
        """
        Fetches user login credential from Supabase public.login_credentials table.
        Matches by username OR name (case-insensitive).
        Optionally filters by role ('team' or 'organizer').
        """
        self.reload_config()
        if not self.is_configured() or not identifier:
            return None

        try:
            import urllib.parse
            clean_id = urllib.parse.quote(identifier.strip())
            endpoint = f"{self.url}/rest/v1/login_credentials?or=(username.ilike.{clean_id},name.ilike.{clean_id})&select=*&limit=1"
            if role:
                if role == "organizer":
                    endpoint += "&role=in.(organizer,admin,host)"
                else:
                    endpoint += f"&role=eq.{urllib.parse.quote(role)}"

            resp = requests.get(endpoint, headers=self._get_headers(), timeout=4)
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    return rows[0]
        except Exception as e:
            logger.error(f"Error fetching login_credentials '{identifier}' from Supabase: {e}")
        return None

    def get_all_team_credentials_from_supabase(self) -> list:
        """Fetches all teams from public.login_credentials table (role = 'team')."""
        self.reload_config()
        if not self.is_configured():
            return []

        try:
            endpoint = f"{self.url}/rest/v1/login_credentials?role=eq.team&select=*&order=username.asc"
            resp = requests.get(endpoint, headers=self._get_headers(), timeout=4)
            if resp.status_code == 200:
                rows = resp.json()
                return [{
                    "team_id": r["username"],
                    "team_name": r.get("name") or r["username"],
                    "password": r.get("password"),
                    "is_active": r.get("is_active", True),
                    "created_at": r.get("created_at")
                } for r in rows]
        except Exception as e:
            logger.error(f"Error fetching team login credentials from Supabase: {e}")
        return []

    def create_or_update_credential_in_supabase(self, username: str, name: str, password: str, role: str = "team") -> bool:
        """Upserts a credential directly into public.login_credentials table."""
        self.reload_config()
        if not self.is_configured():
            return False

        try:
            endpoint = f"{self.url}/rest/v1/login_credentials?on_conflict=username"
            now_iso = datetime.now(timezone.utc).isoformat()
            payload = [{
                "username": username.strip(),
                "name": name.strip(),
                "password": password.strip(),
                "role": role.strip().lower(),
                "is_active": True,
                "created_at": now_iso
            }]
            resp = requests.post(endpoint, headers=self._get_headers(prefer_upsert=True), json=payload, timeout=4)
            return resp.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Error creating/updating login_credentials in Supabase: {e}")
            return False

    def delete_credential_in_supabase(self, username: str) -> bool:
        """Deletes a credential from public.login_credentials table."""
        self.reload_config()
        if not self.is_configured():
            return False

        try:
            import urllib.parse
            clean_u = urllib.parse.quote(username.strip())
            endpoint = f"{self.url}/rest/v1/login_credentials?username=eq.{clean_u}"
            resp = requests.delete(endpoint, headers=self._get_headers(), timeout=4)
            return resp.status_code in [200, 204]
        except Exception as e:
            logger.error(f"Error deleting login_credentials from Supabase: {e}")
            return False

supabase_service = SupabaseService()

