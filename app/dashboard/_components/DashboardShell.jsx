"use client";

// app/dashboard/_components/DashboardShell.jsx
// Sidebar + top bar shell around every /dashboard/* page.
//   • ≥ md: persistent sidebar on the left.
//   • < md: hidden behind a hamburger that opens a slide-in drawer.
// Body scroll is locked while the mobile drawer is open.
//
// LIGHT sidebar, based on public/Ecobazar Pending Requests.html: white surface,
// grey section headings, brand-tinted active pill with a left accent bar, and a
// soft signed-in card at the bottom. Colours use the app's dark-mode-aware
// utilities (bg-white, border-gray-200, text-gray-*, bg-eco-green/…) rather than
// hard-coded hexes, so globals.css `.dark` remaps turn the whole sidebar dark in
// dark mode automatically   light in light mode, dark in dark, one definition.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useT } from "../../../lib/i18n/LanguageProvider";

const RANK = { CUSTOMER: 0, MODERATOR: 1, ADMIN: 2 };

// Nav is grouped into sections so sales work (orders) and catalog work
// (products, reviews) don't sit interleaved in one flat list. Each item still
// declares the minimum role required to see it; a section whose items are all
// filtered out renders nothing at all, heading included.
//
// `badge` names a numeric count passed in via the `counts` prop (e.g. pending
// profile requests)   rendered as a pill on the item, hidden when zero.
//
// `titleKey: null` = no heading, used for the single top-level Overview link.
const NAV_SECTIONS = [
    {
        titleKey: null,
        items: [
            {
                href: "/dashboard",
                labelKey: "dashboard.overview",
                icon: "fa-gauge-high",
                min: "CUSTOMER",
            },
        ],
    },
    {
        titleKey: "dashboard.navOrders",
        items: [
            {
                href: "/dashboard/orders",
                labelKey: "dashboard.orders",
                icon: "fa-receipt",
                min: "CUSTOMER",
            },
        ],
    },
    {
        titleKey: "dashboard.navCatalog",
        items: [
            {
                href: "/dashboard/products",
                labelKey: "dashboard.products",
                icon: "fa-boxes-stacked",
                min: "MODERATOR",
            },
            {
                href: "/dashboard/reviews",
                labelKey: "dashboard.reviews",
                icon: "fa-comment-dots",
                min: "MODERATOR",
            },
        ],
    },
    {
        titleKey: "dashboard.navAdmin",
        items: [
            {
                href: "/dashboard/users",
                labelKey: "dashboard.users",
                icon: "fa-users",
                min: "ADMIN",
            },
            // Moderator requests (product deletion / order cancellation) awaiting an
            // admin's approve/reject.
            {
                href: "/dashboard/approvals",
                labelKey: "dashboard.approvals",
                icon: "fa-clipboard-check",
                min: "ADMIN",
                badge: "pendingApprovals",
            },
            // ADMIN-only now: moderators submit profile-change requests, only the
            // admin approves them (see lib/profile-changes.js).
            {
                href: "/dashboard/profile-requests",
                labelKey: "requests.navLabel",
                icon: "fa-user-pen",
                min: "ADMIN",
                badge: "pendingRequests",
            },
            {
                href: "/dashboard/banners",
                labelKey: "banners.navLabel",
                icon: "fa-images",
                min: "ADMIN",
            },
            {
                href: "/dashboard/messages",
                labelKey: "dashboard.messages",
                icon: "fa-envelope",
                min: "ADMIN",
                badge: "unreadMessages",
            },
            {
                href: "/dashboard/audit-log",
                labelKey: "dashboard.auditLog",
                icon: "fa-clipboard-list",
                min: "ADMIN",
            },
        ],
    },
    {
        titleKey: "dashboard.navAccount",
        items: [
            {
                href: "/dashboard/settings",
                labelKey: "dashboard.settings",
                icon: "fa-sliders",
                min: "CUSTOMER",
            },
        ],
    },
];

function initialsOf(user) {
    const src = (user.name || user.email || "?").trim();
    return (
        src
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "?"
    );
}

export default function DashboardShell({ user, counts = {}, children }) {
    const t = useT();
    const pathname = usePathname();
    const [drawer, setDrawer] = useState(false);

    // Close the drawer on every route change.
    useEffect(() => {
        setDrawer(false);
    }, [pathname]);

    // Lock body scroll while the drawer is open.
    useEffect(() => {
        if (!drawer) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [drawer]);

    const isActive = (h) =>
        pathname === h || (h !== "/dashboard" && pathname.startsWith(h));

    // Filter items by role first, then drop any section left empty   otherwise a
    // CUSTOMER would see a bare "Catalog" heading with nothing under it.
    const sections = NAV_SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((n) => RANK[user.role] >= RANK[n.min]),
    })).filter((s) => s.items.length > 0);

    const Sidebar = (
        <>
            <Link
                href="/dashboard"
                className="flex items-center gap-2.5 px-4 py-5"
            >
                <i className="fa-solid fa-seedling text-eco-green text-2xl" />
                <span className="text-xl font-bold tracking-tight">
                    {t("dashboard.brand")}
                </span>
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider bg-eco-green/10 text-eco-green rounded-full px-2 py-0.5">
                    {user.role}
                </span>
            </Link>

            <nav className="flex-1 px-3 pb-2 overflow-y-auto space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sections.map((section) => (
                    <div key={section.titleKey || "root"}>
                        {section.titleKey && (
                            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                {t(section.titleKey)}
                            </p>
                        )}
                        {section.items.map((n) => {
                            const active = isActive(n.href);
                            const badge = n.badge ? counts[n.badge] || 0 : 0;
                            return (
                                <Link
                                    key={n.href}
                                    href={n.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition min-h-[44px] ${
                                        active
                                            ? "bg-eco-green/10 text-eco-green ring-1 ring-eco-green/20"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                >
                                    {active && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-eco-green" />
                                    )}
                                    <i
                                        className={`fa-solid ${n.icon} w-[18px] text-center ${active ? "text-eco-green" : "text-gray-400 group-hover:text-eco-green"}`}
                                    />
                                    <span className="whitespace-nowrap">
                                        {t(n.labelKey)}
                                    </span>
                                    {badge > 0 && (
                                        <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-eco-green text-white text-[10px] font-semibold">
                                            {badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Signed-in card */}
            <div className="m-3 rounded-2xl bg-gray-50 border border-gray-200 p-3">
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-eco-green text-white font-semibold shrink-0">
                        {initialsOf(user)}
                    </span>
                    <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                            {user.name || user.email}
                        </p>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-eco-green">
                            {user.role}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="mt-2.5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:border-red-200 transition min-h-[40px]"
                >
                    <i className="fa-solid fa-arrow-right-from-bracket" />{" "}
                    {t("dashboard.signOut")}
                </button>
            </div>
        </>
    );

    return (
        <div className="bg-eco-bg min-h-[calc(100vh-200px)]">
            <div className="max-w-[1440px] mx-auto flex">
                {/* Desktop sidebar */}
                <aside className="hidden md:flex md:w-60 lg:w-[268px] bg-white border-r border-gray-200 flex-col sticky top-0 self-start h-screen">
                    {Sidebar}
                </aside>

                {/* Mobile top bar (drawer trigger) */}
                <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setDrawer(true)}
                        className="w-11 h-11 grid place-items-center -ml-2"
                        aria-label={t("dashboard.openMenu")}
                    >
                        <i className="fa-solid fa-bars text-xl" />
                    </button>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 font-bold"
                    >
                        <i className="fa-solid fa-seedling text-eco-green text-xl" />
                        <span>{t("dashboard.dashboard")}</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="w-11 h-11 grid place-items-center -mr-2"
                        aria-label={t("dashboard.signOut")}
                    >
                        <i className="fa-solid fa-arrow-right-from-bracket" />
                    </button>
                </div>

                {/* Mobile drawer */}
                {drawer && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/40 z-40 md:hidden"
                            onClick={() => setDrawer(false)}
                            aria-hidden="true"
                        />
                        <aside className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white border-r border-gray-200 z-50 md:hidden flex flex-col animate-[slideInLeft_.2s_ease-out]">
                            {Sidebar}
                        </aside>
                    </>
                )}

                {/* Main content */}
                <main className="flex-1 min-w-0 mt-14 md:mt-0 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
                    {children}
                </main>
            </div>
        </div>
    );
}
