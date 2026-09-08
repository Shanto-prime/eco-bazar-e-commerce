"use client";

// app/dashboard/orders/[id]/_components/OrderDetailActions.jsx
// Interactive half of the Order Details page: the product table (with each
// item's image, matching the mockup), plus the same real functionality the
// old modal offered   request-return (while DELIVERED and inside the 15-day
// window) and per-item "write a review". Ported from
// ../../_components/OrderDetails.jsx, restyled as a page section instead of a
// popup.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "../../../../../lib/i18n/LanguageProvider";
import { formatMoney } from "../../../../../lib/money";
import { RETURN_WINDOW_DAYS } from "../../../../../lib/order-return";
import {
    requestReturnAction,
    submitReviewAction,
} from "../../_customer-actions";

export default function OrderDetailActions({ order, cur }) {
    const t = useT();
    const router = useRouter();
    const [returnState, setReturnState] = useState({
        error: null,
        notice: null,
    });
    const [returnPending, startReturnTransition] = useTransition();

    const requestReturn = () => {
        if (!confirm(t("orders.returnConfirm", { number: order.number })))
            return;
        setReturnState({ error: null, notice: null });
        startReturnTransition(async () => {
            const res = await requestReturnAction({ orderId: order.id });
            if (!res?.ok) {
                setReturnState({
                    error: res?.error || "Return request failed.",
                    notice: null,
                });
                return;
            }
            setReturnState({ error: null, notice: t("orders.returnSaved") });
            router.refresh();
        });
    };

    return (
        <div>
            {order.canReturn && (
                <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg bg-eco-green/5 border border-eco-green/20 px-4 py-3">
                    <p className="text-sm text-gray-600">
                        {t("orders.returnWindow", {
                            days: RETURN_WINDOW_DAYS,
                        })}
                    </p>
                    <button
                        type="button"
                        onClick={requestReturn}
                        disabled={returnPending}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                        <i className="fa-solid fa-rotate-left" />{" "}
                        {t("orders.requestReturn")}
                    </button>
                </div>
            )}
            {returnState.error && (
                <p className="text-xs text-red-600 mb-3">
                    {returnState.error}
                </p>
            )}
            {returnState.notice && (
                <p className="text-xs text-eco-green mb-3">
                    {returnState.notice}
                </p>
            )}

            {order.notes && (
                <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        {t("orders.customerNote")}
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {order.notes}
                    </p>
                </div>
            )}

            <div className="overflow-x-auto -mx-6 sm:mx-0">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                        <tr>
                            <th className="text-left px-6 sm:px-0 sm:pl-0 py-3">
                                {t("orders.productCol")}
                            </th>
                            <th className="text-left px-4 py-3">
                                {t("orders.priceCol")}
                            </th>
                            <th className="text-left px-4 py-3">
                                {t("orders.quantityCol")}
                            </th>
                            <th className="text-left px-6 sm:pr-0 py-3">
                                {t("orders.subtotalCol")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item) => (
                            <ItemRow
                                key={item.id}
                                item={item}
                                orderId={order.id}
                                cur={cur}
                                canReview={
                                    order.canReviewItems &&
                                    !item.reviewed &&
                                    !!item.productId
                                }
                                t={t}
                                router={router}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function ItemRow({ item, orderId, cur, canReview, t, router }) {
    const [expanded, setExpanded] = useState(false);
    const [rating, setRating] = useState(5);
    const [body, setBody] = useState("");
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(false);
    const [pending, startTransition] = useTransition();

    const submit = (e) => {
        e.preventDefault();
        if (!body.trim()) {
            setError(t("orders.reviewPlaceholder"));
            return;
        }
        setError(null);
        startTransition(async () => {
            const res = await submitReviewAction({
                orderId,
                productId: item.productId,
                rating,
                body,
            });
            if (!res?.ok) {
                setError(res?.error || "Failed");
                return;
            }
            setSaved(true);
            setExpanded(false);
            router.refresh();
        });
    };

    return (
        <tr className="border-t border-gray-100 align-top">
            <td className="px-6 sm:px-0 py-4">
                <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 grid place-items-center">
                        {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={item.image}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <i className="fa-solid fa-leaf text-gray-300" />
                        )}
                    </span>
                    <div className="min-w-0">
                        {item.productSlug ? (
                            <a
                                href={`/shop/${item.productSlug}`}
                                className="font-medium text-gray-800 hover:text-eco-green truncate block"
                            >
                                {item.productName}
                            </a>
                        ) : (
                            <span className="font-medium text-gray-800">
                                {item.productName}
                            </span>
                        )}

                        {item.reviewed && !saved && (
                            <p className="text-[11px] text-emerald-600 mt-1">
                                <i className="fa-solid fa-check mr-1" />
                                {t("orders.reviewYours", { stars: "" })}
                            </p>
                        )}
                        {saved && (
                            <p className="text-[11px] text-emerald-600 mt-1">
                                <i className="fa-solid fa-check mr-1" />
                                {t("orders.reviewSaved")}
                            </p>
                        )}
                        {canReview && !expanded && !saved && (
                            <button
                                type="button"
                                onClick={() => setExpanded(true)}
                                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-eco-green hover:underline"
                            >
                                <i className="fa-regular fa-star" />{" "}
                                {t("orders.writeReview")}
                            </button>
                        )}
                        {expanded && (
                            <form
                                onSubmit={submit}
                                className="mt-2 space-y-2 rounded-md border border-gray-200 p-2 max-w-xs"
                            >
                                <label className="flex items-center gap-2 text-xs text-gray-600">
                                    <span>
                                        {t("orders.reviewRatingLabel")}:
                                    </span>
                                    <StarRatingInput
                                        value={rating}
                                        onChange={setRating}
                                    />
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    rows={3}
                                    maxLength={2000}
                                    placeholder={t(
                                        "orders.reviewPlaceholder",
                                    )}
                                    className="w-full rounded border border-gray-200 p-2 text-xs focus:border-eco-green focus:outline-none"
                                />
                                {error && (
                                    <p className="text-[11px] text-red-600">
                                        {error}
                                    </p>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={pending}
                                        className="rounded bg-eco-green text-white text-xs px-3 py-1.5 font-medium disabled:opacity-60"
                                    >
                                        {t("orders.reviewSubmit")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExpanded(false);
                                            setError(null);
                                        }}
                                        className="rounded border border-gray-200 text-xs px-3 py-1.5 text-gray-600 hover:border-gray-300"
                                    >
                                        {t("orders.close")}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                {formatMoney(item.unitPrice, cur)}
            </td>
            <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                x{item.qty}
            </td>
            <td className="px-6 sm:pr-0 py-4 font-semibold whitespace-nowrap">
                {formatMoney(item.unitPrice * item.qty, cur)}
            </td>
        </tr>
    );
}

function StarRatingInput({ value, onChange }) {
    return (
        <span className="inline-flex">
            {[1, 2, 3, 4, 5].map((n) => (
                <button
                    key={n}
                    type="button"
                    onClick={() => onChange(n)}
                    className={`text-base ${n <= value ? "text-yellow-400" : "text-gray-300 hover:text-yellow-300"}`}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                    ★
                </button>
            ))}
        </span>
    );
}
