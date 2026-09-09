"use client";

// app/checkout/CheckoutClient.jsx   Live order summary + form validation +
// Place Order. Fully responsive: form is single column on mobile, two-column
// on sm+.
//
// `initialBilling` is prefilled by the server page from the signed-in user's
// default saved address (see app/checkout/page.js). It is a convenience only
// the fields stay fully editable, and placeOrderAction still validates whatever
// is actually submitted. Guests get an empty object.

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Breadcrumb from "../../components/Breadcrumb";
import { useCart } from "../../lib/CartContext";
import { placeOrderAction } from "../../lib/order-actions";
import { useT } from "../../lib/i18n/LanguageProvider";
import { useMoney } from "../../lib/currency/CurrencyProvider";
import {
    divisions,
    districtsOf,
    thanasOf,
    geoLabel,
    BD_COUNTRY,
} from "../../lib/bd-geo";

// Bangladesh-based store: a fixed country plus the cascading
// Division → District (Jella) → Thana/Upazila selectors below.
const COUNTRY = BD_COUNTRY;
const REQUIRED = [
    "firstName",
    "lastName",
    "street",
    "division",
    "district",
    "thana",
    "email",
    "phone",
];

// UI radio value → PaymentMethod enum expected by the server action.
const PAYMENT_MAP = { cod: "COD", bkash: "BKASH", nagad: "NAGAD" };

// Label a geo option as "English (বাংলা)" so both scripts are clear.

export default function CheckoutClient({ initialBilling = {} }) {
    const router = useRouter();
    const t = useT();
    const money = useMoney();
    const {
        items,
        subtotal,
        discount,
        total,
        coupon,
        clearCart,
        hydrated,
        showToast,
    } = useCart();

    // A saved address stores Division as `state`, District as `city` and Thana as
    // `thana`, using the same lib/bd-geo values these selectors render   so all
    // three prefill. (They used to come from lib/geo.js's US states, which matched
    // no <option> here and left the selectors blank.)
    const [form, setForm] = useState(() => ({
        firstName: initialBilling.firstName || "",
        lastName: initialBilling.lastName || "",
        company: initialBilling.company || "",
        street: initialBilling.street || "",
        division: initialBilling.state || "",
        district: initialBilling.city || "",
        thana: initialBilling.thana || "",
        zip: initialBilling.zip || "",
        email: initialBilling.email || "",
        phone: initialBilling.phone || "",
        notes: "",
        payment: "cod",
    }));
    const [errors, setErrors] = useState({});
    const [placed, setPlaced] = useState(null);
    const [placing, setPlacing] = useState(false);
    // "Ship to a different address"   a free-text shipping note appended to the
    // order's notes field. There is no separate shipping-address column on
    // Order, so this is deliberately a note rather than a second cascading
    // Division/District/Thana form.
    const [shipDifferent, setShipDifferent] = useState(false);
    const [shippingNote, setShippingNote] = useState("");

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    // Cascading selectors: changing a division clears the district + thana below
    // it; changing a district clears the thana   so a stale child value from
    // another area can never survive a parent change.
    const onDivision = (e) =>
        setForm((f) => ({
            ...f,
            division: e.target.value,
            district: "",
            thana: "",
        }));
    const onDistrict = (e) =>
        setForm((f) => ({ ...f, district: e.target.value, thana: "" }));

    const districtOptions = form.division ? districtsOf(form.division) : [];
    const thanaOptions =
        form.division && form.district
            ? thanasOf(form.division, form.district)
            : [];

    const onPlaceOrder = async (e) => {
        e.preventDefault();
        if (placing) return;

        const errs = {};
        for (const k of REQUIRED)
            if (!form[k].trim()) errs[k] = t("checkout.required");
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
            errs.email = t("checkout.invalidEmail");
        if (form.phone && form.phone.replace(/\D/g, "").length < 7)
            errs.phone = t("checkout.invalidPhone");
        setErrors(errs);
        if (Object.keys(errs).length) {
            showToast(t("checkout.requiredFields"), "error");
            return;
        }

        setPlacing(true);
        const itemCount = items.length;
        // A different shipping address is captured as a note (Order has no second
        // address   see the state declarations above), prefixed so it reads clearly
        // alongside any notes the buyer already typed.
        const notes = [
            shipDifferent && shippingNote.trim()
                ? `${t("checkout.shipDifferent")}: ${shippingNote.trim()}`
                : null,
            form.notes || null,
        ]
            .filter(Boolean)
            .join("\n\n");
        try {
            // The server action recomputes prices + stock from the DB (anti-tampering)
            // and decrements inventory inside a transaction.
            const res = await placeOrderAction({
                billing: {
                    firstName: form.firstName,
                    lastName: form.lastName,
                    street: form.street,
                    country: COUNTRY,
                    state: form.division, // Division (বিভাগ)
                    city: form.district, // District / Jella (জেলা)
                    thana: form.thana, // Thana / Upazila (থানা/উপজেলা)
                    zip: form.zip || undefined,
                    email: form.email,
                    phone: form.phone,
                    notes: notes || undefined,
                    payment: PAYMENT_MAP[form.payment] || "COD",
                },
                items: items.map((i) => ({ slug: i.slug, qty: i.qty })),
                couponCode: coupon?.code || undefined,
            });

            clearCart();
            setPlaced({
                id: res.number,
                total: res.total,
                items: itemCount,
                payment: form.payment,
                signedIn: res.signedIn,
            });
            showToast(t("checkout.placedMsg", { id: res.number }));
            // Only signed-in buyers can reach /dashboard (middleware gates it), so
            // guests stay on the thank-you screen instead of being bounced to
            // /unauthorized moments after a successful order.
            if (res.signedIn)
                setTimeout(() => router.push("/dashboard/orders"), 5000);
        } catch (err) {
            // Zod/stock/availability failures surface here with a readable message.
            showToast(err?.message || t("checkout.orderError"), "error");
        } finally {
            setPlacing(false);
        }
    };

    if (!hydrated) return null;

    if (placed) {
        return (
            <>
                <Breadcrumb items={[{ label: t("checkout.thankYou") }]} />
                <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
                    <div className="w-20 h-20 mx-auto rounded-full bg-eco-green text-white text-4xl grid place-items-center mb-4">
                        <i className="fa-solid fa-check" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                        {t("checkout.thankYou")}
                    </h1>
                    <p className="text-gray-500 mb-1">
                        {t("checkout.placedMsg", { id: placed.id })}
                    </p>
                    <p className="text-gray-500 mb-6">
                        {t(
                            placed.items === 1
                                ? "checkout.items_one"
                                : "checkout.items_other",
                            { count: placed.items },
                        )}{" "}
                        · {money(placed.total)} ·{" "}
                        {t(`checkout.${placed.payment}`)}
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center">
                        <Link
                            href="/shop"
                            className="inline-block px-6 py-3 rounded-full bg-eco-green text-white font-medium"
                        >
                            {t("checkout.continueShopping")}{" "}
                            <i className="fa-solid fa-arrow-right ml-1" />
                        </Link>
                        {/* A guest has no /dashboard/orders, so without this the number on
                screen would be unusable. Signed-in buyers are redirected to their
                dashboard a moment later and don't need it. */}
                        {!placed.signedIn && (
                            <Link
                                href={`/orders/lookup?number=${encodeURIComponent(placed.id)}`}
                                className="inline-block px-6 py-3 rounded-full border border-gray-200 font-medium hover:border-eco-green"
                            >
                                <i className="fa-solid fa-truck-fast mr-1.5" />{" "}
                                {t("lookup.trackThisOrder")}
                            </Link>
                        )}
                    </div>
                </section>
            </>
        );
    }

    if (items.length === 0) {
        return (
            <>
                <Breadcrumb items={[{ label: t("checkout.title") }]} />
                <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center">
                    <div className="text-6xl sm:text-7xl mb-4">🛒</div>
                    <h1 className="text-xl sm:text-2xl font-bold mb-2">
                        {t("checkout.nothingTitle")}
                    </h1>
                    <p className="text-gray-500 mb-6">
                        {t("checkout.nothingSub")}
                    </p>
                    <Link
                        href="/shop"
                        className="inline-block px-6 py-3 rounded-full bg-eco-green text-white font-medium"
                    >
                        {t("checkout.goToShop")}
                    </Link>
                </section>
            </>
        );
    }

    return (
        <>
            <Breadcrumb
                items={[
                    { href: "/cart", label: t("cart.title") },
                    { label: t("checkout.title") },
                ]}
            />

            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                <form
                    className="lg:col-span-8 space-y-8"
                    onSubmit={onPlaceOrder}
                    noValidate
                >
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold mb-4">
                            {t("checkout.billingInfo")}
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <Field
                                label={`${t("checkout.firstName")} *`}
                                err={errors.firstName}
                            >
                                <input
                                    name="firstName"
                                    autoComplete="given-name"
                                    className={`eco-input ${errors.firstName ? "border-red-500" : ""}`}
                                    value={form.firstName}
                                    onChange={set("firstName")}
                                />
                            </Field>
                            <Field
                                label={`${t("checkout.lastName")} *`}
                                err={errors.lastName}
                            >
                                <input
                                    name="lastName"
                                    autoComplete="family-name"
                                    className={`eco-input ${errors.lastName ? "border-red-500" : ""}`}
                                    value={form.lastName}
                                    onChange={set("lastName")}
                                />
                            </Field>
                            <Field label={t("checkout.company")}>
                                <input
                                    name="company"
                                    autoComplete="organization"
                                    className="eco-input"
                                    value={form.company}
                                    onChange={set("company")}
                                />
                            </Field>
                            <Field
                                label={`${t("checkout.street")} *`}
                                wide
                                err={errors.street}
                            >
                                <input
                                    name="street"
                                    autoComplete="street-address"
                                    className={`eco-input ${errors.street ? "border-red-500" : ""}`}
                                    value={form.street}
                                    onChange={set("street")}
                                />
                            </Field>

                            {/* Bangladesh cascading address: Division → District → Thana.
                  Each level only lists children of the one above it. */}
                            <Field
                                label={`${t("checkout.division")} *`}
                                err={errors.division}
                            >
                                <select
                                    name="division"
                                    autoComplete="address-level1"
                                    className={`eco-input ${errors.division ? "border-red-500" : ""}`}
                                    value={form.division}
                                    onChange={onDivision}
                                >
                                    <option value="">
                                        {t("checkout.selectDivision")}
                                    </option>
                                    {divisions().map((d) => (
                                        <option key={d.name} value={d.name}>
                                            {geoLabel(d)}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label={`${t("checkout.district")} *`}
                                err={errors.district}
                            >
                                <select
                                    name="district"
                                    autoComplete="address-level2"
                                    className={`eco-input ${errors.district ? "border-red-500" : ""}`}
                                    value={form.district}
                                    onChange={onDistrict}
                                    disabled={!form.division}
                                >
                                    <option value="">
                                        {form.division
                                            ? t("checkout.selectDistrict")
                                            : t("checkout.selectDistrictFirst")}
                                    </option>
                                    {districtOptions.map((d) => (
                                        <option key={d.name} value={d.name}>
                                            {geoLabel(d)}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field
                                label={`${t("checkout.thana")} *`}
                                err={errors.thana}
                            >
                                <select
                                    name="thana"
                                    autoComplete="address-level3"
                                    className={`eco-input ${errors.thana ? "border-red-500" : ""}`}
                                    value={form.thana}
                                    onChange={set("thana")}
                                    disabled={!form.district}
                                >
                                    <option value="">
                                        {form.district
                                            ? t("checkout.selectThana")
                                            : t("checkout.selectThanaFirst")}
                                    </option>
                                    {thanaOptions.map((tItem) => (
                                        <option
                                            key={tItem.name}
                                            value={tItem.name}
                                        >
                                            {geoLabel(tItem)}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={t("checkout.postcode")}>
                                <input
                                    name="zip"
                                    inputMode="numeric"
                                    autoComplete="postal-code"
                                    className="eco-input"
                                    value={form.zip}
                                    onChange={set("zip")}
                                />
                            </Field>
                            <Field
                                label={`${t("checkout.email")} *`}
                                err={errors.email}
                            >
                                <input
                                    name="email"
                                    autoComplete="email"
                                    className={`eco-input ${errors.email ? "border-red-500" : ""}`}
                                    type="email"
                                    value={form.email}
                                    onChange={set("email")}
                                    placeholder={t("checkout.emailPlaceholder")}
                                />
                            </Field>
                            <Field
                                label={`${t("checkout.phone")} *`}
                                err={errors.phone}
                            >
                                <input
                                    name="phone"
                                    autoComplete="tel"
                                    className={`eco-input ${errors.phone ? "border-red-500" : ""}`}
                                    type="tel"
                                    value={form.phone}
                                    onChange={set("phone")}
                                    placeholder="01XXXXXXXXX"
                                />
                            </Field>
                            <Field label={`${t("checkout.country")}`} wide>
                                <input
                                    name="country"
                                    className="eco-input bg-gray-50 text-gray-500"
                                    value={COUNTRY}
                                    readOnly
                                    aria-readonly="true"
                                />
                            </Field>
                        </div>

                        <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer">
                            <input
                                type="checkbox"
                                className="eco-check"
                                checked={shipDifferent}
                                onChange={(e) =>
                                    setShipDifferent(e.target.checked)
                                }
                            />
                            {t("checkout.shipDifferent")}
                        </label>
                        {shipDifferent && (
                            <div className="mt-3">
                                <label className="text-xs text-gray-500">
                                    {t("checkout.shipDifferentDetails")}
                                </label>
                                <textarea
                                    className="eco-input"
                                    rows={3}
                                    value={shippingNote}
                                    onChange={(e) =>
                                        setShippingNote(e.target.value)
                                    }
                                    placeholder={t(
                                        "checkout.shipDifferentPh",
                                    )}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <h2 className="text-lg sm:text-xl font-bold mb-4">
                            {t("checkout.additionalInfo")}
                        </h2>
                        <label className="text-xs text-gray-500">
                            {t("checkout.orderNotes")}
                        </label>
                        <textarea
                            className="eco-input"
                            rows={4}
                            value={form.notes}
                            onChange={set("notes")}
                            placeholder={t("checkout.orderNotesPh")}
                        />
                    </div>
                </form>

                <aside className="lg:col-span-4">
                    <div className="border border-gray-200 rounded-md p-5 sm:p-6 lg:sticky lg:top-24">
                        <div className="font-semibold mb-4">
                            {t("checkout.orderSummary")}
                        </div>
                        {items.map((it) => (
                            <div
                                key={it.slug}
                                className="flex justify-between text-sm py-2"
                            >
                                <div className="flex items-center gap-2 flex-1 truncate">
                                    <Thumb item={it} />
                                    <span className="truncate">
                                        {it.name} ×{it.qty}
                                    </span>
                                </div>
                                <div className="font-semibold whitespace-nowrap">
                                    {money(it.price * it.qty)}
                                </div>
                            </div>
                        ))}
                        <div className="flex justify-between py-2 border-t mt-2">
                            <span className="text-gray-500">
                                {t("checkout.subtotal")}
                            </span>
                            <span className="font-semibold">
                                {money(subtotal)}
                            </span>
                        </div>
                        {discount > 0 && (
                            <div className="flex justify-between py-2 text-eco-green">
                                <span>
                                    {t("checkout.discount")} ({coupon.code}):
                                </span>
                                <span className="font-semibold">
                                    −{money(discount)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between py-2">
                            <span className="text-gray-500">
                                {t("checkout.shipping")}
                            </span>
                            <span className="font-semibold">
                                {t("checkout.free")}
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-t">
                            <span className="text-gray-500">
                                {t("checkout.total")}
                            </span>
                            <span className="text-lg font-bold">
                                {money(total)}
                            </span>
                        </div>

                        <div className="font-semibold mt-4 mb-3">
                            {t("checkout.paymentMethod")}
                        </div>
                        {[
                            { v: "cod", l: t("checkout.cod") },
                            { v: "bkash", l: t("checkout.bkash") },
                            { v: "nagad", l: t("checkout.nagad") },
                        ].map((p) => (
                            <label
                                key={p.v}
                                className="flex items-center gap-2 py-2 text-sm cursor-pointer"
                            >
                                <input
                                    type="radio"
                                    name="pay"
                                    className="eco-check"
                                    checked={form.payment === p.v}
                                    onChange={() =>
                                        setForm((f) => ({ ...f, payment: p.v }))
                                    }
                                />
                                {p.l}
                            </label>
                        ))}

                        <button
                            type="submit"
                            onClick={onPlaceOrder}
                            disabled={placing}
                            className="w-full mt-4 py-3 rounded-full bg-eco-green text-white font-medium hover:bg-emerald-600 disabled:opacity-60"
                        >
                            {placing
                                ? t("checkout.placing")
                                : t("checkout.placeOrder")}
                        </button>
                    </div>
                </aside>
            </section>
        </>
    );
}

// Same real-photo → emoji-icon → placeholder fallback as the Cart table.
function Thumb({ item }) {
    if (item.image) {
        return (
            <div className="relative w-9 h-9 shrink-0 rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
                <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-contain p-1"
                    sizes="36px"
                />
            </div>
        );
    }
    return (
        <span className="w-9 h-9 shrink-0 rounded-md border border-gray-200 bg-gray-50 grid place-items-center text-lg text-gray-300">
            {item.icon || <i className="fa-regular fa-image text-sm" />}
        </span>
    );
}

function Field({ label, err, wide, children }) {
    return (
        <div className={wide ? "sm:col-span-2 lg:col-span-3" : ""}>
            <label className="text-xs text-gray-500">{label}</label>
            {children}
            {err && <div className="text-xs text-red-500 mt-1">{err}</div>}
        </div>
    );
}
