import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { getRedis } from "../db/redis";

const router = Router();

// ─── Pure ACL check function (exported for property testing) ─────────────────

/**
 * Checks whether a given role/userId/companyId combination is allowed to
 * perform `action` on `topic`.
 *
 * ACL Matrix (Requirements 6.4 – 6.11):
 *  - member      : publish  → fitsense/{company_id}/{user_id}/hr (own only)
 *                  subscribe → fitsense/{company_id}/{user_id}/hr  (own only)
 *                              fitsense/{company_id}/{user_id}/alerts (own only)
 *  - trainer /
 *    club_owner  : publish  → deny all
 *                  subscribe → fitsense/{company_id}/#  (own club)
 *                              fitsense/{company_id}/+/alerts (own club)
 *  - super_admin : publish  → deny all
 *                  subscribe → fitsense/#
 *  - ml_service  : publish  → fitsense/{company_id}/{user_id}/alerts only
 *                  subscribe → deny all
 *  - web_dashboard (any role): deny all publish
 *    (web_dashboard is identified by clientType field; handled at route level)
 */
export function checkAcl(
  role: string,
  userId: string,
  companyId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  switch (role) {
    case "member":
      return checkMemberAcl(userId, companyId, topic, action);

    case "trainer":
    case "club_owner":
      return checkTrainerOwnerAcl(companyId, topic, action);

    case "super_admin":
      return checkSuperAdminAcl(topic, action);

    case "ml_service":
      return checkMlServiceAcl(companyId, userId, topic, action);

    case "api_consumer":
      return action === "subscribe" && topic === "fitsense/#";

    default:
      return false;
  }
}

function checkMemberAcl(
  userId: string,
  companyId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  const hrTopic = `fitsense/${companyId}/${userId}/hr`;
  const alertsTopic = `fitsense/${companyId}/${userId}/alerts`;

  if (action === "publish") {
    return topic === hrTopic;
  }
  // subscribe
  return topic === hrTopic || topic === alertsTopic;
}

function checkTrainerOwnerAcl(
  companyId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  if (action === "publish") return false;

  // allow subscribe to fitsense/{company_id}/#
  if (matchesWildcardHash(`fitsense/${companyId}`, topic)) return true;
  // allow subscribe to fitsense/{company_id}/+/alerts
  if (matchesSingleLevelAlerts(companyId, topic)) return true;

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
  companyId: string,
  userId: string,
  topic: string,
  action: "publish" | "subscribe",
): boolean {
  if (action === "subscribe") return false;
  // allow publish only to fitsense/{company_id}/{user_id}/alerts
  return topic === `fitsense/${companyId}/${userId}/alerts`;
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
 * Matches `fitsense/{company_id}/+/alerts`
 * i.e. exactly 4 segments: fitsense / {company_id} / {anything} / alerts
 */
function matchesSingleLevelAlerts(companyId: string, topic: string): boolean {
  const parts = topic.split("/");
  return (
    parts.length === 4 &&
    parts[0] === "fitsense" &&
    parts[1] === companyId &&
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
  const { clientid, username, password } = req.body as {
    clientid?: string;
    username?: string;
    password?: string;
  };

  if (!password || !clientid) {
    return res.json({ result: "deny" });
  }

  // Check if it's the internal API consumer background worker
  if (
    clientid.startsWith("api_consumer_") &&
    username === config.mqtt.internalUsername &&
    password === config.mqtt.internalPassword &&
    Boolean(config.mqtt.internalPassword)
  ) {
    try {
      const redis = getRedis();
      await redis.setex(
        `mqtt_session:${clientid}`,
        86400,
        JSON.stringify({
          userId: "api_consumer",
          companyId: "*",
          role: "api_consumer",
        }),
      );
      return res.json({ result: "allow" });
    } catch {
      return res.json({ result: "deny" });
    }
  }

  try {
    const payload = jwt.verify(password, config.jwt.secret) as {
      userId: string;
      companyId: string | null;
      role: string;
      exp: number;
    };

    // Cache session in Redis so ACL webhook can look up role/companyId/userId
    const redis = getRedis();
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.setex(
        `mqtt_session:${clientid}`,
        ttl,
        JSON.stringify({
          userId: payload.userId,
          companyId: payload.companyId ?? "",
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
      companyId: string;
      role: string;
    };

    const allowed = checkAcl(
      session.role,
      session.userId,
      session.companyId,
      topic,
      action,
    );

    return res.json({ result: allowed ? "allow" : "deny" });
  } catch {
    return res.json({ result: "deny" });
  }
});

export default router;


