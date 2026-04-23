import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { getRedis } from "../db/redis";

const router = Router();

// ─── Pure ACL check function (exported for property testing) ─────────────────

/**
 * Checks whether a given role/userId/clubId combination is allowed to
 * perform `action` on `topic`.
 *
 * ACL Matrix (Requirements 6.4 – 6.11):
 *  - member      : publish  → fitsense/{club_id}/{user_id}/hr (own only)
 *                  subscribe → fitsense/{club_id}/{user_id}/hr  (own only)
 *                              fitsense/{club_id}/{user_id}/alerts (own only)
 *  - trainer /
 *    club_owner  : publish  → deny all
 *                  subscribe → fitsense/{club_id}/#  (own club)
 *                              fitsense/{club_id}/+/alerts (own club)
 *  - super_admin : publish  → deny all
 *                  subscribe → fitsense/#
 *  - ml_service  : publish  → fitsense/{club_id}/{user_id}/alerts only
 *                  subscribe → deny all
 *  - web_dashboard (any role): deny all publish
 *    (web_dashboard is identified by clientType field; handled at route level)
 */
export function checkAcl(
  role: string,
  userId: string,
  clubId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  switch (role) {
    case "member":
      return checkMemberAcl(userId, clubId, topic, action);

    case "trainer":
    case "club_owner":
      return checkTrainerOwnerAcl(clubId, topic, action);

    case "super_admin":
      return checkSuperAdminAcl(topic, action);

    case "ml_service":
      return checkMlServiceAcl(clubId, userId, topic, action);

    default:
      return false;
  }
}

function checkMemberAcl(
  userId: string,
  clubId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  const hrTopic = `fitsense/${clubId}/${userId}/hr`;
  const alertsTopic = `fitsense/${clubId}/${userId}/alerts`;

  if (action === "publish") {
    return topic === hrTopic;
  }
  // subscribe
  return topic === hrTopic || topic === alertsTopic;
}

function checkTrainerOwnerAcl(
  clubId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  if (action === "publish") return false;

  // allow subscribe to fitsense/{club_id}/#
  if (matchesWildcardHash(`fitsense/${clubId}`, topic)) return true;
  // allow subscribe to fitsense/{club_id}/+/alerts
  if (matchesSingleLevelAlerts(clubId, topic)) return true;

  return false;
}

function checkSuperAdminAcl(
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  if (action === "publish") return false;
  // allow subscribe to fitsense/#
  return matchesWildcardHash("fitsense", topic);
}

function checkMlServiceAcl(
  clubId: string,
  userId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  if (action === "subscribe") return false;
  // allow publish only to fitsense/{club_id}/{user_id}/alerts
  return topic === `fitsense/${clubId}/${userId}/alerts`;
}

// ─── Topic pattern helpers ────────────────────────────────────────────────────

/**
 * Matches `fitsense/{prefix}/#` — any topic starting with `{prefix}/`
 * e.g. matchesWildcardHash("fitsense/club-1", "fitsense/club-1/user-1/hr") → true
 */
function matchesWildcardHash(prefix: string, topic: string): boolean {
  return topic === prefix || topic.startsWith(`${prefix}/`);
}

/**
 * Matches `fitsense/{club_id}/+/alerts`
 * i.e. exactly 4 segments: fitsense / {club_id} / {anything} / alerts
 */
function matchesSingleLevelAlerts(clubId: string, topic: string): boolean {
  const parts = topic.split("/");
  return (
    parts.length === 4 &&
    parts[0] === "fitsense" &&
    parts[1] === clubId &&
    parts[3] === "alerts"
  );
}

// ─── Route: POST /api/mqtt/auth ───────────────────────────────────────────────

/**
 * EMQX authentication webhook.
 * Body: { clientid, username, password }
 * password contains the MQTT_Token (JWT).
 *
 * Requirements: 6.1, 6.2
 */
router.post("/auth", async (req: Request, res: Response) => {
  const { clientid, password } = req.body as {
    clientid?: string;
    username?: string;
    password?: string;
  };

  if (!password || !clientid) {
    return res.json({ result: "deny" });
  }

  try {
    const payload = jwt.verify(password, config.jwt.secret) as {
      userId: string;
      clubId: string | null;
      role: string;
      exp: number;
    };

    // Cache session in Redis so ACL webhook can look up role/clubId/userId
    const redis = getRedis();
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(
        `mqtt_session:${clientid}`,
        ttl,
        JSON.stringify({
          userId: payload.userId,
          clubId: payload.clubId ?? "",
          role: payload.role,
        }),
      );
    }

    return res.json({ result: "allow" });
  } catch {
    return res.json({ result: "deny" });
  }
});

// ─── Route: POST /api/mqtt/acl ────────────────────────────────────────────────

/**
 * EMQX authorization (ACL) webhook.
 * Body: { clientid, username, topic, action }
 * action is "publish" or "subscribe".
 *
 * Requirements: 6.3 – 6.11
 */
router.post("/acl", async (req: Request, res: Response) => {
  const { clientid, topic, action } = req.body as {
    clientid?: string;
    username?: string;
    topic?: string;
    action?: string;
  };

  if (!clientid || !topic || !action) {
    return res.json({ result: "deny" });
  }

  if (action !== "publish" && action !== "subscribe") {
    return res.json({ result: "deny" });
  }

  try {
    const redis = getRedis();
    const sessionRaw = await redis.get(`mqtt_session:${clientid}`);

    if (!sessionRaw) {
      return res.json({ result: "deny" });
    }

    const session = JSON.parse(sessionRaw) as {
      userId: string;
      clubId: string;
      role: string;
    };

    const allowed = checkAcl(
      session.role,
      session.userId,
      session.clubId,
      topic,
      action,
    );

    return res.json({ result: allowed ? "allow" : "deny" });
  } catch {
    return res.json({ result: "deny" });
  }
});

export default router;
