"""
DocMind AI - Database Models and Setup
SQLAlchemy ORM models for all 6 database tables
"""

import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String,
    DateTime, Float, Text, ForeignKey, Boolean, JSON
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

from utils.config import get_settings

settings = get_settings()

# --- Database Setup (SQL or MongoDB) ---
engine = None
SessionLocal = None
Base = declarative_base()

mongo_client = None
mongo_db = None

if settings.DATABASE_URL.startswith("mongodb"):
    import pymongo
    import urllib.parse
    try:
        mongo_client = pymongo.MongoClient(settings.DATABASE_URL, serverSelectionTimeoutMS=5000)
        parsed_uri = urllib.parse.urlparse(settings.DATABASE_URL)
        db_name = parsed_uri.path.strip("/") or "docmind"
        mongo_db = mongo_client[db_name]
        print(f"[MongoDB] Connected to database: {db_name}")
    except Exception as e:
        print(f"[MongoDB] Failed to connect: {e}")
        
    def MongoSessionCallable():
        return MongoSession(mongo_db)
    SessionLocal = MongoSessionCallable
else:
    # Create engine for SQLAlchemy
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
        echo=False,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ─── MongoDB Session & Query Emulation Layer ───────────────────────────────────

def get_next_sequence_value(db, sequence_name):
    import pymongo
    result = db.counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=pymongo.ReturnDocument.AFTER
    )
    return result["sequence_value"]


class MongoQuery:
    def __init__(self, session, arg):
        self.session = session
        self.db = session.db
        self.query_dict = {}
        self._sort = []
        self._skip = 0
        self._limit = None
        self.project_field = None
        
        if hasattr(arg, "class_") and hasattr(arg, "key"):
            self.model_cls = arg.class_
            self.collection_name = arg.class_.__tablename__
            self.project_field = arg.key
        elif hasattr(arg, "__table__"):
            self.model_cls = arg
            self.collection_name = arg.__tablename__
        else:
            self.model_cls = arg
            self.collection_name = getattr(arg, "__tablename__", str(arg))

    def filter(self, *expressions):
        for expr in expressions:
            parsed = self._parse_expr(expr)
            if parsed:
                for k, v in parsed.items():
                    if k in self.query_dict:
                        if isinstance(self.query_dict[k], dict) and isinstance(v, dict):
                            self.query_dict[k].update(v)
                        else:
                            self.query_dict[k] = v
                    else:
                        self.query_dict[k] = v
        return self
        
    def _parse_expr(self, expr):
        from sqlalchemy.sql.elements import BinaryExpression
        from sqlalchemy.sql.operators import eq, ne, lt, le, gt, ge, in_op, is_

        # BooleanClauseList (and_, or_, etc.)
        clauses = getattr(expr, "clauses", None)
        operator = getattr(expr, "operator", None)
        if clauses is not None:
            op_name = getattr(operator, "__name__", "")
            if op_name == "and_":
                combined = {}
                for c in clauses:
                    parsed = self._parse_expr(c)
                    if parsed:
                        for k, v in parsed.items():
                            if k in combined:
                                if isinstance(combined[k], dict) and isinstance(v, dict):
                                    combined[k].update(v)
                                else:
                                    combined[k] = v
                            else:
                                combined[k] = v
                return combined
            elif op_name == "or_":
                or_list = []
                for c in clauses:
                    parsed = self._parse_expr(c)
                    if parsed:
                        or_list.append(parsed)
                return {"$or": or_list} if or_list else {}
                
        left = getattr(expr, "left", None)
        right = getattr(expr, "right", None)
        op = getattr(expr, "operator", None)
        
        if left is None or op is None:
            return {}
            
        field_name = getattr(left, "key", None) or getattr(left, "name", None)
        if not field_name:
            return {}
            
        value = None
        if type(right).__name__ == "Null":
            value = None
        elif hasattr(right, "value"):
            value = right.value
        elif hasattr(right, "element") and hasattr(right.element, "value"):
            value = right.element.value
        else:
            value = getattr(right, "value", right)
            
        op_name = getattr(op, "__name__", str(op))
        
        if op_name in ("eq", "operator.eq"):
            return {field_name: value}
        elif op_name in ("ne", "operator.ne"):
            return {field_name: {"$ne": value}}
        elif op_name in ("lt", "operator.lt"):
            return {field_name: {"$lt": value}}
        elif op_name in ("le", "operator.le"):
            return {field_name: {"$lte": value}}
        elif op_name in ("gt", "operator.gt"):
            return {field_name: {"$gt": value}}
        elif op_name in ("ge", "operator.ge"):
            return {field_name: {"$gte": value}}
        elif op_name in ("in_op", "in"):
            return {field_name: {"$in": list(value) if isinstance(value, (list, tuple, set)) else value}}
        elif op_name == "is_":
            return {field_name: value}
        elif op_name == "is_not":
            return {field_name: {"$ne": value}}
            
        return {field_name: value}

    def order_by(self, *expressions):
        from sqlalchemy.sql.operators import desc_op, asc_op
        for expr in expressions:
            element = getattr(expr, "element", None)
            modifier = getattr(expr, "modifier", None)
            
            if element is not None and modifier == desc_op:
                field_name = getattr(element, "key", None) or getattr(element, "name", None)
                self._sort.append((field_name, -1))
            elif element is not None and modifier == asc_op:
                field_name = getattr(element, "key", None) or getattr(element, "name", None)
                self._sort.append((field_name, 1))
            else:
                field_name = getattr(expr, "key", None) or getattr(expr, "name", None)
                if field_name:
                    self._sort.append((field_name, 1))
        return self

    def offset(self, val):
        self._skip = val
        return self

    def limit(self, val):
        self._limit = val
        return self

    def count(self):
        return self.db[self.collection_name].count_documents(self.query_dict)

    def scalar(self):
        doc = self.db[self.collection_name].find_one(self.query_dict)
        if doc is None:
            return None
        if self.project_field:
            return doc.get(self.project_field)
        return None

    def first(self):
        cursor = self.db[self.collection_name].find(self.query_dict)
        if self._sort:
            cursor = cursor.sort(self._sort)
        try:
            doc = next(cursor)
        except StopIteration:
            doc = None
        if doc:
            return self._to_model(doc)
        return None

    def all(self):
        projection = None
        if self.project_field:
            projection = {self.project_field: 1, "_id": 0}
            
        cursor = self.db[self.collection_name].find(self.query_dict, projection)
        if self._sort:
            cursor = cursor.sort(self._sort)
        if self._skip:
            cursor = cursor.skip(self._skip)
        if self._limit:
            cursor = cursor.limit(self._limit)
            
        results = []
        for doc in cursor:
            if self.project_field:
                results.append((doc.get(self.project_field),))
            else:
                results.append(self._to_model(doc))
        return results

    def delete(self):
        result = self.db[self.collection_name].delete_many(self.query_dict)
        return result.deleted_count

    def join(self, *args, **kwargs):
        return self

    def outerjoin(self, *args, **kwargs):
        return self

    def _to_model(self, doc):
        obj = self.model_cls()
        for k, v in doc.items():
            if k == "_id":
                continue
            setattr(obj, k, v)
        return obj


class MongoSession:
    is_mongo = True
    
    def __init__(self, db):
        self.db = db
        self.to_add = []
        self.to_delete = []

    def query(self, *args):
        if not args:
            raise ValueError("query() requires at least one argument")
        return MongoQuery(self, args[0])

    def add(self, obj):
        self.to_add.append(obj)

    def delete(self, obj):
        self.to_delete.append(obj)

    def commit(self):
        for obj in self.to_add:
            collection_name = obj.__tablename__
            columns = [c.key for c in obj.__table__.columns]
            doc = {}
            for col in columns:
                if hasattr(obj, col):
                    doc[col] = getattr(obj, col)
            
            if doc.get("id") is None:
                new_id = get_next_sequence_value(self.db, collection_name)
                doc["id"] = new_id
                setattr(obj, "id", new_id)
                
            self.db[collection_name].update_one(
                {"id": doc["id"]},
                {"$set": doc},
                upsert=True
            )
        self.to_add.clear()

        for obj in self.to_delete:
            collection_name = obj.__tablename__
            self.db[collection_name].delete_one({"id": obj.id})
        self.to_delete.clear()

    def refresh(self, obj):
        collection_name = obj.__tablename__
        doc = self.db[collection_name].find_one({"id": obj.id})
        if doc:
            for k, v in doc.items():
                if k == "_id":
                    continue
                setattr(obj, k, v)

    def close(self):
        pass



# ─── Models ───────────────────────────────────────────────────────────────────

class User(Base):
    """User accounts table."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Relationships
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")


class PendingOTP(Base):
    """Pending OTP codes for user email verification."""
    __tablename__ = "pending_otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    otp = Column(String(10), nullable=False)
    expires_at = Column(DateTime, nullable=False)


class Document(Base):
    """Uploaded documents table."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)  # pdf, png, jpg, txt, docx
    file_size = Column(Integer, nullable=False)      # bytes
    total_pages = Column(Integer, default=0)
    status = Column(String(50), default="uploading")
    # Status values: uploading | parsing | ocr_processing | classifying | creating_embeddings | indexed | failed
    error_message = Column(Text, nullable=True)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

    # Relationships
    owner = relationship("User", back_populates="documents")
    parsed_pages = relationship("ParsedPage", back_populates="document", cascade="all, delete-orphan")
    classification = relationship("DocumentClassification", back_populates="document", uselist=False, cascade="all, delete-orphan")
    embeddings_metadata = relationship("EmbeddingsMetadata", back_populates="document", cascade="all, delete-orphan")


class ParsedPage(Base):
    """Parsed pages from documents."""
    __tablename__ = "parsed_pages"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    extracted_text = Column(Text, default="")
    page_image_path = Column(String(512), nullable=True)
    has_tables = Column(Boolean, default=False)
    tables_data = Column(JSON, nullable=True)   # JSON list of tables
    ocr_applied = Column(Boolean, default=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="parsed_pages")


class DocumentClassification(Base):
    """LLM classification results for documents."""
    __tablename__ = "document_classifications"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), unique=True, nullable=False)
    document_type = Column(String(100), nullable=True)    # Invoice, Report, Contract, etc.
    topic = Column(String(100), nullable=True)
    sensitivity_level = Column(String(50), nullable=True) # Public, Internal, Confidential, Restricted
    language = Column(String(50), nullable=True)
    domain = Column(String(100), nullable=True)           # Business, Legal, Medical, etc.
    summary = Column(Text, nullable=True)
    business_relevance = Column(String(50), nullable=True)
    confidence_score = Column(Float, nullable=True)
    raw_classification = Column(JSON, nullable=True)
    classified_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="classification")


class EmbeddingsMetadata(Base):
    """Metadata about stored embeddings for each document."""
    __tablename__ = "embeddings_metadata"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    total_chunks = Column(Integer, default=0)
    embedding_model = Column(String(100), nullable=True)
    index_path = Column(String(512), nullable=True)      # FAISS index file path
    chunks_path = Column(String(512), nullable=True)     # JSON chunks metadata path
    embedding_dim = Column(Integer, default=384)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    document = relationship("Document", back_populates="embeddings_metadata")


class ChatHistory(Base):
    """Chat conversations and messages."""
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(100), nullable=False, index=True)
    session_name = Column(String(255), default="New Chat")
    role = Column(String(20), nullable=False)  # user | assistant
    message = Column(Text, nullable=False)
    citations = Column(JSON, nullable=True)    # List of citation objects
    document_ids = Column(JSON, nullable=True) # Which documents were queried
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="chat_histories")
# ─── Database Utilities ───────────────────────────────────────────────────────

def create_tables():
    """Create all database tables or MongoDB collections/indices."""
    if settings.DATABASE_URL.startswith("mongodb"):
        if mongo_db is not None:
            try:
                mongo_db.users.create_index("email", unique=True)
                print("[MongoDB] Indices initialized")
            except Exception as e:
                print(f"[MongoDB] Failed to create index: {e}")
    else:
        Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency injection for database sessions (SQL or MongoDB)."""
    if settings.DATABASE_URL.startswith("mongodb"):
        db = MongoSession(mongo_db)
        try:
            yield db
        finally:
            db.close()
    else:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
