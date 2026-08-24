"use client";

// app/login/LoginForm.jsx
// Credentials form + optional OAuth buttons (Google/Facebook).
// Buttons render only when the parent server component passes the matching
// hasX=true flag, which means the env vars are set.

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useT } from "../../lib/i18n/LanguageProvider";

export default function LoginForm({ hasGoogle, hasFacebook }) {
    const router = useRouter();
    const sp = useSearchParams();
    const t = useT();
    // Default to home when no ?next= was passed. Middleware sets `?next=<path>`
    // when it redirects a specific protected page (e.g. /wishlist), so that
    // flow still returns the user to their intended destination; only "walked
    // to /login from a nav link" defaults to home. Sending everyone to
    // /dashboard by default sent every signed-in customer into the dashboard
    // router even when they were browsing the storefront.
    const next = sp.get("next") || "/";

    const okNotice =
        sp.get("reset") === "ok"
            ? t("auth.passwordUpdated")
            : sp.get("verify") === "ok"
              ? t("auth.emailVerified")
              : null;
    const warnNotice =
        sp.get("verify") === "invalid" ? t("auth.verifyInvalid") : null;

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const onSubmit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await signIn("credentials", {
            username,
            password,
            redirect: false,
        });
        setBusy(false);
        if (res?.error) {
            setError(t("auth.invalidCredentials"));
            return;
        }
        router.push(next);
        router.refresh();
    };

    // Public demo-account quick-fill. These accounts exist in every
    // environment (local + VPS) and are read-only: every mutating server
    // action returns a "this is a demo account" error via
    // lib/demo-accounts.js. Safe to expose to any visitor.
    const DEMO_ACCOUNTS = [
        { label: "Admin",       username: "test-admin", password: "test-admin" },
        { label: "Moderator",   username: "mod",        password: "moderator"  },
        { label: "Customer",    username: "customer",   password: "customer"   },
        { label: "Customer 2",  username: "customer-2", password: "customer-2" },
    ];
    const fillAccount = (acc) => {
        setUsername(acc.username);
        setPassword(acc.password);
        setError(null);
    };

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
                    {t("auth.loginHeading")}
                </h1>
                <p className="text-sm text-gray-500 mb-5">
                    {t("auth.loginSub")}
                </p>

                <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3">
                    <div className="font-semibold mb-2">
                        {t("auth.demoAccounts")}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <button
                                key={acc.username}
                                type="button"
                                onClick={() => fillAccount(acc)}
                                className="py-2 rounded-md bg-eco-green text-white font-medium hover:bg-emerald-600 transition min-h-[36px]"
                            >
                                {acc.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-emerald-700">
                        Click to auto-fill, then press{" "}
                        {t("auth.loginHeading")}.
                    </p>
                </div>

                {okNotice && (
                    <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-3">
                        {okNotice}
                    </div>
                )}

                {warnNotice && (
                    <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
                        {warnNotice}
                    </div>
                )}

                {error && (
                    <div
                        className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-3">
                    <div>
                        <label
                            className="text-xs text-gray-500"
                            htmlFor="username"
                        >
                            {t("auth.usernameOrEmail")}
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="eco-input"
                            placeholder={t("auth.usernameOrEmailPh")}
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between">
                            <label
                                className="text-xs text-gray-500"
                                htmlFor="password"
                            >
                                {t("auth.password")}
                            </label>
                            <Link
                                href="/forgot-password"
                                className="text-xs text-eco-green font-medium"
                            >
                                {t("auth.forgotPassword")}
                            </Link>
                        </div>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full py-3 rounded-md bg-eco-green text-white font-medium hover:bg-emerald-600 disabled:opacity-60 min-h-[44px]"
                    >
                        {busy ? t("auth.signingIn") : t("auth.loginHeading")}
                    </button>
                </form>

                {(hasGoogle || hasFacebook) && (
                    <>
                        <div className="flex items-center gap-3 my-5 text-xs text-gray-400">
                            <div className="flex-1 h-px bg-gray-200" />{" "}
                            {t("auth.or")}{" "}
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>

                        <div className="space-y-3">
                            {hasGoogle && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        signIn("google", { callbackUrl: next })
                                    }
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-md border border-gray-200 hover:border-eco-green transition min-h-[44px]"
                                >
                                    <i className="fa-brands fa-google text-lg" />
                                    {t("auth.continueGoogle")}
                                </button>
                            )}
                            {hasFacebook && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        signIn("facebook", {
                                            callbackUrl: next,
                                        })
                                    }
                                    className="w-full flex items-center justify-center gap-3 py-3 rounded-md border border-gray-200 hover:border-eco-green transition min-h-[44px]"
                                >
                                    <i className="fa-brands fa-facebook-f text-lg text-[#1877f2]" />
                                    {t("auth.continueFacebook")}
                                </button>
                            )}
                        </div>
                    </>
                )}

                <div className="text-sm text-center mt-6 text-gray-500">
                    {t("auth.noAccount")}{" "}
                    <Link
                        href="/register"
                        className="text-eco-green font-medium"
                    >
                        {t("auth.createOne")}
                    </Link>
                </div>
            </div>
        </section>
    );
}
