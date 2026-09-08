// app/dashboard/orders/_components/CustomerOrderHistory.jsx
// Customer-facing order history table, matching the "Order History" storefront
// design: a plain table (Order ID / Date / Total / Status) with real
// pagination, no admin status-editing controls. Rendered from
// app/dashboard/orders/page.js only when user.role === "CUSTOMER".

import Link from "next/link";
import { prisma } from "../../../../lib/prisma";
import { formatMoney } from "../../../../lib/money";
import { getActiveCurrency } from "../../../../lib/store-config";
import { getT } from "../../../../lib/i18n/server";
import { STATUS_PILL, statusKey } from "../../../../lib/order-status";

const PAGE_SIZE = 10;

export default async function CustomerOrderHistory({ user, page }) {
    const { t } = await getT();
    const cur = await getActiveCurrency();

    const currentPage = Math.max(1, page);
    const [orders, totalCount] = await Promise.all([
        prisma.order.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            skip: (currentPage - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            select: {
                id: true,
                number: true,
                total: true,
                status: true,
                createdAt: true,
                _count: { select: { items: true } },
            },
        }),
        prisma.order.count({ where: { userId: user.id } }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
                <h1 className="text-xl sm:text-2xl font-bold">
                    {t("dashboard.orderHistoryNav")}
                </h1>
            </div>

            {orders.length === 0 ? (
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
                                {orders.map((o) => (
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
                                            ).toLocaleDateString("en-US", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">
                                            {formatMoney(o.total, cur)}{" "}
                                            <span className="font-normal text-gray-400">
                                                (
                                                {t(
                                                    o._count.items === 1
                                                        ? "dashboard.items_one"
                                                        : "dashboard.items_other",
                                                    { count: o._count.items },
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
                                                {t("dashboard.viewDetailsLink")}
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                        {orders.map((o) => (
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

                    {totalPages > 1 && (
                        <Pager currentPage={currentPage} totalPages={totalPages} t={t} />
                    )}
                </>
            )}
        </div>
    );
}

function Pager({ currentPage, totalPages, t }) {
    const href = (p) =>
        p === 1 ? "/dashboard/orders" : `/dashboard/orders?page=${p}`;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav className="flex items-center justify-center gap-2 px-6 py-5 border-t border-gray-100">
            <PagerButton
                href={currentPage > 1 ? href(currentPage - 1) : null}
                aria-label={t("dashboard.prevPage")}
            >
                <i className="fa-solid fa-chevron-left text-xs" />
            </PagerButton>
            {pages.map((p) => (
                <PagerButton key={p} href={href(p)} active={p === currentPage}>
                    {p}
                </PagerButton>
            ))}
            <PagerButton
                href={currentPage < totalPages ? href(currentPage + 1) : null}
                aria-label={t("dashboard.nextPage")}
            >
                <i className="fa-solid fa-chevron-right text-xs" />
            </PagerButton>
        </nav>
    );
}

function PagerButton({ href, active, children, ...rest }) {
    const className = `w-9 h-9 inline-flex items-center justify-center rounded-full text-sm font-medium transition ${
        active
            ? "bg-eco-green text-white"
            : href
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-gray-50 text-gray-300 cursor-not-allowed"
    }`;
    if (!href) {
        return (
            <span className={className} {...rest}>
                {children}
            </span>
        );
    }
    return (
        <Link href={href} className={className} {...rest}>
            {children}
        </Link>
    );
}
