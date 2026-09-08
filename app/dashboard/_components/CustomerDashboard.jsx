// app/dashboard/_components/CustomerDashboard.jsx
// Customer account overview, matching the "My Account" storefront design:
// a profile card, a billing-address card, and a recent-order-history table.
// Rendered inside AccountShell (breadcrumb + Navigation sidebar) for
// role === CUSTOMER   see app/dashboard/layout.js.
//
// Every value here is real data (no template placeholders): profile from
// User, billing address from the customer's default (or most recent) saved
// Address, and orders from Prisma. A brand-new account with no saved address
// or no orders yet shows an honest empty state instead of fabricated rows.

import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { formatMoney } from "../../../lib/money";
import { getActiveCurrency } from "../../../lib/store-config";
import { getT } from "../../../lib/i18n/server";
import { STATUS_PILL, statusKey } from "../../../lib/order-status";

export default async function CustomerDashboard({ user }) {
    const { t } = await getT();
    const cur = await getActiveCurrency();

    const [profile, billingAddress, recent] = await Promise.all([
        prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true, email: true, phone: true, image: true },
        }),
        prisma.address.findFirst({
            where: { userId: user.id },
            orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        }),
        prisma.order.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
                id: true,
                number: true,
                total: true,
                status: true,
                createdAt: true,
                _count: { select: { items: true } },
            },
        }),
    ]);

    const displayName = profile?.name || user.name || user.email;
    const initials = (displayName || "?")
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Profile card */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 flex flex-col items-center text-center">
                    <span className="inline-flex items-center justify-center w-24 h-24 rounded-full overflow-hidden bg-eco-green/10 ring-1 ring-eco-green/20 text-eco-green text-2xl font-semibold shrink-0">
                        {profile?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={profile.image}
                                alt=""
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                            />
                        ) : (
                            initials
                        )}
                    </span>
                    <p className="mt-4 font-semibold text-lg">{displayName}</p>
                    <p className="text-sm text-gray-500">
                        {t("dashboard.customerAccount")}
                    </p>
                    <Link
                        href="/dashboard/settings#profile"
                        className="mt-3 text-sm font-medium text-eco-green hover:underline"
                    >
                        {t("dashboard.editProfile")}
                    </Link>
                </div>

                {/* Billing address card */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                        {t("dashboard.billingAddress")}
                    </p>
                    {billingAddress ? (
                        <>
                            <p className="font-semibold">
                                {billingAddress.firstName}{" "}
                                {billingAddress.lastName}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                                {[
                                    billingAddress.street,
                                    billingAddress.thana,
                                    billingAddress.city,
                                    billingAddress.state,
                                    billingAddress.zip,
                                ]
                                    .filter(Boolean)
                                    .join(", ")}
                            </p>
                            <p className="text-sm text-gray-600 mt-2">
                                {profile?.email || user.email}
                            </p>
                            {(billingAddress.phone || profile?.phone) && (
                                <p className="text-sm text-gray-600">
                                    {billingAddress.phone || profile?.phone}
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">
                            {t("dashboard.noBillingAddress")}
                        </p>
                    )}
                    <Link
                        href="/dashboard/settings#addresses"
                        className="inline-block mt-3 text-sm font-medium text-eco-green hover:underline"
                    >
                        {t("dashboard.editAddress")}
                    </Link>
                </div>
            </div>

            {/* Recent order history */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold">
                        {t("dashboard.recentOrderHistory")}
                    </h2>
                    <Link
                        href="/dashboard/orders"
                        className="text-sm font-medium text-eco-green hover:underline"
                    >
                        {t("dashboard.viewAll")}
                    </Link>
                </div>

                {recent.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        {t("dashboard.noOrders")}{" "}
                        <Link href="/shop" className="text-eco-green underline">
                            {t("dashboard.browseShop")}
                        </Link>
                        .
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="text-left px-6 py-3">
                                            {t("dashboard.orderIdCol")}
                                        </th>
                                        <th className="text-left px-6 py-3">
                                            {t("dashboard.date")}
                                        </th>
                                        <th className="text-left px-6 py-3">
                                            {t("dashboard.totalCol")}
                                        </th>
                                        <th className="text-left px-6 py-3">
                                            {t("dashboard.status")}
                                        </th>
                                        <th className="px-6 py-3" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent.map((o) => (
                                        <tr
                                            key={o.id}
                                            className="border-t border-gray-100"
                                        >
                                            <td className="px-6 py-4 font-medium">
                                                {o.number}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {new Date(
                                                    o.createdAt,
                                                ).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        day: "numeric",
                                                        month: "short",
                                                        year: "numeric",
                                                    },
                                                )}
                                            </td>
                                            <td className="px-6 py-4 font-semibold">
                                                {formatMoney(o.total, cur)}{" "}
                                                <span className="font-normal text-gray-400">
                                                    (
                                                    {t(
                                                        o._count.items === 1
                                                            ? "dashboard.items_one"
                                                            : "dashboard.items_other",
                                                        {
                                                            count: o._count
                                                                .items,
                                                        },
                                                    )}
                                                    )
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${STATUS_PILL[o.status] || "bg-gray-100 text-gray-700"}`}
                                                >
                                                    {t(statusKey(o.status))}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link
                                                    href={`/dashboard/orders/${o.id}`}
                                                    className="text-eco-green font-medium hover:underline whitespace-nowrap"
                                                >
                                                    {t(
                                                        "dashboard.viewDetailsLink",
                                                    )}
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {recent.map((o) => (
                                <div key={o.id} className="p-4">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="min-w-0">
                                            <div className="font-medium truncate">
                                                {o.number}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5">
                                                {new Date(
                                                    o.createdAt,
                                                ).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <span
                                            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${STATUS_PILL[o.status] || "bg-gray-100 text-gray-700"}`}
                                        >
                                            {t(statusKey(o.status))}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="text-sm font-semibold">
                                            {formatMoney(o.total, cur)}
                                        </div>
                                        <Link
                                            href={`/dashboard/orders/${o.id}`}
                                            className="text-sm text-eco-green font-medium hover:underline"
                                        >
                                            {t("dashboard.viewDetailsLink")}
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
