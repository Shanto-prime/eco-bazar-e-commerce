// app/dashboard/orders/page.js
// All authenticated users may view this page, but the data set is scoped by
// role server-side:
//   • CUSTOMER  → only their own orders
//   • MODERATOR → all orders, read-only (no admin actions)
//   • ADMIN     → all orders, plus an inline status picker per row
//
// Status changes are recorded in OrderStatusEvent (append-only), which is what
// the customer-facing timeline reads   Order.updatedAt can't be used for that
// because it moves on any write to the row.
//
// TODO: date-range + customer search.
// Line items + status timeline render inline via _components/OrderDetails.jsx.
// Still outstanding: a dedicated per-order route.

import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { requireAuth } from "../../../lib/auth-helpers";
import { formatMoney } from "../../../lib/money";
import { getActiveCurrency } from "../../../lib/store-config";
import { getT } from "../../../lib/i18n/server";
import {
    ORDER_STATUSES,
    STATUS_PILL,
    statusKey,
} from "../../../lib/order-status";
import {
    canRequestReturn,
    RETURN_WINDOW_DAYS,
} from "../../../lib/order-return";
import LocalTime from "../../../components/LocalTime";
import StatusSelect from "./_components/StatusSelect";
import OrderDetails from "./_components/OrderDetails";
import CustomerOrderHistory from "./_components/CustomerOrderHistory";

// Flatten one order's history into the plain, serialisable shape OrderDetails
// (a client component) expects   dates as ISO strings, actor pre-resolved.
//
// `viewer` is passed in from the caller; the customer flow (return + reviews)
// only triggers when the viewer is the order's owner. `reviewedProductIds` is
// the set of productIds this viewer has already reviewed   used to swap the
// "Write review" CTA for "You reviewed this" without an extra client fetch.
function toDetails(o, viewer, reviewedProductIds) {
    const now = Date.now();
    const ret = canRequestReturn({ viewerId: viewer.id, order: o, now });
    return {
        id: o.id,
        number: o.number,
        status: o.status,
        notes: o.notes || null,
        createdAt: o.createdAt.toISOString(),
        subtotal: o.subtotal,
        discount: o.discount,
        shipping: o.shipping,
        total: o.total,
        // Ownership + return + review eligibility, all pre-computed server-side so
        // the client modal doesn't need auth checks of its own.
        viewerIsOwner: !!viewer && o.userId === viewer.id,
        canReturn: ret.ok,
        returnDeadline: ret.deadline ? ret.deadline.toISOString() : null,
        returnReason: ret.reason || null,
        // Reviews are only meaningful once delivered AND for the buyer.
        canReviewItems:
            o.status === "DELIVERED" && !!viewer && o.userId === viewer.id,
        items: (o.items || []).map((it) => ({
            id: it.id,
            productId: it.productId,
            productSlug: it.productSlug,
            productName: it.productName,
            unitPrice: it.unitPrice,
            qty: it.qty,
            // Convenience for the modal   line total in the same integer minor units.
            lineTotal: it.unitPrice * it.qty,
            // True if this viewer has already reviewed this product elsewhere OR
            // through this order. Suppresses the Write-review CTA in the modal.
            reviewed: !!it.productId && reviewedProductIds.has(it.productId),
        })),
        history: (o.history || []).map((h) => ({
            id: h.id,
            status: h.status,
            note: h.note || null,
            createdAt: h.createdAt.toISOString(),
            actorName: h.actor?.name || h.actor?.email || null,
        })),
    };
}

export default async function DashboardOrders({ searchParams }) {
    const { t } = await getT();
    const user = await requireAuth("/dashboard/orders");
    const cur = await getActiveCurrency();

    // searchParams is a Promise in Next 15+. Anything not in the enum (including
    // the default "all") falls through to no status filter rather than erroring.
    const params = await searchParams;

    // CUSTOMER gets the storefront-styled "Order History" page (own orders,
    // real pagination, no status tabs/inline status editor) instead of the
    // shared admin/mod table below. See _components/CustomerOrderHistory.jsx.
    if (user.role === "CUSTOMER") {
        const page = Number.parseInt(params?.page, 10) || 1;
        return <CustomerOrderHistory user={user} page={page} />;
    }

    const raw =
        typeof params?.status === "string" ? params.status.toUpperCase() : "";
    const active = ORDER_STATUSES.includes(raw) ? raw : null;

    // CUSTOMER sees only their own orders; MODERATOR/ADMIN see everything. The
    // status tab narrows within whatever that role is already allowed to see, so
    // it can never widen the scope.
    const scope = user.role === "CUSTOMER" ? { userId: user.id } : {};
    const where = active ? { ...scope, status: active } : scope;

    const [orders, grouped] = await Promise.all([
        prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
                id: true,
                number: true,
                total: true,
                status: true,
                createdAt: true,
                subtotal: true,
                discount: true,
                shipping: true,
                email: true,
                firstName: true,
                lastName: true,
                notes: true,
                _count: { select: { items: true } },
                items: {
                    select: {
                        id: true,
                        productId: true,
                        productSlug: true,
                        productName: true,
                        unitPrice: true,
                        qty: true,
                    },
                },
                history: {
                    orderBy: { createdAt: "asc" },
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                        note: true,
                        actor: { select: { name: true, email: true } },
                    },
                },
            },
        }),
        // Counts come from `scope`, not `where`   the tab badges must keep showing
        // every bucket's size while one bucket is selected.
        prisma.order.groupBy({ by: ["status"], where: scope, _count: true }),
    ]);

    const countOf = (s) => grouped.find((g) => g.status === s)?._count ?? 0;
    const totalCount = grouped.reduce((sum, g) => sum + g._count, 0);

    // Reviewed-product set for THIS viewer, restricted to products appearing in
    // the orders we're rendering   so the modal can suppress the "Write review"
    // CTA on items the customer already reviewed without another round trip per
    // item. Empty when the viewer is anonymous, or on a page with no items.
    const productIdsOnPage = Array.from(
        new Set(
            orders.flatMap((o) =>
                (o.items || []).map((it) => it.productId).filter(Boolean),
            ),
        ),
    );
    const reviewedProductIds =
        user.id && productIdsOnPage.length
            ? new Set(
                  (
                      await prisma.review.findMany({
                          where: {
                              userId: user.id,
                              productId: { in: productIdsOnPage },
                          },
                          select: { productId: true },
                      })
                  ).map((r) => r.productId),
              )
            : new Set();

    return (
        <div>
            <header className="mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold">
                    {user.role === "CUSTOMER"
                        ? t("dashboard.myOrders")
                        : t("dashboard.orders")}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {user.role === "ADMIN" && t("dashboard.ordersAllSystem")}
                    {user.role === "MODERATOR" &&
                        t("dashboard.ordersAllReadOnly")}
                    {user.role === "CUSTOMER" &&
                        t("dashboard.ordersYourHistory")}
                </p>
            </header>

            {/* Status tabs. Plain links, so each bucket is a shareable/bookmarkable
          URL and the filtering stays server-side. */}
            <nav className="flex flex-wrap gap-2 mb-5 overflow-x-auto">
                <StatusTab
                    href="/dashboard/orders"
                    label={t("dashboard.statusAll")}
                    count={totalCount}
                    active={!active}
                />
                {ORDER_STATUSES.map((s) => (
                    <StatusTab
                        key={s}
                        href={`/dashboard/orders?status=${s.toLowerCase()}`}
                        label={t(statusKey(s))}
                        count={countOf(s)}
                        active={active === s}
                    />
                ))}
            </nav>

            {orders.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500 bg-white">
                    {active ? (
                        t("dashboard.noOrdersInStatus", {
                            status: t(statusKey(active)),
                        })
                    ) : user.role === "CUSTOMER" ? (
                        <>
                            {t("dashboard.noOrders")}{" "}
                            <Link
                                href="/shop"
                                className="text-eco-green underline"
                            >
                                {t("dashboard.browseShop")}
                            </Link>
                            .
                        </>
                    ) : (
                        t("dashboard.noOrdersSystem")
                    )}
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="text-left px-4 py-3">
                                        {t("dashboard.orderNumber")}
                                    </th>
                                    {user.role !== "CUSTOMER" && (
                                        <th className="text-left px-4 py-3">
                                            {t("dashboard.colCustomer")}
                                        </th>
                                    )}
                                    <th className="text-left px-4 py-3">
                                        {t("dashboard.colItems")}
                                    </th>
                                    <th className="text-left px-4 py-3">
                                        {t("dashboard.totalCol")}
                                    </th>
                                    <th className="text-left px-4 py-3">
                                        {t("dashboard.status")}
                                    </th>
                                    <th className="text-left px-4 py-3">
                                        {t("dashboard.colPlaced")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((o) => (
                                    <tr key={o.id} className="border-t">
                                        <td className="px-4 py-3 font-medium">
                                            {o.number}
                                        </td>
                                        {user.role !== "CUSTOMER" && (
                                            <td className="px-4 py-3 text-gray-600">
                                                <div>
                                                    {o.firstName} {o.lastName}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {o.email}
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-4 py-3 text-gray-500">
                                            {o._count.items}
                                        </td>
                                        <td className="px-4 py-3 font-semibold">
                                            {formatMoney(o.total, cur)}
                                        </td>
                                        <td className="px-4 py-3">
                                            {user.role === "ADMIN" ||
                                            user.role === "MODERATOR" ? (
                                                <StatusSelect
                                                    orderId={o.id}
                                                    status={o.status}
                                                />
                                            ) : (
                                                <StatusPill status={o.status} />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 align-top">
                                            <LocalTime value={o.createdAt} />
                                            {/* Staff see the full inline timeline; customers see only
                          the latest update   both open the details popup for
                          the complete history + any messages. */}
                                            {user.role === "CUSTOMER" ? (
                                                <LastUpdate
                                                    history={o.history}
                                                    t={t}
                                                />
                                            ) : (
                                                <Timeline
                                                    history={o.history}
                                                    t={t}
                                                />
                                            )}
                                            <div className="mt-2">
                                                <OrderDetails
                                                    order={toDetails(
                                                        o,
                                                        user,
                                                        reviewedProductIds,
                                                    )}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-3">
                        {orders.map((o) => (
                            <div
                                key={o.id}
                                className="bg-white border border-gray-200 rounded-lg p-4"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium truncate">
                                            {o.number}
                                        </div>
                                        {user.role !== "CUSTOMER" && (
                                            <div className="text-xs text-gray-500 truncate">
                                                {o.firstName} {o.lastName}{" "}
                                                {o.email}
                                            </div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1">
                                            <LocalTime value={o.createdAt} /> ·{" "}
                                            {t(
                                                o._count.items === 1
                                                    ? "dashboard.items_one"
                                                    : "dashboard.items_other",
                                                { count: o._count.items },
                                            )}
                                        </div>
                                    </div>
                                    {user.role === "ADMIN" ||
                                    user.role === "MODERATOR" ? (
                                        <StatusSelect
                                            orderId={o.id}
                                            status={o.status}
                                        />
                                    ) : (
                                        <StatusPill status={o.status} />
                                    )}
                                </div>
                                <div className="text-sm font-semibold mt-2">
                                    {formatMoney(o.total, cur)}
                                </div>
                                {user.role === "CUSTOMER" ? (
                                    <LastUpdate history={o.history} t={t} />
                                ) : (
                                    <Timeline history={o.history} t={t} />
                                )}
                                <div className="mt-2">
                                    <OrderDetails
                                        order={toDetails(
                                            o,
                                            user,
                                            reviewedProductIds,
                                        )}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// Compact "last update" line for the customer view   just the most recent
// status change and when it happened. The full history is one click away in the
// order-details popup.
function LastUpdate({ history, t }) {
    if (!history?.length) return null;
    const last = history[history.length - 1];
    return (
        <div className="text-xs text-gray-500 mt-1">
            {t("orders.lastUpdate")}{" "}
            <span className="font-medium text-gray-700">
                {t(statusKey(last.status))}
            </span>
            {" · "}
            <LocalTime value={last.createdAt} />
        </div>
    );
}

// Append-only status history for one order. The first event is the order's own
// creation (actor null   the purchase itself), so a brand-new order still shows
// a one-entry timeline rather than nothing. Rendered for staff: admins/mods see
// what they changed and when at a glance.
function Timeline({ history, t }) {
    if (!history?.length) return null;

    return (
        <ol className="mt-2 space-y-1 border-l border-gray-200 pl-3">
            {history.map((h) => (
                <li key={h.id} className="text-xs text-gray-500 relative">
                    <span className="absolute -left-[15px] top-1.5 w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span className="font-medium text-gray-700">
                        {t(
                            `dashboard.status${h.status[0]}${h.status.slice(1).toLowerCase()}`,
                        )}
                    </span>
                    {" · "}
                    <LocalTime value={h.createdAt} />
                    {h.actor && (
                        <span className="text-gray-400">
                            {" "}
                            · {h.actor.name || h.actor.email}
                        </span>
                    )}
                </li>
            ))}
        </ol>
    );
}

function StatusPill({ status }) {
    return (
        <span
            className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${STATUS_PILL[status] || "bg-gray-100 text-gray-700"}`}
        >
            {status}
        </span>
    );
}

// One filter tab. The count badge is rendered even at zero so the set of
// buckets stays stable as orders move between statuses   tabs appearing and
// vanishing under the cursor is worse than a few greyed-out zeros.
function StatusTab({ href, label, count, active }) {
    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap border transition min-h-[40px] ${
                active
                    ? "bg-eco-green text-white border-eco-green"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
        >
            {label}
            <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}
            >
                {count}
            </span>
        </Link>
    );
}
