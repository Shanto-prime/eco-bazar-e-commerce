"use client";

// app/dashboard/_components/AccountShell.jsx
// Customer-facing "My Account" chrome, matching the storefront's own visual
// language rather than the admin/moderator app-shell (DashboardShell): the
// dark vegetable-strip breadcrumb + a plain white "Navigation" card sidebar,
// both sitting inside the same boxed page width as the rest of the site (the
// root layout already renders TopBar/Header/PrimaryNav above and
// Newsletter/Footer below   this only owns the content in between).
//
// Only ever rendered for role === CUSTOMER; ADMIN/MODERATOR keep
// DashboardShell (see app/dashboard/layout.js). Self-contained like
// DashboardShell: derives the active nav item + breadcrumb trail from the
// current pathname instead of taking them as props, so every customer page
// (dashboard/orders/orders/[id]/settings) can just render children.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Breadcrumb from "../../../components/Breadcrumb";
import { useT } from "../../../lib/i18n/LanguageProvider";

const NAV = [
    { key: "dashboard", href: "/dashboard", icon: "fa-table-cells-large", labelKey: "dashboard.dashboard" },
    { key: "orders", href: "/dashboard/orders", icon: "fa-arrows-rotate", labelKey: "dashboard.orderHistoryNav" },
    { key: "wishlist", href: "/wishlist", icon: "fa-heart", iconStyle: "fa-regular", labelKey: "dashboard.wishlist" },
    { key: "cart", href: "/cart", icon: "fa-bag-shopping", labelKey: "dashboard.shoppingCartNav" },
    { key: "settings", href: "/dashboard/settings", icon: "fa-gear", labelKey: "dashboard.settings" },
];

function crumbsFor(pathname) {
    const account = { href: "/dashboard", label: "dashboard.accountCrumb" };
    if (pathname === "/dashboard") {
        return { active: "dashboard", items: [account, { label: "dashboard.dashboard" }] };
    }
    if (pathname === "/dashboard/orders") {
        return { active: "orders", items: [account, { label: "dashboard.orderHistoryNav" }] };
    }
    if (pathname.startsWith("/dashboard/orders/")) {
        return {
            active: "orders",
            items: [
                account,
                { href: "/dashboard/orders", label: "dashboard.orderHistoryNav" },
                { label: "orders.pageTitle" },
            ],
        };
    }
    if (pathname === "/dashboard/settings") {
        return { active: "settings", items: [account, { label: "dashboard.settings" }] };
    }
    return { active: "dashboard", items: [account] };
}

export default function AccountShell({ user, children }) {
    const t = useT();
    const pathname = usePathname();
    const { active, items } = crumbsFor(pathname);

    return (
        <div>
            <Breadcrumb items={items.map((it) => ({ ...it, label: t(it.label) }))} />

            <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-10 sm:py-14">
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 lg:gap-8 items-start">
                    <aside className="bg-white border border-gray-200 rounded-lg p-5 lg:sticky lg:top-6">
                        <h2 className="text-xl font-bold mb-4">
                            {t("dashboard.navigation")}
                        </h2>
                        <nav className="-mx-5">
                            {NAV.map((n) => {
                                const isActive = n.key === active;
                                return (
                                    <Link
                                        key={n.key}
                                        href={n.href}
                                        aria-current={isActive ? "page" : undefined}
                                        className={`relative flex items-center gap-3 px-5 py-3 text-sm transition ${
                                            isActive
                                                ? "bg-gray-50 font-semibold text-gray-900"
                                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                                        }`}
                                    >
                                        {isActive && (
                                            <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-eco-green" />
                                        )}
                                        <i
                                            className={`${n.iconStyle || "fa-solid"} ${n.icon} w-4 text-center ${isActive ? "text-eco-green" : "text-gray-400"}`}
                                        />
                                        {t(n.labelKey)}
                                    </Link>
                                );
                            })}
                            <button
                                type="button"
                                onClick={() => signOut({ callbackUrl: "/login" })}
                                className="w-full relative flex items-center gap-3 px-5 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition text-left"
                            >
                                <i className="fa-solid fa-right-from-bracket w-4 text-center text-gray-400" />
                                {t("dashboard.logOut")}
                            </button>
                        </nav>
                    </aside>

                    <div className="min-w-0">{children}</div>
                </div>
            </div>
        </div>
    );
}
