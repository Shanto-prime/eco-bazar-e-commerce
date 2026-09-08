// app/dashboard/orders/[id]/page.js
// Dedicated "Order Details" page, matching the storefront design: billing +
// shipping + payment summary cards, a 4-step status tracker, and the ordered
// items table. Reachable from Order History's "View Details" link.
//
// Only the order's own customer can view it here (ADMIN/MODERATOR keep the
// existing inline table + modal at /dashboard/orders   see OrderDetails.jsx).
// Return-request + write-review actions are the same real functionality the
// modal offers, just laid out to match the new page instead of a popup.

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "../../../../lib/prisma";
import { requireAuth } from "../../../../lib/auth-helpers";
import { formatMoney } from "../../../../lib/money";
import { getActiveCurrency } from "../../../../lib/store-config";
import { getT } from "../../../../lib/i18n/server";
import { STATUS_PILL, statusKey } from "../../../../lib/order-status";
import { canRequestReturn } from "../../../../lib/order-return";
import OrderDetailActions from "./_components/OrderDetailActions";

const PAYMENT_LABEL = {
    COD: "Cash on delivery",
    PAYPAL: "PayPal",
    AMAZON: "Amazon Pay",
    BKASH: "bKash",
    NAGAD: "Nagad",
};

// Order.status → the 4-step tracker index (1-based). CANCELLED has no step;
// it's shown as a standalone banner instead of the tracker.
const STEP_INDEX = { PENDING: 1, PAID: 2, SHIPPED: 3, DELIVERED: 4 };

// Kept as a standalone helper (mirrors orders/page.js `toDetails`) rather than
// an inline `Date.now()` in the component body   react-hooks/purity flags a
// directly-called impure function inside a capitalised (component-shaped)
// function.
function returnEligibility(user, order) {
    return canRequestReturn({ viewerId: user.id, order, now: Date.now() });
}

export default async function OrderDetailPage({ params }) {
    const { id } = await params;
    const { t } = await getT();
    const user = await requireAuth(`/dashboard/orders/${id}`);
    const cur = await getActiveCurrency();

    const order = await prisma.order.findUnique({
        where: { id },
        select: {
            id: true,
            number: true,
            email: true,
            phone: true,
            firstName: true,
            lastName: true,
            street: true,
            city: true,
            thana: true,
            state: true,
            zip: true,
            country: true,
            subtotal: true,
            discount: true,
            shipping: true,
            total: true,
            payment: true,
            status: true,
            notes: true,
            userId: true,
            createdAt: true,
            items: {
                select: {
                    id: true,
                    productId: true,
                    productSlug: true,
                    productName: true,
                    unitPrice: true,
                    qty: true,
                    product: {
                        select: {
                            images: {
                                take: 1,
                                orderBy: { sort: "asc" },
                                select: { url: true, alt: true },
                            },
                        },
                    },
                },
            },
            history: {
                orderBy: { createdAt: "asc" },
                select: { id: true, status: true, createdAt: true },
            },
        },
    });

    // Only the order's own customer may view this page   staff use the
    // existing table + modal at /dashboard/orders instead.
    if (!order || user.role !== "CUSTOMER" || order.userId !== user.id) {
        notFound();
    }

    const reviewedProductIds = new Set(
        (
            await prisma.review.findMany({
                where: {
                    userId: user.id,
                    productId: {
                        in: order.items
                            .map((it) => it.productId)
                            .filter(Boolean),
                    },
                },
                select: { productId: true },
            })
        ).map((r) => r.productId),
    );

    const ret = returnEligibility(user, order);

    const address = [
        order.street,
        order.thana,
        order.city,
        order.state,
        order.zip,
    ]
        .filter(Boolean)
        .join(", ");

    const stepIndex = STEP_INDEX[order.status] || 0;
    const itemCount = order.items.reduce((sum, it) => sum + it.qty, 0);

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 pb-5 mb-6 border-b border-gray-200">
                <h1 className="text-xl sm:text-2xl font-bold">
                    {t("orders.pageTitle")}
                    <span className="mx-2 text-gray-300 font-normal">·</span>
                    <span className="text-sm sm:text-base font-normal text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString(
                            "en-US",
                            { day: "numeric", month: "long", year: "numeric" },
                        )}
                    </span>
                    <span className="mx-2 text-gray-300 font-normal">·</span>
                    <span className="text-sm sm:text-base font-normal text-gray-500">
                        {t(
                            itemCount === 1
                                ? "dashboard.items_one"
                                : "dashboard.items_other",
                            { count: itemCount },
                        )}
                    </span>
                </h1>
                <Link
                    href="/dashboard/orders"
                    className="text-sm font-medium text-eco-green hover:underline"
                >
                    <i className="fa-solid fa-arrow-left mr-1.5" />
                    {t("dashboard.backToList")}
                </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        {t("dashboard.billingAddress")}
                    </p>
                    <AddressBlock order={order} address={address} t={t} />
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                        {t("orders.shippingAddress")}
                    </p>
                    <AddressBlock order={order} address={address} t={t} />
                </div>
                <div className="bg-gray-50 rounded-lg p-5">
                    <div className="flex justify-between text-sm mb-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {t("orders.orderIdLabel")}
                            </p>
                            <p className="font-semibold mt-1">
                                {order.number}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                {t("orders.paymentMethod")}
                            </p>
                            <p className="font-semibold mt-1">
                                {PAYMENT_LABEL[order.payment] || order.payment}
                            </p>
                        </div>
                    </div>
                    <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">
                                {t("orders.subtotal")}
                            </dt>
                            <dd className="font-medium">
                                {formatMoney(order.subtotal, cur)}
                            </dd>
                        </div>
                        {order.discount > 0 && (
                            <div className="flex justify-between">
                                <dt className="text-gray-500">
                                    {t("orders.discount")}
                                </dt>
                                <dd className="font-medium">
                                    −{formatMoney(order.discount, cur)}
                                </dd>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <dt className="text-gray-500">
                                {t("orders.shipping")}
                            </dt>
                            <dd className="font-medium">
                                {order.shipping > 0
                                    ? formatMoney(order.shipping, cur)
                                    : t("orders.freeShipping")}
                            </dd>
                        </div>
                    </dl>
                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-200 font-bold">
                        <span>{t("orders.total")}</span>
                        <span>{formatMoney(order.total, cur)}</span>
                    </div>
                </div>
            </div>

            {order.status === "CANCELLED" ? (
                <div className="mb-8 rounded-lg bg-gray-50 border border-gray-200 px-5 py-4 text-sm text-gray-600">
                    <span
                        className={`text-xs px-2 py-1 rounded-full mr-2 ${STATUS_PILL.CANCELLED}`}
                    >
                        {t(statusKey("CANCELLED"))}
                    </span>
                    {t("orders.stepCancelled")}
                </div>
            ) : (
                <StatusTracker stepIndex={stepIndex} t={t} />
            )}

            <OrderDetailActions
                order={{
                    id: order.id,
                    number: order.number,
                    status: order.status,
                    notes: order.notes || null,
                    viewerIsOwner: true,
                    canReturn: ret.ok,
                    returnDeadline: ret.deadline
                        ? ret.deadline.toISOString()
                        : null,
                    canReviewItems: order.status === "DELIVERED",
                    items: order.items.map((it) => ({
                        id: it.id,
                        productId: it.productId,
                        productSlug: it.productSlug,
                        productName: it.productName,
                        unitPrice: it.unitPrice,
                        qty: it.qty,
                        image: it.product?.images?.[0]?.url || null,
                        reviewed:
                            !!it.productId &&
                            reviewedProductIds.has(it.productId),
                    })),
                }}
                cur={cur}
            />
        </div>
    );
}

function AddressBlock({ order, address, t }) {
    return (
        <div className="text-sm">
            <p className="font-semibold">
                {order.firstName} {order.lastName}
            </p>
            {address && <p className="text-gray-600 mt-1">{address}</p>}
            <p className="text-gray-400 text-xs uppercase tracking-wide mt-3">
                {t("checkout.email")}
            </p>
            <p className="text-gray-600">{order.email}</p>
            {order.phone && (
                <>
                    <p className="text-gray-400 text-xs uppercase tracking-wide mt-2">
                        {t("checkout.phone")}
                    </p>
                    <p className="text-gray-600">{order.phone}</p>
                </>
            )}
        </div>
    );
}

function StatusTracker({ stepIndex, t }) {
    const steps = [
        t("orders.stepReceived"),
        t("orders.stepProcessing"),
        t("orders.stepOnTheWay"),
        t("orders.stepDelivered"),
    ];
    return (
        <div className="flex items-start mb-8">
            {steps.map((label, i) => {
                const n = i + 1;
                const done = n < stepIndex;
                const current = n === stepIndex;
                return (
                    <div
                        key={label}
                        className="flex-1 flex flex-col items-center text-center"
                    >
                        <div className="flex items-center w-full">
                            <div
                                className={`flex-1 h-0.5 ${i === 0 ? "invisible" : done || current ? "bg-eco-green" : "bg-gray-200"}`}
                            />
                            <span
                                className={`w-9 h-9 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${
                                    done
                                        ? "bg-eco-green text-white"
                                        : current
                                          ? "bg-eco-green text-white ring-4 ring-eco-green/20"
                                          : "border-2 border-dashed border-gray-300 text-gray-400"
                                }`}
                            >
                                {done ? (
                                    <i className="fa-solid fa-check" />
                                ) : (
                                    String(n).padStart(2, "0")
                                )}
                            </span>
                            <div
                                className={`flex-1 h-0.5 ${i === steps.length - 1 ? "invisible" : done ? "bg-eco-green" : "bg-gray-200"}`}
                            />
                        </div>
                        <span
                            className={`mt-2 text-xs sm:text-sm font-medium ${current ? "text-eco-green" : done ? "text-gray-700" : "text-gray-400"}`}
                        >
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
