const GUEST_TUTORIAL_SESSION_KEY = "clinicalhours_dashboard_tutorial_guest_session";

export type DashboardTutorialSource = "guest";

export function getGuestTutorialSessionId(): string | null {
  try {
    return localStorage.getItem(GUEST_TUTORIAL_SESSION_KEY);
  } catch {
    return null;
  }
}

export function markGuestTutorialPending(sessionId: string): void {
  try {
    localStorage.setItem(GUEST_TUTORIAL_SESSION_KEY, sessionId);
  } catch {
    // ignore
  }
}

export function clearGuestTutorialPending(): void {
  try {
    localStorage.removeItem(GUEST_TUTORIAL_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function shouldShowGuestTutorial(sessionId: string | null): boolean {
  return Boolean(sessionId && getGuestTutorialSessionId() === sessionId);
}

