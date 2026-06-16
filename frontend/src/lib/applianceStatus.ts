const LOCK_BUSY_PATTERNS = [
  "awaiting history lock",
  "waiting for history lock",
  "onedrive_sync_history.lock",
  "onedrive_lightweight_state.sqlite3",
] as const;

export const APPLIANCE_BUSY_MESSAGE = "Appliance arbeider. Synk kan startes når aktiv jobb er ferdig.";
export const APPLIANCE_BUSY_LABEL = "Appliance arbeider";
export const SYNC_LOCK_HELP_TEXT = "Synk er midlertidig deaktivert fordi Appliance er opptatt med analyse eller OneDrive-state.";
export const SYNC_BUSY_INLINE_MESSAGE = APPLIANCE_BUSY_MESSAGE;
export const SYNC_RUNNING_LABEL = "OneDrive synkroniserer";
export const ANALYSIS_RUNNING_LABEL = "Analyse pågår";
export const SYNC_FAILED_LABEL = "Forrige sync feilet";
export const APPLIANCE_CLEAR_MESSAGE = "Klar";
export const SYNC_STALE_LOCK_WARNING = "Tidligere sync stoppet på lock. Prøv igjen.";
export const ANALYSIS_STALE_LOCK_WARNING = "Tidligere analyse stoppet på lock. Prøv igjen.";

function normalize(value: string | null | undefined): string {
  return value?.toLowerCase() ?? "";
}

export function isLockBusyError(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return LOCK_BUSY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function getVisibleSyncErrorMessage(lastError: string | null | undefined): string | null {
  if (!lastError) {
    return null;
  }
  return isLockBusyError(lastError) ? SYNC_STALE_LOCK_WARNING : `Siste sync-feil: ${lastError}`;
}

export function getVisibleAnalysisErrorMessage(lastError: string | null | undefined): string | null {
  if (!lastError) {
    return null;
  }
  return isLockBusyError(lastError) ? ANALYSIS_STALE_LOCK_WARNING : `Siste analysefeil: ${lastError}`;
}
