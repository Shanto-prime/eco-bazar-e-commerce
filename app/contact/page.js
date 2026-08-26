"use client";

// app/contact/page.js   Contact page with validated message form.

import { useState, useTransition } from "react";
import Breadcrumb from "../../components/Breadcrumb";
import { useCart } from "../../lib/CartContext";
import { submitContactMessageAction } from "../../lib/contact-actions";
import { useT } from "../../lib/i18n/LanguageProvider";

export default function ContactPage() {
    const t = useT();
    const cards = [
        { icon: "fa-location-dot", text: t("contact.addressCard") },
        { icon: "fa-envelope", text: t("contact.emailCard") },
        { icon: "fa-phone", text: t("contact.phoneCard") },
    ];
    const { showToast } = useCart();
    const [form, setForm] = useState({
        name: "",
        email: "",
        subject: "",
        message: "",
    });
    const [errors, setErrors] = useState({});
    const [pending, startTransition] = useTransition();
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = (e) => {
        e.preventDefault();
        const errs = {};
        if (!form.name.trim()) errs.name = t("contact.required");
        if (!/^\S+@\S+\.\S+$/.test(form.email))
            errs.email = t("contact.invalidEmail");
        if (!form.subject.trim()) errs.subject = t("contact.required");
        if (form.message.trim().length < 10)
            errs.message = t("contact.messageTooShort");
        setErrors(errs);
        if (Object.keys(errs).length) {
            showToast(t("contact.fixFields"), "error");
            return;
        }
        startTransition(async () => {
            const res = await submitContactMessageAction(form);
            if (!res?.ok) {
                showToast(t("contact.fixFields"), "error");
                return;
            }
            showToast(t("contact.sent"));
            setForm({ name: "", email: "", subject: "", message: "" });
        });
    };

    return (
        <>
            <Breadcrumb items={[{ label: t("contact.breadcrumb") }]} />

            <section className="max-w-[1320px] mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
                <aside className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 sm:gap-6">
                    {cards.map((c, i) => (
                        <div
                            key={i}
                            className="border max-h-32 border-gray-200 rounded-md p-4 sm:p-6 flex items-center gap-3 sm:gap-4"
                        >
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-50 grid place-items-center text-eco-green shrink-0">
                                <i className={`fa-solid ${c.icon}`} />
                            </div>
                            <div className="text-sm leading-relaxed whitespace-pre-line min-w-0 break-words">
                                {c.text}
                            </div>
                        </div>
                    ))}
                </aside>

                <div className="col-span-12 lg:col-span-8 border border-gray-200 rounded-md p-4 sm:p-6 lg:p-8">
                    <h2 className="text-xl sm:text-2xl font-bold">
                        {t("contact.sayHello")}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {t("contact.intro")}
                    </p>
                    <form
                        onSubmit={submit}
                        noValidate
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6"
                    >
                        <div>
                            <input
                                className={`eco-input ${errors.name ? "border-red-500" : ""}`}
                                value={form.name}
                                onChange={set("name")}
                                placeholder={t("contact.namePlaceholder")}
                            />
                            {errors.name && (
                                <div className="text-xs text-red-500 mt-1">
                                    {errors.name}
                                </div>
                            )}
                        </div>
                        <div>
                            <input
                                className={`eco-input ${errors.email ? "border-red-500" : ""}`}
                                value={form.email}
                                onChange={set("email")}
                                placeholder={t("contact.emailPlaceholder")}
                            />
                            {errors.email && (
                                <div className="text-xs text-red-500 mt-1">
                                    {errors.email}
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <input
                                className={`eco-input ${errors.subject ? "border-red-500" : "border-eco-green"}`}
                                value={form.subject}
                                onChange={set("subject")}
                                placeholder={t("contact.subjectPlaceholder")}
                            />
                            {errors.subject && (
                                <div className="text-xs text-red-500 mt-1">
                                    {errors.subject}
                                </div>
                            )}
                        </div>
                        <div className="sm:col-span-2">
                            <textarea
                                className={`eco-input ${errors.message ? "border-red-500" : ""}`}
                                rows={4}
                                value={form.message}
                                onChange={set("message")}
                                placeholder={t("contact.messagePlaceholder")}
                            />
                            {errors.message && (
                                <div className="text-xs text-red-500 mt-1">
                                    {errors.message}
                                </div>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={pending}
                            className="sm:col-span-2 md:col-span-1 px-8 py-3 rounded-full bg-eco-green text-white font-medium hover:bg-emerald-600 disabled:opacity-60 min-h-[44px]"
                        >
                            {pending
                                ? t("contact.sending")
                                : t("contact.sendMessage")}{" "}
                            <i className="fa-solid fa-arrow-right ml-1" />
                        </button>
                    </form>
                </div>
            </section>

            <section>
                <div className="map-placeholder h-60 sm:h-80 grid place-items-center">
                    <div className="text-center">
                        <i className="fa-solid fa-map-location-dot text-4xl text-eco-green mb-2" />
                        <div className="font-semibold">
                            {t("contact.storeLocation")}
                        </div>
                        <div className="text-sm">
                            {t("contact.storeAddress")}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
