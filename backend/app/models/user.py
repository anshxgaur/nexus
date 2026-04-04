"""
Nexus Workspace — All Database Models
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    String, Text, ForeignKey, DateTime, Enum as SAEnum,
    Boolean, Integer, Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ── Users ─────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["Message"]] = relationship(back_populates="user")
    meeting_participants: Mapped[list["MeetingParticipant"]] = relationship(back_populates="user")
    organized_events: Mapped[list["Event"]] = relationship(back_populates="organizer")
    employee: Mapped["Employee | None"] = relationship(back_populates="user", cascade="all, delete-orphan")


# ── Roles & Employees ──────────────────────────────────────────────────────────
class Role(Base):
    __tablename__ = "roles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    permissions: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    employees: Mapped[list["Employee"]] = relationship(back_populates="role")


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    role_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("roles.id", ondelete="SET NULL"))
    department: Mapped[str | None] = mapped_column(String(128))
    job_title: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped["User"] = relationship(back_populates="employee")
    role: Mapped["Role"] = relationship(back_populates="employees")
    performance_reviews: Mapped[list["PerformanceReview"]] = relationship(
        "PerformanceReview",
        foreign_keys="[PerformanceReview.employee_id]",
        back_populates="employee",
        cascade="all, delete-orphan"
    )
    assigned_tasks: Mapped[list["Task"]] = relationship(back_populates="assignee")


class PerformanceReview(Base):
    __tablename__ = "performance_reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    employee_id: Mapped[str] = mapped_column(String(36), ForeignKey("employees.id", ondelete="CASCADE"))
    reviewer_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    review_cycle: Mapped[str] = mapped_column(String(128))
    kpi_score: Mapped[float | None] = mapped_column(Float)
    comments: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_id], back_populates="performance_reviews")
    reviewer: Mapped["Employee"] = relationship("Employee", foreign_keys=[reviewer_id])


# ── Channels ──────────────────────────────────────────────────────────────────
class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    messages: Mapped[list["Message"]] = relationship(back_populates="channel", cascade="all, delete-orphan")


# ── Messages ──────────────────────────────────────────────────────────────────
class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    channel_id: Mapped[str] = mapped_column(String(36), ForeignKey("channels.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    thread_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    channel: Mapped["Channel"] = relationship(back_populates="messages")
    user: Mapped["User"] = relationship(back_populates="messages")


# ── Meetings ──────────────────────────────────────────────────────────────────
class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    room_name: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(SAEnum("scheduled", "active", "ended", name="meeting_status"), default="scheduled")
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    participants: Mapped[list["MeetingParticipant"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    transcripts: Mapped[list["Transcript"]] = relationship(back_populates="meeting", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="meeting")
    decisions: Mapped[list["Decision"]] = relationship(back_populates="meeting")
    schedule: Mapped["MeetingSchedule | None"] = relationship(back_populates="meeting", uselist=False, cascade="all, delete-orphan")


class MeetingParticipant(Base):
    __tablename__ = "meeting_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped["Meeting"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(back_populates="meeting_participants")


# ── Transcripts ───────────────────────────────────────────────────────────────
class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    speaker: Mapped[str | None] = mapped_column(String(128))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[float | None] = mapped_column(Float)
    end_time: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped["Meeting"] = relationship(back_populates="transcripts")


# ── Tasks ─────────────────────────────────────────────────────────────────────
class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(36), ForeignKey("employees.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(SAEnum("open", "in_progress", "done", name="task_status"), default="open")
    priority: Mapped[str] = mapped_column(SAEnum("low", "medium", "high", name="task_priority"), default="medium")
    source: Mapped[str] = mapped_column(SAEnum("meeting", "chat", "manual", name="task_source"), default="meeting")
    meeting_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="SET NULL"))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped["Meeting | None"] = relationship(back_populates="tasks")
    assignee: Mapped["Employee | None"] = relationship(back_populates="assigned_tasks")


# ── Decisions ─────────────────────────────────────────────────────────────────
class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"))
    context: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped["Meeting"] = relationship(back_populates="decisions")


# ── Documents ─────────────────────────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(SAEnum("upload", "meeting", "chat", name="doc_source"), default="upload")
    uploaded_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


# ── Events & Schedules ────────────────────────────────────────────────────────
class Event(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    organizer_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organizer: Mapped["User"] = relationship(back_populates="organized_events")


class MeetingSchedule(Base):
    __tablename__ = "meeting_schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"))
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    recurrence_rule: Mapped[str | None] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    meeting: Mapped["Meeting"] = relationship(back_populates="schedule")
