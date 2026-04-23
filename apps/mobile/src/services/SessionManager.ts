import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = process.env.API_URL ?? "https://yourdomain.com/api";

/**
 * Manages workout sessions — start/end via API, persists session_id in AsyncStorage.
 * Requirements: 10.1, 10.3
 */
export class SessionManager {
  private clubId: string;
  private userId: string;

  constructor(clubId: string, userId: string) {
    this.clubId = clubId;
    this.userId = userId;
  }

  /**
   * Start a new session. Returns session_id.
   * Throws if a session is already active (HTTP 409).
   */
  async startSession(): Promise<string> {
    const jwt = await AsyncStorage.getItem("jwt");
    if (!jwt) throw new Error("Not authenticated");

    const res = await fetch(`${API_URL}/sessions/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ userId: this.userId, clubId: this.clubId }),
    });

    if (res.status === 409) {
      const body = await res.json();
      const existingSessionId: string = body.sessionId;
      await AsyncStorage.setItem("sessionId", existingSessionId);
      return existingSessionId;
    }

    if (!res.ok) {
      throw new Error(`Failed to start session: ${res.status}`);
    }

    const body = await res.json();
    const sessionId: string = body.sessionId;
    await AsyncStorage.setItem("sessionId", sessionId);
    return sessionId;
  }

  /**
   * End the current session.
   */
  async endSession(): Promise<void> {
    const jwt = await AsyncStorage.getItem("jwt");
    const sessionId = await AsyncStorage.getItem("sessionId");
    if (!jwt || !sessionId) return;

    const res = await fetch(`${API_URL}/sessions/end`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      console.warn("[SessionManager] endSession failed:", res.status);
    }

    await AsyncStorage.removeItem("sessionId");
  }

  /** Returns the current session_id from storage, or null if none */
  async getCurrentSessionId(): Promise<string | null> {
    return AsyncStorage.getItem("sessionId");
  }
}
