"use client";

// app/cart/page.js   Shopping cart. Fully wired to CartContext.
// Responsive: desktop shows a table; mobile shows stacked cards.

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Breadcrumb from "../../components/Breadcrumb";
import QuantityStepper from "../../components/QuantityStepper";
import { useCart } from "../../lib/CartContext";
import { useT } from "../../lib/i18n/LanguageProvider";
import { useMoney } from "../../lib/currency/CurrencyProvider";

// Product thumbnail: a real photo when the item carries one, else its emoji
// icon, else a placeholder glyph. Used by both the desktop table and the
// mobile card stack below.
function Thumb({ item, className }) {
    if (item.image) {
        return (
            <div
                className={`relative shrink-0 rounded-md border border-gray-200 bg-gray-50 overflow-hidden ${className}`}
            >
                <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-contain p-1.5"
                    sizes="64px"
                />
            </div>
        );
    }
    return (
        <div
            className={`shrink-0 rounded-md border border-gray-200 bg-gray-50 grid place-items-center text-gray-300 ${className}`}
        >
            {item.icon ? (
                <span className="text-2xl">{item.icon}</span>
            ) : (
                <i className="fa-regular fa-image" />
            )}
        </div>
    );
}

export default function CartPage() {
    const t = useT();
    const money = useMoney();
    const {
        items,
        subtotal,
        discount,
        total,
        coupon,
        updateQty,
        removeItem,
        applyCoupon,
        clearCart,
        hydrated,
    } = useCart();
    const [code, setCode] = useState("");

    if (!hydrated) return null;

    if (items.length === 0) {
        return (
            <>
                <Breadcrumb items={[{ label: t("cart.breadcrumb") }]} />
                <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
                    <div className="text-6xl sm:text-7xl mb-4">🛒</div>
                    <h1 className="text-xl sm:text-2xl font-bold mb-2">
                        {t("cart.empty")}
                    </h1>
                    <p className="text-gray-500 mb-6">{t("cart.emptySub")}</p>
                    <Link
                        href="/shop"
                        className="inline-block px-6 py-3 rounded-full bg-eco-green text-white font-medium"
                    >
                        {t("common.startShopping")}{" "}
                        <i className="fa-solid fa-arrow-right ml-1" />
                    </Link>
                </section>
            </>
        );
    }

    return (
        <>
            <Breadcrumb items={[{ label: t("cart.breadcrumb") }]} />

            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
                <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
                    {t("cart.heading")}
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                    <div className="lg:col-span-8">
                        {/* Desktop table ============================================== */}
                        <table className="w-full text-sm border border-gray-200 hidden md:table">
                            <thead className="bg-gray-50 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-4 text-left">
                                        {t("cart.product")}
                                    </th>
                                    <th className="py-3 px-4 text-left">
                                        {t("cart.price")}
                                    </th>
                                    <th className="py-3 px-4">
                                        {t("cart.quantity")}
                                    </th>
                                    <th className="py-3 px-4 text-left">
                                        {t("cart.subtotal")}
                                    </th>
                                    <th className="py-3 px-4" />
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <tr key={it.slug} className="border-t">
                                        <td className="py-4 px-4 flex items-center gap-3">
                                            <Thumb item={it} className="w-14 h-14" />
                                            <Link
                                                href={`/shop/${it.slug}`}
                                                className="hover:text-eco-green font-medium"
                                            >
                                                {it.name}
                                            </Link>
                                        </td>
                                        <td className="py-4 px-4">
                                            {money(it.price)}
                                        </td>
                                        <td className="py-4 px-4">
                                            <QuantityStepper
                                                value={it.qty}
                                                onChange={(n) =>
                                                    updateQty(it.slug, n)
                                                }
                                            />
                                        </td>
                                        <td className="py-4 px-4 font-semibold">
                                            {money(it.price * it.qty)}
                                        </td>
                                        <td className="py-4 px-4 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(it.slug)
                                                }
                                                className="text-gray-400 hover:text-red-500"
                                                aria-label={t("cart.remove", {
                                                    name: it.name,
                                                })}
                                            >
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Mobile card stack ========================================== */}
                        <div className="md:hidden space-y-3">
                            {items.map((it) => (
                                <div
                                    key={it.slug}
                                    className="border border-gray-200 rounded-lg p-4 flex gap-4"
                                >
                                    <Thumb
                                        item={it}
                                        className="w-14 h-14 self-center"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <Link
                                                href={`/shop/${it.slug}`}
                                                className="font-medium hover:text-eco-green truncate"
                                            >
                                                {it.name}
                                            </Link>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeItem(it.slug)
                                                }
                                                className="text-gray-400 hover:text-red-500 -mt-1 -mr-1 p-1"
                                                aria-label={t("cart.remove", {
                                                    name: it.name,
                                                })}
                                            >
                                                <i className="fa-solid fa-xmark" />
                                            </button>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {money(it.price)} {t("cart.each")}
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <QuantityStepper
                                                value={it.qty}
                                                onChange={(n) =>
                                                    updateQty(it.slug, n)
                                                }
                                            />
                                            <div className="font-semibold">
                                                {money(it.price * it.qty)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-wrap gap-3 justify-between mt-6">
                            <Link
                                href="/shop"
                                className="px-5 py-3 rounded-full bg-gray-100 text-sm font-medium hover:bg-gray-200"
                            >
                                <i className="fa-solid fa-arrow-left mr-1" />{" "}
                                {t("cart.returnToShop")}
                            </Link>
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(t("cart.confirmClear")))
                                        clearCart();
                                }}
                                className="px-5 py-3 rounded-full bg-gray-100 text-sm font-medium hover:bg-red-50 hover:text-red-500"
                            >
                                {t("cart.clearCart")}
                            </button>
                        </div>

                        <div className="mt-8 sm:mt-10">
                            <div className="font-semibold mb-3">
                                {t("cart.couponCode")}{" "}
                                <span className="text-xs text-gray-400 font-normal">
                                    {t("cart.couponHint")}
                                </span>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    applyCoupon(code);
                                    setCode("");
                                }}
                                className="flex flex-col sm:flex-row gap-3"
                            >
                                <input
                                    type="text"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    placeholder={t("cart.couponPlaceholder")}
                                    className="eco-input flex-1 rounded-full"
                                />
                                <button
                                    type="submit"
                                    className="px-6 py-3 bg-eco-footer text-white rounded-full text-sm whitespace-nowrap"
                                >
                                    {t("cart.applyCoupon")}
                                </button>
                            </form>
                            {coupon && (
                                <div className="mt-3 text-sm text-eco-green">
                                    <i className="fa-solid fa-circle-check mr-1" />{" "}
                                    {t("cart.couponApplied", {
                                        code: coupon.code,
                                    })}{" "}
                                    {coupon.label}
                                </div>
                            )}
                        </div>
                    </div>

                    <aside className="lg:col-span-4">
                        <div className="border border-gray-200 rounded-md p-6 sticky top-24">
                            <div className="font-semibold mb-4">
                                {t("cart.cartTotal")}
                            </div>
                            <div className="flex justify-between text-sm py-3 border-b">
                                <span className="text-gray-500">
                                    {t("cart.subtotalLabel")}
                                </span>
                                <span className="font-semibold">
                                    {money(subtotal)}
                                </span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-sm py-3 border-b text-eco-green">
                                    <span>
                                        {t("cart.discountLabel", {
                                            code: coupon.code,
                                        })}
                                    </span>
                                    <span className="font-semibold">
                                        −{money(discount)}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm py-3 border-b">
                                <span className="text-gray-500">
                                    {t("cart.shippingLabel")}
                                </span>
                                <span className="font-semibold">
                                    {t("cart.free")}
                                </span>
                            </div>
                            <div className="flex justify-between py-3">
                                <span className="text-gray-500">
                                    {t("cart.totalLabel")}
                                </span>
                                <span className="text-lg font-bold">
                                    {money(total)}
                                </span>
                            </div>
                            <Link
                                href="/checkout"
                                className="block text-center mt-3 py-3 rounded-full bg-eco-green text-white font-medium hover:bg-emerald-600"
                            >
                                {t("cart.proceedToCheckout")}{" "}
                                <i className="fa-solid fa-arrow-right ml-1" />
                            </Link>
                        </div>
                    </aside>
                </div>
            </section>
        </>
    );
}
