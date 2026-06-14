"""
rag/chat_memory.py
------------------
In-process multi-turn conversation memory for DocMind AI RAG sessions.

``ConversationMemory`` stores the last *max_history* exchange pairs
(user turn + assistant turn) in memory and can serialise them into a
plain-text context string suitable for insertion into an LLM prompt.

For persistence across server restarts, chat history is also written to
the database via ``models.database.ChatHistory``.  This module handles
only the *in-process* cache; DB persistence is handled by the chat routes.
"""

import threading
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class Turn:
    """A single conversation turn (one message from either party)."""

    role: str          # "user" or "assistant"
    content: str
    citations: Optional[List[Dict]] = field(default=None)


class ConversationMemory:
    """
    Sliding-window conversation memory for a single chat session.

    Maintains the last ``max_history`` *exchanges* (user + assistant pairs).
    Thread-safe via an internal lock.

    Parameters
    ----------
    session_id : str
        Unique identifier for this conversation session.
    max_history : int
        Maximum number of user/assistant *pairs* to retain.
        Defaults to 10 (20 total turns).
    """

    def __init__(self, session_id: str, max_history: int = 10) -> None:
        self.session_id = session_id
        self.max_history = max_history
        # Each deque entry is a Turn; we keep at most max_history*2 turns
        self._turns: Deque[Turn] = deque(maxlen=max_history * 2)
        self._lock = threading.Lock()
        logger.debug(
            f"ConversationMemory created: session={session_id}, "
            f"max_history={max_history}"
        )

    # ── Mutation ───────────────────────────────────────────────────────────

    def add_exchange(
        self,
        user_msg: str,
        ai_response: str,
        citations: Optional[List[Dict]] = None,
    ) -> None:
        """
        Append a user–assistant exchange to the history.

        Parameters
        ----------
        user_msg : str
            The user's question or message.
        ai_response : str
            The assistant's answer.
        citations : list[dict], optional
            Citations associated with the assistant's response.
        """
        with self._lock:
            self._turns.append(Turn(role="user", content=user_msg))
            self._turns.append(
                Turn(role="assistant", content=ai_response, citations=citations)
            )
        logger.debug(
            f"[{self.session_id}] Added exchange. "
            f"History length: {len(self._turns)} turns"
        )

    def clear(self) -> None:
        """Remove all turns from memory."""
        with self._lock:
            self._turns.clear()
        logger.debug(f"[{self.session_id}] Conversation memory cleared")

    # ── Retrieval ──────────────────────────────────────────────────────────

    def get_context_string(self) -> str:
        """
        Serialise the conversation history into a plain-text string for
        injection into an LLM prompt.

        Format
        ------
        ::

            Human: <user message>
            Assistant: <assistant response>
            Human: ...
            Assistant: ...

        Returns
        -------
        str
            Multi-line conversation history string.  Empty string if no
            history has been recorded yet.
        """
        with self._lock:
            turns = list(self._turns)

        if not turns:
            return ""

        lines: List[str] = []
        for turn in turns:
            prefix = "Human" if turn.role == "user" else "Assistant"
            lines.append(f"{prefix}: {turn.content}")

        return "\n".join(lines)

    def get_turns(self) -> List[Turn]:
        """Return a snapshot of the current turns list (thread-safe)."""
        with self._lock:
            return list(self._turns)

    @property
    def turn_count(self) -> int:
        """Total number of individual turns in memory."""
        return len(self._turns)

    @property
    def exchange_count(self) -> int:
        """Number of complete user/assistant exchanges in memory."""
        return len(self._turns) // 2

    def __repr__(self) -> str:
        return (
            f"ConversationMemory(session_id={self.session_id!r}, "
            f"turns={self.turn_count}, max_history={self.max_history})"
        )


# ── In-process session registry ────────────────────────────────────────────

class MemoryRegistry:
    """
    Global registry of active :class:`ConversationMemory` instances.

    Provides ``get_or_create`` semantics so that the same memory object
    is reused within a server process for the same session.

    Thread-safe.
    """

    def __init__(self) -> None:
        self._sessions: Dict[str, ConversationMemory] = {}
        self._lock = threading.Lock()

    def get_or_create(
        self, session_id: str, max_history: int = 10
    ) -> ConversationMemory:
        """
        Return an existing :class:`ConversationMemory` for *session_id*,
        or create a new one if it does not exist yet.

        Parameters
        ----------
        session_id : str
            Unique session identifier.
        max_history : int
            Passed to :class:`ConversationMemory` on creation only.

        Returns
        -------
        ConversationMemory
        """
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = ConversationMemory(
                    session_id=session_id, max_history=max_history
                )
            return self._sessions[session_id]

    def delete(self, session_id: str) -> None:
        """Remove a session from the registry and clear its memory."""
        with self._lock:
            memory = self._sessions.pop(session_id, None)
        if memory:
            memory.clear()
            logger.info(f"Session {session_id} removed from memory registry")

    def list_sessions(self) -> List[str]:
        """Return a list of all active session IDs."""
        with self._lock:
            return list(self._sessions.keys())

    def __len__(self) -> int:
        return len(self._sessions)


# Singleton registry used throughout the application
memory_registry = MemoryRegistry()
