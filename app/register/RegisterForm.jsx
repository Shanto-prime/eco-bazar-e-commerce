"use client";

// app/register/RegisterForm.jsx   credentials sign-up.
// Posts to /api/auth/signup, auto-signs the new user in, then (if a photo was
// picked) uploads it and saves it to the profile.
//
// Why the photo is uploaded AFTER sign-in: /api/upload/avatar requires a
// session, and the account doesn't exist until signup succeeds. So the order is
// create account → sign in → upload file → set avatar. The file is held in
// state until then; no photo URLs are involved.

import { signIn } from "next-auth/react";
import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "../../lib/i18n/LanguageProvider";
import { updateAvatarAction } from "../dashboard/settings/_actions";

export default function RegisterForm() {
    const router = useRouter();
    const sp = useSearchParams();
    const t = useT();
    // Default to home when no ?next= was passed — same rationale as LoginForm.
    const next = sp.get("next") || "/";

    const [form, setForm] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        phone: "",
    });
    const [file, setFile] = useState(null); // the picked image File (uploaded after sign-in)
    const [preview, setPreview] = useState(""); // object URL for the local preview
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const fileRef = useRef(null);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const onPickFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
            setError(t("settings.uploadFailed"));
            return;
        }
        if (f.size > 2 * 1024 * 1024) {
            setError(t("auth.photoTooLarge"));
            return;
        }
        setError(null);
        setFile(f);
        if (preview) URL.revokeObjectURL(preview);
        setPreview(URL.createObjectURL(f));
    };

    const clearPhoto = () => {
        setFile(null);
        if (preview) URL.revokeObjectURL(preview);
        setPreview("");
        if (fileRef.current) fileRef.current.value = "";
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);

        // 1) Create the account.
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        if (!res.ok) {
            const { error } = await res.json().catch(() => ({}));
            setError(error || t("auth.signupFailed"));
            setBusy(false);
            return;
        }

        // 2) Sign in so the upload endpoint + avatar action see a session.
        await signIn("credentials", {
            username: form.username,
            password: form.password,
            redirect: false,
        });

        // 3) Upload the photo (if any) and attach it. Non-fatal: the account is
        //    already created, so a failed upload just means "add it later".
        if (file) {
            try {
                const body = new FormData();
                body.append("file", file);
                const up = await fetch("/api/upload/avatar", {
                    method: "POST",
                    body,
                });
                const json = await up.json();
                if (up.ok && json.url) await updateAvatarAction(json.url);
            } catch {
                /* leave the avatar unset; user can add it in settings */
            }
        }

        router.push(next);
        router.refresh();
    };

    const initials = (form.name || form.username || "?")
        .trim()
        .slice(0, 2)
        .toUpperCase();

    return (
        <section className="min-h-[70vh] grid place-items-center px-4 sm:px-6 py-10 sm:py-16 bg-eco-bg">
            <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-8">
                <div className="flex items-center gap-2 mb-6">
                    <i className="fa-solid fa-seedling text-eco-green text-3xl" />
                    <span className="text-2xl font-bold text-eco-dark">
                        {t("auth.brand")}
                    </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold mb-1">
                    {t("auth.registerTitle")}
                </h1>
                <p className="text-sm text-gray-500 mb-5">
                    {t("auth.registerSub")}
                </p>

                {error && (
                    <div
                        className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-3">
                    {/* Avatar upload (optional) */}
                    <div className="flex items-center gap-4">
                        <span className="inline-flex items-center justify-center w-16 h-16 rounded-full overflow-hidden bg-eco-green/10 ring-1 ring-eco-green/20 text-eco-green text-lg font-semibold shrink-0">
                            {preview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={preview}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                initials
                            )}
                        </span>
                        <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                                <label className="inline-flex items-center gap-2 rounded-md bg-white border border-gray-200 px-3.5 py-2 text-sm font-medium hover:bg-gray-50 cursor-pointer min-h-[40px]">
                                    <i className="fa-solid fa-arrow-up-from-bracket text-eco-green text-xs" />
                                    {t("settings.uploadPhoto")}
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={onPickFile}
                                        className="hidden"
                                    />
                                </label>
                                {preview && (
                                    <button
                                        type="button"
                                        onClick={clearPhoto}
                                        className="rounded-md px-3.5 py-2 text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 min-h-[40px]"
                                    >
                                        {t("settings.removePhoto")}
                                    </button>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                {t("auth.photoOptionalHint")}
                            </p>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500" htmlFor="name">
                            {t("auth.fullName")}
                        </label>
                        <input
                            id="name"
                            required
                            value={form.name}
                            onChange={set("name")}
                            autoComplete="name"
                            className="eco-input"
                            placeholder={t("auth.fullNamePh")}
                        />
                    </div>
                    <div>
                        <label
                            className="text-xs text-gray-500"
                            htmlFor="username"
                        >
                            {t("auth.username")}
                        </label>
                        <input
                            id="username"
                            required
                            value={form.username}
                            onChange={set("username")}
                            autoComplete="username"
                            className="eco-input"
                            placeholder={t("auth.usernamePh")}
                        />
                    </div>
                    <div>
                        <label
                            className="text-xs text-gray-500"
                            htmlFor="email"
                        >
                            {t("checkout.email")}
                        </label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={form.email}
                            onChange={set("email")}
                            autoComplete="email"
                            className="eco-input"
                            placeholder={t("auth.emailPh")}
                        />
                    </div>
                    <div>
                        <label
                            className="text-xs text-gray-500"
                            htmlFor="password"
                        >
                            {t("auth.passwordHint")}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                minLength={8}
                                required
                                value={form.password}
                                onChange={set("password")}
                                autoComplete="new-password"
                                className="eco-input pr-11"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={
                                    showPassword
                                        ? t("auth.hidePassword")
                                        : t("auth.showPassword")
                                }
                                aria-pressed={showPassword}
                                className="absolute inset-y-0 right-0 flex items-center justify-center w-11 text-gray-400 hover:text-eco-green"
                            >
                                <i
                                    className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}
                                />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label
                            className="text-xs text-gray-500"
                            htmlFor="phone"
                        >
                            {t("auth.phoneOptional")}
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={form.phone}
                            onChange={set("phone")}
                            autoComplete="tel"
                            className="eco-input"
                            placeholder={t("auth.phonePh")}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full py-3 rounded-md bg-eco-green text-white font-medium hover:bg-emerald-600 disabled:opacity-60 min-h-[44px]"
                    >
                        {busy ? t("auth.creating") : t("auth.createAccount")}
                    </button>
                </form>

                <div className="text-sm text-center mt-6 text-gray-500">
                    {t("auth.haveAccount")}{" "}
                    <Link href="/login" className="text-eco-green font-medium">
                        {t("auth.login")}
                    </Link>
                </div>
            </div>
        </section>
    );
}
