"use client";

// app/wishlist/WishlistClient.jsx   Saved items UI.
//
// The server page sends exactly the saved products (read from Cart.wishlist in
// the DB   the wishlist is deliberately never kept in localStorage; see
// lib/CartContext.jsx). The intersection below is still needed: removing an item
// updates CartContext immediately, so filtering against it makes the card
// disappear without waiting for a server round-trip.
//
// Layout matches the "My Wishlist" mockup: a single bordered table (Product /
// Price / Stock Status / Add to Cart / remove), with a mobile card stack below
// md   the same responsive pattern the Cart page uses.

import Image from "next/image";
import Link from "next/link";
import Breadcrumb from "../../components/Breadcrumb";
import { useCart } from "../../lib/CartContext";
import { useT } from "../../lib/i18n/LanguageProvider";
import { useMoney } from "../../lib/currency/CurrencyProvider";

const SHARE_LINKS = [
    {
        href: "https://www.facebook.com/Shanto.primee",
        icon: "fa-facebook-f",
        solid: true,
    },
    { href: "https://x.com/shanto_prime", icon: "fa-twitter" },
    { href: "#", icon: "fa-pinterest" },
    { href: "https://www.instagram.com/shanto_primee/", icon: "fa-instagram" },
];

function Thumb({ image, name }) {
    return (
        <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
            {image ? (
                <Image
                    src={image}
                    alt={name}
                    fill
                    className="object-contain p-1.5"
                    sizes="64px"
                />
            ) : (
                <div className="w-full h-full grid place-items-center text-gray-300">
                    <i className="fa-regular fa-image" />
                </div>
            )}
        </div>
    );
}

function StockBadge({ inStock, t }) {
    return (
        <span
            className={`inline-block text-xs px-3 py-1 rounded-full whitespace-nowrap ${
                inStock
                    ? "bg-green-100 text-eco-green"
                    : "bg-red-100 text-red-500"
            }`}
        >
            {inStock ? t("common.inStock") : t("common.outOfStock")}
        </span>
    );
}

export default function WishlistClient({ products }) {
    const t = useT();
    const money = useMoney();
    const { wishlist, hydrated, toggleWishlist, addItem } = useCart();
    if (!hydrated) return null;

    // Optimistic removal: drop anything the context no longer holds.
    const items = products.filter((p) => wishlist.includes(p.slug));

    return (
        <>
            <Breadcrumb items={[{ label: t("wishlist.breadcrumb") }]} />
            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
                <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">
                    {t("wishlist.heading")}
                </h1>

                {items.length === 0 ? (
                    <div className="text-center py-12 sm:py-20">
                        <div className="text-6xl sm:text-7xl mb-4">💚</div>
                        <h2 className="text-xl sm:text-2xl font-bold mb-2">
                            {t("wishlist.empty")}
                        </h2>
                        <p className="text-gray-500 mb-6">
                            {t("wishlist.emptySub")}
                        </p>
                        <Link
                            href="/shop"
                            className="inline-block px-6 py-3 rounded-full bg-eco-green text-white font-medium min-h-[44px]"
                        >
                            {t("wishlist.browseProducts")}
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="text-sm text-gray-500 mb-4">
                            {t(
                                items.length === 1
                                    ? "wishlist.savedItems_one"
                                    : "wishlist.savedItems_other",
                                { count: items.length },
                            )}
                        </div>

                        <div className="border border-gray-200 rounded-md overflow-hidden">
                            {/* Desktop table =============================================== */}
                            <table className="w-full text-sm hidden md:table">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="py-3 px-4 text-left">
                                            {t("cart.product")}
                                        </th>
                                        <th className="py-3 px-4 text-left">
                                            {t("cart.price")}
                                        </th>
                                        <th className="py-3 px-4 text-left">
                                            {t("wishlist.stockStatus")}
                                        </th>
                                        <th className="py-3 px-4" />
                                        <th className="py-3 px-4" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((p) => {
                                        const inStock = (p.stock ?? 0) > 0;
                                        return (
                                            <tr
                                                key={p.slug}
                                                className="border-t border-gray-200"
                                            >
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <Thumb
                                                            image={p.image}
                                                            name={p.name}
                                                        />
                                                        <Link
                                                            href={`/shop/${p.slug}`}
                                                            className="hover:text-eco-green font-medium"
                                                        >
                                                            {p.name}
                                                        </Link>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 whitespace-nowrap">
                                                    <span className="font-semibold">
                                                        {money(p.price)}
                                                    </span>
                                                    {p.oldPrice && (
                                                        <span className="text-xs text-gray-400 line-through ml-1.5">
                                                            {money(p.oldPrice)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <StockBadge
                                                        inStock={inStock}
                                                        t={t}
                                                    />
                                                </td>
                                                <td className="py-4 px-4">
                                                    <button
                                                        type="button"
                                                        disabled={!inStock}
                                                        onClick={() =>
                                                            addItem(p, 1)
                                                        }
                                                        className="px-5 py-2.5 rounded-full bg-eco-green text-white text-sm font-medium whitespace-nowrap hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                    >
                                                        {t("common.addToCart")}
                                                    </button>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleWishlist(
                                                                p.slug,
                                                                p.name,
                                                            )
                                                        }
                                                        className="w-8 h-8 rounded-full border border-gray-200 grid place-items-center text-gray-400 hover:border-red-500 hover:text-red-500"
                                                        aria-label={t(
                                                            "wishlist.remove",
                                                            { name: p.name },
                                                        )}
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Mobile card stack ============================================ */}
                            <div className="md:hidden divide-y divide-gray-200">
                                {items.map((p) => {
                                    const inStock = (p.stock ?? 0) > 0;
                                    return (
                                        <div
                                            key={p.slug}
                                            className="p-4 flex gap-3"
                                        >
                                            <Thumb
                                                image={p.image}
                                                name={p.name}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start gap-2">
                                                    <Link
                                                        href={`/shop/${p.slug}`}
                                                        className="font-medium hover:text-eco-green truncate"
                                                    >
                                                        {p.name}
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            toggleWishlist(
                                                                p.slug,
                                                                p.name,
                                                            )
                                                        }
                                                        className="text-gray-400 hover:text-red-500 -mt-1 -mr-1 p-1 shrink-0"
                                                        aria-label={t(
                                                            "wishlist.remove",
                                                            { name: p.name },
                                                        )}
                                                    >
                                                        <i className="fa-solid fa-xmark" />
                                                    </button>
                                                </div>
                                                <div className="mt-0.5">
                                                    <span className="font-semibold text-sm">
                                                        {money(p.price)}
                                                    </span>
                                                    {p.oldPrice && (
                                                        <span className="text-xs text-gray-400 line-through ml-1.5">
                                                            {money(p.oldPrice)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-2">
                                                    <StockBadge
                                                        inStock={inStock}
                                                        t={t}
                                                    />
                                                    <button
                                                        type="button"
                                                        disabled={!inStock}
                                                        onClick={() =>
                                                            addItem(p, 1)
                                                        }
                                                        className="px-4 py-2 rounded-full bg-eco-green text-white text-xs font-medium min-h-[36px] hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                                    >
                                                        {t("common.addToCart")}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Share row ==================================================== */}
                            <div className="flex items-center gap-3 px-4 py-4 border-t border-gray-200">
                                <span className="text-sm font-medium">
                                    {t("product.shareLabel")}
                                </span>
                                {SHARE_LINKS.map((s) => (
                                    <a
                                        key={s.icon}
                                        href={s.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={
                                            s.solid
                                                ? "w-8 h-8 rounded-full bg-eco-green text-white grid place-items-center hover:bg-emerald-600 text-xs"
                                                : "w-8 h-8 rounded-full border border-gray-200 grid place-items-center text-gray-500 hover:border-eco-green hover:text-eco-green text-xs"
                                        }
                                    >
                                        <i className={`fa-brands ${s.icon}`} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </>
                )}
            </section>
        </>
    );
}
