from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="patient")  # "patient" or "staff"
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    patient = relationship("Patient", back_populates="user")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    department = Column(String(100), nullable=False)
    specialization = Column(String(150), nullable=True)
    room_number = Column(String(20), nullable=True)
    available = Column(Integer, default=1, nullable=False)

    appointments = relationship("Appointment", back_populates="doctor")
    queue_entries = relationship("QueueEntry", back_populates="doctor")


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    department = Column(String(100), nullable=False)
    appointment_date = Column(String(20), nullable=False)  # YYYY-MM-DD
    time_slot = Column(String(20), nullable=False)         # e.g. "10:00 AM"
    reason = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, default="CONFIRMED")  # CONFIRMED, COMPLETED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=False)
    phone = Column(String(20), nullable=False)

    queue_entries = relationship(
        "QueueEntry",
        back_populates="patient",
        cascade="all, delete-orphan",
    )

    user = relationship(
        "User",
        back_populates="patient",
        uselist=False,
    )

    appointments = relationship(
        "Appointment",
        back_populates="patient",
        cascade="all, delete-orphan",
    )


class QueueEntry(Base):
    __tablename__ = "queue_entries"

    id = Column(Integer, primary_key=True, index=True)
    token_number = Column(Integer, nullable=False)
    department = Column(String(100), nullable=False)
    status = Column(String(30), nullable=False, default="WAITING")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    served_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    patient_id = Column(
        Integer,
        ForeignKey("patients.id"),
        nullable=False,
    )

    doctor_id = Column(
        Integer,
        ForeignKey("doctors.id"),
        nullable=True,
    )

    patient = relationship(
        "Patient",
        back_populates="queue_entries",
    )

    doctor = relationship(
        "Doctor",
        back_populates="queue_entries",
    )
