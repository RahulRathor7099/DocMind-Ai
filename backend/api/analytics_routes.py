"""
api/analytics_routes.py
------------------------
Aggregated analytics endpoints for the DocMind AI dashboard.

Endpoint
--------
GET /analytics – Return workspace statistics for the current user.
"""

import datetime
import os
from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from auth.auth_handler import get_current_user
from models.database import (
    ChatHistory,
    Document,
    DocumentClassification,
    EmbeddingsMetadata,
    User,
    get_db,
)
from models.schemas import (
    AnalyticsResponse,
    DocumentTypeCount,
    RecentActivity,
    DocumentResponse,
    ClassificationResponse,
    ChatSessionResponse,
)
from utils.file_utils import format_file_size
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(tags=["Analytics"])


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Get workspace analytics for the current user",
)
@router.get(
    "/analytics/dashboard",
    response_model=AnalyticsResponse,
    summary="Get workspace analytics for the current user (dashboard)",
)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    """
    Return aggregated statistics for the authenticated user's workspace.
    """
    user_id = current_user.id

    if hasattr(db, "is_mongo"):
        # ── MongoDB Analytics ──────────────────────────────────────────────
        total_docs = db.db.documents.count_documents({"user_id": user_id})
        total_indexed = db.db.documents.count_documents({"user_id": user_id, "status": "indexed"})
        total_failed = db.db.documents.count_documents({"user_id": user_id, "status": "failed"})
        
        # total_embeddings (sum total_chunks for user's documents)
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$lookup": {
                "from": "embeddings_metadata",
                "localField": "id",
                "foreignField": "document_id",
                "as": "embed"
            }},
            {"$unwind": "$embed"},
            {"$group": {"_id": None, "total": {"$sum": "$embed.total_chunks"}}}
        ]
        res = list(db.db.documents.aggregate(pipeline))
        total_embeddings = res[0]["total"] if res else 0
        
        total_chat_messages = db.db.chat_history.count_documents({"user_id": user_id})
        total_chat_sessions = len(db.db.chat_history.distinct("session_id", {"user_id": user_id}))
        
        completed_or_failed = total_indexed + total_failed
        success_rate = (
            round((total_indexed / completed_or_failed) * 100, 1)
            if completed_or_failed > 0
            else 0.0
        )
        
        # Documents by classification type
        pipeline_type = [
            {"$match": {"user_id": user_id}},
            {"$lookup": {
                "from": "document_classifications",
                "localField": "id",
                "foreignField": "document_id",
                "as": "classif"
            }},
            {"$unwind": "$classif"},
            {"$group": {
                "_id": "$classif.document_type",
                "count": {"$sum": 1}
            }},
            {"$sort": {"count": -1}}
        ]
        type_rows = list(db.db.documents.aggregate(pipeline_type))
        docs_by_type = [
            DocumentTypeCount(
                document_type=row["_id"] or "Unknown",
                count=row["count"]
            )
            for row in type_rows
        ]
        
        # Count unclassified
        pipeline_unclass = [
            {"$match": {"user_id": user_id, "status": "indexed"}},
            {"$lookup": {
                "from": "document_classifications",
                "localField": "id",
                "foreignField": "document_id",
                "as": "classif"
            }},
            {"$match": {"classif": {"$size": 0}}},
            {"$count": "count"}
        ]
        unclass_res = list(db.db.documents.aggregate(pipeline_unclass))
        unclassified_count = unclass_res[0]["count"] if unclass_res else 0
        if unclassified_count > 0:
            docs_by_type.append(
                DocumentTypeCount(document_type="Unclassified", count=unclassified_count)
            )
            
        # Recent activity (last 7 days)
        today = datetime.date.today()
        seven_days_ago = today - datetime.timedelta(days=6)
        start_datetime = datetime.datetime.combine(seven_days_ago, datetime.time.min)
        
        # Uploads per day
        pipeline_uploads = [
            {"$match": {"user_id": user_id, "upload_time": {"$gte": start_datetime}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$upload_time"}},
                "count": {"$sum": 1}
            }}
        ]
        upload_rows = list(db.db.documents.aggregate(pipeline_uploads))
        uploads_by_day = {row["_id"]: row["count"] for row in upload_rows if row["_id"]}
        
        # Chat queries per day
        pipeline_chats = [
            {"$match": {"user_id": user_id, "role": "user", "created_at": {"$gte": start_datetime}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1}
            }}
        ]
        chat_rows = list(db.db.chat_history.aggregate(pipeline_chats))
        queries_by_day = {row["_id"]: row["count"] for row in chat_rows if row["_id"]}
        
        recent_activity = []
        for i in range(7):
            day = today - datetime.timedelta(days=6 - i)
            day_str = str(day)
            recent_activity.append(
                RecentActivity(
                    date=day_str,
                    uploads=uploads_by_day.get(day_str, 0),
                    queries=queries_by_day.get(day_str, 0),
                )
            )
            
        # Storage used
        pipeline_storage = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "total": {"$sum": "$file_size"}}}
        ]
        storage_res = list(db.db.documents.aggregate(pipeline_storage))
        storage_bytes = storage_res[0]["total"] if storage_res else 0
        
        # Recent documents (last 5)
        recent_docs_cursor = db.db.documents.find({"user_id": user_id}).sort([("upload_time", -1)]).limit(5)
        recent_documents = []
        for doc in recent_docs_cursor:
            doc_obj = Document()
            for k, v in doc.items():
                if k == "_id":
                    continue
                setattr(doc_obj, k, v)
                
            doc_res = DocumentResponse.model_validate(doc_obj)
            classif_doc = db.db.document_classifications.find_one({"document_id": doc_obj.id})
            if classif_doc:
                classif_obj = DocumentClassification()
                for k, v in classif_doc.items():
                    if k == "_id":
                        continue
                    setattr(classif_obj, k, v)
                doc_res.classification = ClassificationResponse.model_validate(classif_obj)
            recent_documents.append(doc_res)
            
        # Recent chat sessions (last 6)
        pipeline_sessions = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$session_id",
                "last_active": {"$max": "$created_at"}
            }},
            {"$sort": {"last_active": -1}},
            {"$limit": 6}
        ]
        session_ids = list(db.db.chat_history.aggregate(pipeline_sessions))
        recent_sessions = []
        for row in session_ids:
            s_id = row["_id"]
            first_msg_doc = db.db.chat_history.find_one(
                {"session_id": s_id, "user_id": user_id},
                sort=[("created_at", 1)]
            )
            msg_count = db.db.chat_history.count_documents({"session_id": s_id, "user_id": user_id})
            last_msg_doc = db.db.chat_history.find_one(
                {"session_id": s_id, "user_id": user_id},
                sort=[("created_at", -1)]
            )
            
            recent_sessions.append(
                ChatSessionResponse(
                    session_id=s_id,
                    session_name=first_msg_doc.get("session_name") if (first_msg_doc and first_msg_doc.get("session_name")) else "New Chat",
                    last_message=last_msg_doc.get("message") if last_msg_doc else "",
                    message_count=msg_count,
                    created_at=row["last_active"]
                )
            )
            
        return AnalyticsResponse(
            total_documents=total_docs,
            total_processed=total_indexed,
            total_failed=total_failed,
            total_embeddings=int(total_embeddings),
            total_chat_sessions=total_chat_sessions,
            total_chat_messages=total_chat_messages,
            processing_success_rate=success_rate,
            documents_by_type=docs_by_type,
            recent_activity=recent_activity,
            storage_used_bytes=storage_bytes,
            storage_used_human=format_file_size(storage_bytes),
            recent_documents=recent_documents,
            recent_chat_sessions=recent_sessions,
        )

    else:
        # ── Basic document counts ──────────────────────────────────────────────
        total_docs: int = (
            db.query(func.count(Document.id))
            .filter(Document.user_id == user_id)
            .scalar()
            or 0
        )

        total_indexed: int = (
            db.query(func.count(Document.id))
            .filter(Document.user_id == user_id, Document.status == "indexed")
            .scalar()
            or 0
        )

        total_failed: int = (
            db.query(func.count(Document.id))
            .filter(Document.user_id == user_id, Document.status == "failed")
            .scalar()
            or 0
        )

        # ── Embedding chunks ───────────────────────────────────────────────────
        total_embeddings: int = (
            db.query(func.sum(EmbeddingsMetadata.total_chunks))
            .join(Document, EmbeddingsMetadata.document_id == Document.id)
            .filter(Document.user_id == user_id)
            .scalar()
            or 0
        )

        # ── Chat statistics ────────────────────────────────────────────────────
        total_chat_messages: int = (
            db.query(func.count(ChatHistory.id))
            .filter(ChatHistory.user_id == user_id)
            .scalar()
            or 0
        )

        total_chat_sessions: int = (
            db.query(func.count(func.distinct(ChatHistory.session_id)))
            .filter(ChatHistory.user_id == user_id)
            .scalar()
            or 0
        )

        # ── Processing success rate ────────────────────────────────────────────
        completed_or_failed = total_indexed + total_failed
        success_rate: float = (
            round((total_indexed / completed_or_failed) * 100, 1)
            if completed_or_failed > 0
            else 0.0
        )

        # ── Documents by classification type ──────────────────────────────────
        type_rows = (
            db.query(
                DocumentClassification.document_type,
                func.count(DocumentClassification.id).label("count"),
            )
            .join(Document, DocumentClassification.document_id == Document.id)
            .filter(Document.user_id == user_id)
            .group_by(DocumentClassification.document_type)
            .order_by(func.count(DocumentClassification.id).desc())
            .all()
        )

        # Count unclassified
        unclassified_count: int = (
            db.query(func.count(Document.id))
            .outerjoin(
                DocumentClassification,
                Document.id == DocumentClassification.document_id,
            )
            .filter(
                Document.user_id == user_id,
                DocumentClassification.id.is_(None),
            )
            .scalar()
            or 0
        )

        docs_by_type: List[DocumentTypeCount] = [
            DocumentTypeCount(
                document_type=row.document_type or "Unknown",
                count=row.count,
            )
            for row in type_rows
        ]
        if unclassified_count > 0:
            docs_by_type.append(
                DocumentTypeCount(document_type="Unclassified", count=unclassified_count)
            )

        # ── Recent activity (last 7 days) ──────────────────────────────────────
        today = datetime.date.today()
        seven_days_ago = today - datetime.timedelta(days=6)

        # Uploads per day
        upload_rows = (
            db.query(
                func.date(Document.upload_time).label("day"),
                func.count(Document.id).label("count"),
            )
            .filter(
                Document.user_id == user_id,
                Document.upload_time >= datetime.datetime.combine(
                    seven_days_ago, datetime.time.min
                ),
            )
            .group_by(func.date(Document.upload_time))
            .all()
        )
        uploads_by_day: dict = {str(row.day): row.count for row in upload_rows}

        # Chat queries per day
        chat_rows = (
            db.query(
                func.date(ChatHistory.created_at).label("day"),
                func.count(ChatHistory.id).label("count"),
            )
            .filter(
                ChatHistory.user_id == user_id,
                ChatHistory.role == "user",
                ChatHistory.created_at >= datetime.datetime.combine(
                    seven_days_ago, datetime.time.min
                ),
            )
            .group_by(func.date(ChatHistory.created_at))
            .all()
        )
        queries_by_day: dict = {str(row.day): row.count for row in chat_rows}

        recent_activity: List[RecentActivity] = []
        for i in range(7):
            day = today - datetime.timedelta(days=6 - i)
            day_str = str(day)
            recent_activity.append(
                RecentActivity(
                    date=day_str,
                    uploads=uploads_by_day.get(day_str, 0),
                    queries=queries_by_day.get(day_str, 0),
                )
            )

        # ── Storage used ───────────────────────────────────────────────────────
        storage_result = (
            db.query(func.sum(Document.file_size))
            .filter(Document.user_id == user_id)
            .scalar()
        )
        storage_bytes: int = int(storage_result) if storage_result else 0

        # ── Recent documents (last 5) ───────────────────────────────────────────
        recent_docs_query = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.upload_time.desc())
            .limit(5)
            .all()
        )
        recent_documents = []
        for doc in recent_docs_query:
            doc_res = DocumentResponse.model_validate(doc)
            classif = (
                db.query(DocumentClassification)
                .filter(DocumentClassification.document_id == doc.id)
                .first()
            )
            if classif:
                doc_res.classification = ClassificationResponse.model_validate(classif)
            recent_documents.append(doc_res)

        # ── Recent chat sessions (last 6) ─────────────────────────────────────────
        session_ids = (
            db.query(
                ChatHistory.session_id,
                func.max(ChatHistory.created_at).label("last_active")
            )
            .filter(ChatHistory.user_id == user_id)
            .group_by(ChatHistory.session_id)
            .order_by(desc("last_active"))
            .limit(6)
            .all()
        )

        recent_sessions = []
        for row in session_ids:
            s_id = row.session_id
            first_msg_row = (
                db.query(ChatHistory.session_name, ChatHistory.message)
                .filter(ChatHistory.session_id == s_id, ChatHistory.user_id == user_id)
                .order_by(ChatHistory.created_at.asc())
                .first()
            )
            msg_count = (
                db.query(func.count(ChatHistory.id))
                .filter(ChatHistory.session_id == s_id, ChatHistory.user_id == user_id)
                .scalar()
                or 0
            )
            last_msg_row = (
                db.query(ChatHistory.message)
                .filter(ChatHistory.session_id == s_id, ChatHistory.user_id == user_id)
                .order_by(ChatHistory.created_at.desc())
                .first()
            )
            
            recent_sessions.append(
                ChatSessionResponse(
                    session_id=s_id,
                    session_name=first_msg_row[0] if (first_msg_row and first_msg_row[0]) else "New Chat",
                    last_message=last_msg_row[0] if last_msg_row else "",
                    message_count=msg_count,
                    created_at=row.last_active
                )
            )

        return AnalyticsResponse(
            total_documents=total_docs,
            total_processed=total_indexed,
            total_failed=total_failed,
            total_embeddings=int(total_embeddings),
            total_chat_sessions=total_chat_sessions,
            total_chat_messages=total_chat_messages,
            processing_success_rate=success_rate,
            documents_by_type=docs_by_type,
            recent_activity=recent_activity,
            storage_used_bytes=storage_bytes,
            storage_used_human=format_file_size(storage_bytes),
            recent_documents=recent_documents,
            recent_chat_sessions=recent_sessions,
        )
