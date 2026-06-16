# Sync Status Flow

This note documents how Nexus decides whether Appliance is busy and how the UI should treat sync state.

## Source Of Truth

- `GET /api/sync/status`
- `GET /api/analysis/status`

Both responses now expose:

- `running`
- `activity` (`sync`, `analysis`, `idle`)
- `lock_exists`
- `lock_stale`
- `process_alive`

## Busy Rules

- Sync is disabled when sync or analysis is actually running.
- A live history lock also counts as busy, even if the backend lost its in-memory process handle.
- Stale lock errors do not keep the UI disabled.

## Stale Lock Handling

- Nexus checks the history lock under the appliance runtime directory.
- If the lock file exists but the recorded PID is no longer alive, Nexus removes the stale lock and logs a warning.
- The appliance runner also removes stale locks when it acquires the history lock.

## UI Rules

- Show `OneDrive synkroniserer` when sync is active.
- Show `Analyse pågår` when analysis is active.
- Show `Klar` when neither job is active.
- Show `Forrige sync feilet` only for a real sync failure, not for a stale lock message.
- Never surface internal lock paths or SQLite filenames in the dashboard.
