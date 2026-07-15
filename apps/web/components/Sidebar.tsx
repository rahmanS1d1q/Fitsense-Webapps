"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  title?: string;
  links: NavLink[];
}

const Icon = {
  Home: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Building: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </svg>
  ),
  Users: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Whistle: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  Dumbbell: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6.5 6.5 11 11" />
      <path d="m21 21-1-1" />
      <path d="m3 3 1 1" />
      <path d="m18 22 4-4" />
      <path d="m2 6 4-4" />
      <path d="m3 10 7-7" />
      <path d="m14 21 7-7" />
    </svg>
  ),
  Image: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),
  Mail: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Activity: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  User: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  LogOut: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Device: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <circle cx="12" cy="17" r="1" />
    </svg>
  ),
  Database: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  ),
  Settings: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

function getNavGroups(role: string | null): NavGroup[] {
  switch (role) {
    case "super_admin":
      return [
        {
          title: "MANAJEMEN",
          links: [
            { label: "Dashboard", href: "/dashboard/admin", icon: Icon.Home },
            {
              label: "Companies",
              href: "/dashboard/admin/companies",
              icon: Icon.Building,
            },
          ],
        },
        {
          title: "MONITORING",
          links: [
            {
              label: "Audit Logs",
              href: "/dashboard/admin/audit-logs",
              icon: Icon.Activity,
            },
            {
              label: "Storage Stats",
              href: "/dashboard/admin/storage/stats",
              icon: Icon.Database,
            },
          ],
        },
        {
          title: "SISTEM",
          links: [
            {
              label: "Settings",
              href: "/dashboard/settings/security",
              icon: Icon.Settings,
            },
          ],
        },
      ];
    case "club_owner":
      return [
        {
          links: [
            {
              label: "Live Monitoring",
              href: "/dashboard/owner/monitoring",
              icon: Icon.Activity,
            },
          ],
        },
        {
          title: "Manajemen Tim",
          links: [
            {
              label: "Trainers",
              href: "/dashboard/owner/trainers",
              icon: Icon.Whistle,
            },
            {
              label: "Members",
              href: "/dashboard/owner/members",
              icon: Icon.Users,
            },
            {
              label: "Tambah Member",
              href: "/dashboard/owner/members/new",
              icon: Icon.Users,
            },
          ],
        },
        {
          title: "Program",
          links: [
            {
              label: "Workouts",
              href: "/dashboard/owner/workouts",
              icon: Icon.Dumbbell,
            },
            {
              label: "Assignments",
              href: "/dashboard/owner/assignments",
              icon: Icon.Dumbbell,
            },
            {
              label: "Assets",
              href: "/dashboard/owner/assets",
              icon: Icon.Image,
            },
            {
              label: "Devices",
              href: "/dashboard/owner/devices",
              icon: Icon.Device,
            },
          ],
        },
        {
          title: "Undangan",
          links: [
            {
              label: "Generate Kode",
              href: "/dashboard/owner/invite",
              icon: Icon.Mail,
            },
          ],
        },
        {
          title: "SISTEM",
          links: [
            {
              label: "Settings",
              href: "/dashboard/settings/security",
              icon: Icon.Settings,
            },
          ],
        },
      ];
    case "trainer":
      return [
        {
          links: [
            {
              label: "Live Monitoring",
              href: "/dashboard/trainer/monitoring",
              icon: Icon.Activity,
            },
          ],
        },
        {
          title: "Manajemen",
          links: [
            {
              label: "Members",
              href: "/dashboard/trainer/members",
              icon: Icon.Users,
            },
            {
              label: "Tambah Member",
              href: "/dashboard/trainer/members/new",
              icon: Icon.Users,
            },
            {
              label: "Workouts",
              href: "/dashboard/trainer/workouts",
              icon: Icon.Dumbbell,
            },
            {
              label: "Assignments",
              href: "/dashboard/trainer/assignments",
              icon: Icon.Dumbbell,
            },
          ],
        },
        {
          title: "Undangan",
          links: [
            {
              label: "Generate Kode",
              href: "/dashboard/trainer/invite",
              icon: Icon.Mail,
            },
          ],
        },
        {
          title: "SISTEM",
          links: [
            {
              label: "Settings",
              href: "/dashboard/settings/security",
              icon: Icon.Settings,
            },
          ],
        },
      ];
    case "member":
      return [
        {
          links: [
            {
              label: "My Session",
              href: "/dashboard/member",
              icon: Icon.Activity,
            },
            {
              label: "Jadwal Latihan",
              href: "/dashboard/member/schedule",
              icon: Icon.Dumbbell,
            },
            {
              label: "Profil",
              href: "/dashboard/member/profile",
              icon: Icon.User,
            },
          ],
        },
      ];
    default:
      return [];
  }
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [name, setName] = useState<string>("User");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    setRole(sessionStorage.getItem("role"));
    setName(sessionStorage.getItem("userName") ?? "User");
    setEmail(sessionStorage.getItem("email") ?? "");
  }, []);

  const roleLabel: Record<string, string> = {
    super_admin: "Super Admin",
    club_owner: "Club Owner",
    trainer: "Trainer",
    member: "Member",
  };

  const handleLogout = async () => {
    try {
      const jwt = sessionStorage.getItem("jwt");
      if (jwt)
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
        });
    } catch {
      /* ignore */
    } finally {
      sessionStorage.clear();
      router.push("/login");
    }
  };

  const navGroups = getNavGroups(role);

  return (
    <aside
      style={{
        width: 260,
        minHeight: "100vh",
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-border)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid var(--sidebar-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
          }}
          onClick={() =>
            router.push(
              role === "super_admin"
                ? "/dashboard/admin"
                : role === "member"
                  ? "/dashboard/member"
                  : "/dashboard/trainer",
            )
          }
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                color: "#f1f5f9",
                letterSpacing: "-0.3px",
                lineHeight: 1.1,
              }}
            >
              FitSense
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
              HR Monitoring
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        {navGroups.map((group, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            {group.title && (
              <div
                style={{
                  padding: "0 12px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                {group.title}
              </div>
            )}
            {group.links.map((link) => {
              const isActive =
                pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "9px 12px",
                    margin: "1px 0",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#f1f5f9" : "#94a3b8",
                    background: isActive
                      ? "rgba(59, 130, 246, 0.15)"
                      : "transparent",
                    borderLeft: isActive
                      ? "2px solid #3b82f6"
                      : "2px solid transparent",
                    paddingLeft: isActive ? 10 : 12,
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div
        style={{ padding: 12, borderTop: "1px solid var(--sidebar-border)" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 8px",
            borderRadius: 8,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #475569, #334155)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 600,
              color: "#f1f5f9",
              flexShrink: 0,
            }}
          >
            {name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#f1f5f9",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {role ? roleLabel[role] : ""}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
              e.currentTarget.style.color = "#f87171";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            {Icon.LogOut}
          </button>
        </div>
      </div>
    </aside>
  );
}
