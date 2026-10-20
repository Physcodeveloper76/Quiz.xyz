import os
import time
import logging
from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, DuplicateKeyError

logger = logging.getLogger("QuizDB")
logging.basicConfig(level=logging.INFO)

MONGODB_URI = os.environ.get("MONGODB_URI")
DB_NAME = os.environ.get("MONGODB_DB", "quiz_platform")

class InMemoryCollection:
    """Thread-safe in-memory replica of PyMongo collection with index & uniqueness checks."""
    def __init__(self, name, unique_keys=None):
        self.name = name
        self.data = []
        self.unique_keys = unique_keys or []

    def _matches(self, doc, query):
        for k, v in query.items():
            # Support $or operator: {"$or": [{...}, {...}]}
            if k == "$or" and isinstance(v, list):
                if not any(self._matches(doc, sub_query) for sub_query in v):
                    return False
                continue
            # Support $and operator: {"$and": [{...}, {...}]}
            if k == "$and" and isinstance(v, list):
                if not all(self._matches(doc, sub_query) for sub_query in v):
                    return False
                continue
            if isinstance(v, dict):
                if "$in" in v and doc.get(k) not in v["$in"]:
                    return False
                if "$ne" in v and doc.get(k) == v["$ne"]:
                    return False
                if "$gt" in v and not (doc.get(k) is not None and doc.get(k) > v["$gt"]):
                    return False
                if "$gte" in v and not (doc.get(k) is not None and doc.get(k) >= v["$gte"]):
                    return False
                if "$lt" in v and not (doc.get(k) is not None and doc.get(k) < v["$lt"]):
                    return False
                if "$lte" in v and not (doc.get(k) is not None and doc.get(k) <= v["$lte"]):
                    return False
            elif doc.get(k) != v:
                return False
        return True

    def find_one(self, query=None, sort=None):
        query = query or {}
        matches = [d for d in self.data if self._matches(d, query)]
        if not matches:
            return None
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda x: x.get(key, 0), reverse=(direction < 0))
        return dict(matches[0])

    def find(self, query=None, sort=None):
        query = query or {}
        matches = [dict(d) for d in self.data if self._matches(d, query)]
        if sort:
            for key, direction in reversed(sort):
                matches.sort(key=lambda x: x.get(key, 0) or 0, reverse=(direction < 0))
        return matches

    def insert_one(self, doc):
        doc = dict(doc)
        # Check unique constraint
        for uk in self.unique_keys:
            if isinstance(uk, tuple):
                conflict = any(all(d.get(k) == doc.get(k) for k in uk) for d in self.data)
            else:
                conflict = any(d.get(uk) == doc.get(uk) for d in self.data if doc.get(uk) is not None)
            if conflict:
                raise DuplicateKeyError(f"Duplicate key error for index on {uk}")
        self.data.append(doc)
        return type("InsertResult", (), {"inserted_id": doc.get("_id", id(doc))})

    def update_one(self, query, update, upsert=False):
        matched = None
        for d in self.data:
            if self._matches(d, query):
                matched = d
                break
        
        if matched is None:
            if upsert:
                new_doc = dict(query)
                if "$set" in update:
                    new_doc.update(update["$set"])
                self.insert_one(new_doc)
                return type("UpdateResult", (), {"matched_count": 0, "modified_count": 1, "upserted_id": 1})
            return type("UpdateResult", (), {"matched_count": 0, "modified_count": 0})

        if "$set" in update:
            for k, v in update["$set"].items():
                matched[k] = v
        if "$inc" in update:
            for k, v in update["$inc"].items():
                matched[k] = matched.get(k, 0) + v
        if "$unset" in update:
            for k in update["$unset"]:
                matched.pop(k, None)

        return type("UpdateResult", (), {"matched_count": 1, "modified_count": 1})

    def delete_one(self, query):
        for i, d in enumerate(self.data):
            if self._matches(d, query):
                del self.data[i]
                return type("DeleteResult", (), {"deleted_count": 1})
        return type("DeleteResult", (), {"deleted_count": 0})

    def delete_many(self, query):
        initial = len(self.data)
        self.data = [d for d in self.data if not self._matches(d, query)]
        return type("DeleteResult", (), {"deleted_count": initial - len(self.data)})

    def count_documents(self, query=None):
        query = query or {}
        return sum(1 for d in self.data if self._matches(d, query))

    def create_index(self, keys, unique=False):
        if unique:
            key_names = tuple(k[0] for k in keys) if isinstance(keys, list) else keys
            if key_names not in self.unique_keys:
                self.unique_keys.append(key_names)


class DatabaseProxy:
    def __init__(self):
        self.client = None
        self.db = None
        self.is_mongo = False
        self._collections = {}
        self._connect()

    def _connect(self):
        if MONGODB_URI:
            try:
                self.client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
                self.client.server_info() # verify connection
                self.db = self.client[DB_NAME]
                self.is_mongo = True
                self._setup_indexes()
                logger.info(f"Connected to MongoDB Atlas: {DB_NAME}")
                return
            except Exception as e:
                logger.warning(f"MongoDB connection failed: {e}. Falling back to high-performance local memory database.")
        
        self.is_mongo = False
        logger.info("Using embedded High-Performance Memory Database with unique constraint support.")
        self._setup_local_collections()

    def _setup_indexes(self):
        try:
            self.db.teams.create_index([("team_id", ASCENDING)], unique=True)
            self.db.team_sessions.create_index([("team_id", ASCENDING)], unique=True)
            self.db.answers.create_index([("quiz_id", ASCENDING), ("question_id", ASCENDING), ("team_id", ASCENDING)], unique=True)
            self.db.results.create_index([("quiz_id", ASCENDING), ("team_id", ASCENDING)], unique=True)
            self.db.questions.create_index([("question_id", ASCENDING)], unique=True)
            self.db.quizzes.create_index([("quiz_id", ASCENDING)], unique=True)
        except Exception as e:
            logger.warning(f"Failed to create some MongoDB indexes: {e}")

    def _setup_local_collections(self):
        self._collections = {
            "teams": InMemoryCollection("teams", unique_keys=["team_id"]),
            "team_sessions": InMemoryCollection("team_sessions", unique_keys=["team_id"]),
            "quizzes": InMemoryCollection("quizzes", unique_keys=["quiz_id"]),
            "questions": InMemoryCollection("questions", unique_keys=["question_id"]),
            "quiz_sessions": InMemoryCollection("quiz_sessions", unique_keys=["quiz_id"]),
            "answers": InMemoryCollection("answers", unique_keys=[("quiz_id", "question_id", "team_id")]),
            "results": InMemoryCollection("results", unique_keys=[("quiz_id", "team_id")]),
            "audit_logs": InMemoryCollection("audit_logs"),
        }

    def __getattr__(self, name):
        if self.is_mongo:
            return self.db[name]
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name)
        return self._collections[name]

db = DatabaseProxy()
