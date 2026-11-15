"""
MediQueue — SQLite to PostgreSQL Migration Script
=================================================
Run this script ONCE after setting up your Supabase database to copy all
existing patient, user, doctor, appointment and queue data to PostgreSQL.

Usage:
    export DATABASE_URL="postgresql://..."   (your Supabase connection string)
    python migrate_to_postgres.py

Requirements: psycopg2-binary (already in requirements.txt)
"""

import os
import sqlite3
import sys

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("❌ psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

SQLITE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mediqueue.db")
PG_URL = os.environ.get("DATABASE_URL", "")

if not PG_URL:
    print("❌ DATABASE_URL environment variable not set.")
    print("   Set it to your Supabase PostgreSQL connection string and retry.")
    sys.exit(1)

if PG_URL.startswith("postgres://"):
    PG_URL = PG_URL.replace("postgres://", "postgresql://", 1)

print(f"📂 Reading from SQLite: {SQLITE_PATH}")
print(f"🐘 Writing to PostgreSQL: {PG_URL[:40]}...")

# ----------------------------------------------------------------
# Connect to both databases
# ----------------------------------------------------------------
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
sqlite_cur = sqlite_conn.cursor()

pg_conn = psycopg2.connect(PG_URL)
pg_cur = pg_conn.cursor()

# ----------------------------------------------------------------
# Helper: safe insert with conflict skip
# ----------------------------------------------------------------
def migrate_table(table_name: str, columns: list[str], rows: list):
    if not rows:
        print(f"  ⏭️  {table_name}: 0 rows, skipping")
        return
    col_str = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    sql = (
        f"INSERT INTO {table_name} ({col_str}) VALUES %s "
        f"ON CONFLICT DO NOTHING"
    )
    data = [tuple(row[c] for c in columns) for row in rows]
    execute_values(pg_cur, sql, data)
    print(f"  ✅ {table_name}: {len(data)} rows migrated")


print("\n🔄 Starting migration...")

# --- 1. patients ---
sqlite_cur.execute("SELECT * FROM patients ORDER BY id")
rows = sqlite_cur.fetchall()
migrate_table("patients", ["id", "name", "age", "phone"], rows)

# --- 2. doctors ---
sqlite_cur.execute("SELECT * FROM doctors ORDER BY id")
rows = sqlite_cur.fetchall()
migrate_table(
    "doctors",
    ["id", "name", "department", "specialization", "room_number", "available"],
    rows,
)

# --- 3. users ---
sqlite_cur.execute("SELECT * FROM users ORDER BY id")
rows = sqlite_cur.fetchall()
migrate_table(
    "users",
    ["id", "email", "hashed_password", "role", "patient_id", "created_at"],
    rows,
)

# --- 4. queue_entries ---
sqlite_cur.execute("SELECT * FROM queue_entries ORDER BY id")
rows = sqlite_cur.fetchall()
migrate_table(
    "queue_entries",
    ["id", "token_number", "department", "status", "created_at",
     "served_at", "completed_at", "patient_id", "doctor_id"],
    rows,
)

# --- 5. appointments ---
sqlite_cur.execute("SELECT * FROM appointments ORDER BY id")
rows = sqlite_cur.fetchall()
migrate_table(
    "appointments",
    ["id", "patient_id", "doctor_id", "department", "appointment_date",
     "time_slot", "reason", "status", "created_at"],
    rows,
)

# ----------------------------------------------------------------
# Reset PostgreSQL sequences so new IDs don't collide
# ----------------------------------------------------------------
print("\n🔁 Resetting PostgreSQL ID sequences...")
for table, col in [
    ("patients", "id"),
    ("doctors", "id"),
    ("users", "id"),
    ("queue_entries", "id"),
    ("appointments", "id"),
]:
    pg_cur.execute(
        f"SELECT setval(pg_get_serial_sequence('{table}', '{col}'), "
        f"COALESCE(MAX({col}), 1)) FROM {table}"
    )
    print(f"  ✅ {table} sequence reset")

pg_conn.commit()
pg_cur.close()
pg_conn.close()
sqlite_conn.close()

print("\n🎉 Migration complete! All records are now in PostgreSQL.")
print("   You can now deploy to Render safely.")
