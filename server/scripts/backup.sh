#!/bin/bash
# Database backup script for Occupy Mars
# Uses DATABASE_URL env var to connect to PostgreSQL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"
KEEP_COUNT=7

# Ensure DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[BACKUP] ERROR: DATABASE_URL environment variable is not set."
  exit 1
fi

# Create backups directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Run pg_dump and compress
echo "[BACKUP] Starting backup: $BACKUP_FILE"
if pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/$BACKUP_FILE"; then
  echo "[BACKUP] SUCCESS: $BACKUP_DIR/$BACKUP_FILE"
else
  echo "[BACKUP] FAILED: pg_dump encountered an error."
  rm -f "$BACKUP_DIR/$BACKUP_FILE"
  exit 1
fi

# Remove old backups, keep only the latest $KEEP_COUNT
BACKUP_COUNT=$(ls -1t "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$KEEP_COUNT" ]; then
  ls -1t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +$((KEEP_COUNT + 1)) | while read -r old_backup; do
    echo "[BACKUP] Deleting old backup: $(basename "$old_backup")"
    rm -f "$old_backup"
  done
fi

echo "[BACKUP] Done. $BACKUP_COUNT total backup(s), keeping last $KEEP_COUNT."
