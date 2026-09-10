"use client";

// lib/CartContext.jsx
// Global cart, wishlist, and toast state for the whole app.
// - Pure React Context + useReducer (no external dependency).
// - Cart and wishlist persist to localStorage so they survive reloads.
// - Exposes a single useCart() hook with everything the UI needs.

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useReducer,
    useState,
    useCallback,
} from "react";
import { useT } from "./i18n/LanguageProvider";
import { getCart, saveCart, mergeCart, repriceCart } from "./cart-actions";

// ---------- Coupons -----------------------------------------------------------
const COUPONS = {
    ECO10: { type: "percent", value: 10, label: "10% off your order" },
    ECO20: { type: "percent", value: 20, label: "20% off your order" },
    FREE5: { type: "flat", value: 5, label: "$5 off your order" },
};

// ---------- Reducer -----------------------------------------------------------
const initialState = {
    items: [], // [{ slug, name, icon, image, price, qty }]
    wishlist: [], // [slug, slug, ...]
    coupon: null, // { code, type, value, label } | null
};

function reducer(state, action) {
    switch (action.type) {
        case "HYDRATE":
            return { ...state, ...action.payload };

        case "ADD_ITEM": {
            const { product, qty = 1 } = action;
            const existing = state.items.find((i) => i.slug === product.slug);
            const items = existing
                ? state.items.map((i) =>
                      i.slug === product.slug ? { ...i, qty: i.qty + qty } : i,
                  )
                : [
                      ...state.items,
                      {
                          slug: product.slug,
                          name: product.name,
                          icon: product.icon,
                          image: product.image ?? null,
                          price: product.price,
                          qty,
                      },
                  ];
            return { ...state, items };
        }

        case "REMOVE_ITEM":
            return {
                ...state,
                items: state.items.filter((i) => i.slug !== action.slug),
            };

        // Refresh prices/names from the DB and drop products that no longer exist.
        //
        // MUST return the SAME state object when nothing changed: the effect that
        // dispatches this runs off the cart contents, so returning a new object
        // unconditionally would re-trigger it forever.
        case "REPRICE": {
            const fresh = action.bySlug; // Map<slug, {name, price, image}>
            const missing = action.missing; // Set<slug>
            let changed = false;

            const items = [];
            for (const it of state.items) {
                if (missing.has(it.slug)) {
                    changed = true;
                    continue;
                }
                const f = fresh.get(it.slug);
                if (!f) {
                    items.push(it);
                    continue;
                }
                if (
                    f.price !== it.price ||
                    f.name !== it.name ||
                    f.image !== it.image
                ) {
                    changed = true;
                    items.push({
                        ...it,
                        price: f.price,
                        name: f.name,
                        image: f.image,
                    });
                } else {
                    items.push(it);
                }
            }

            return changed ? { ...state, items } : state;
        }

        case "UPDATE_QTY": {
            const qty = Math.max(1, action.qty);
            return {
                ...state,
                items: state.items.map((i) =>
                    i.slug === action.slug ? { ...i, qty } : i,
                ),
            };
        }

        case "CLEAR_CART":
            return { ...state, items: [], coupon: null };

        case "APPLY_COUPON":
            return { ...state, coupon: action.coupon };

        case "TOGGLE_WISHLIST": {
            const has = state.wishlist.includes(action.slug);
            return {
                ...state,
                wishlist: has
                    ? state.wishlist.filter((s) => s !== action.slug)
                    : [...state.wishlist, action.slug],
            };
        }

        default:
            return state;
    }
}

// ---------- Context ----------------------------------------------------------
const CartContext = createContext(null);

export function CartProvider({ children, user = null }) {
    const t = useT();
    const [state, dispatch] = useReducer(reducer, initialState);
    const [hydrated, setHydrated] = useState(false);
    const [toasts, setToasts] = useState([]); // [{ id, kind, text, duration }]

    // The signed-in user's id (null when anonymous). Drives wishlist gating and
    // cloud cart sync. Threaded from the server layout via the `user` prop.
    const userId = user?.id || null;

    // A live mirror of state so async callbacks read the latest cart without
    // being in their dependency arrays.
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Who the localStorage cart belongs to: a userId (their own saved cart's
    // mirror) or null (a guest cart). This distinguishes "guest just logged in →
    // merge their cart in" from "returning user reloaded → the DB is the truth"
    // (merging on every reload would compound quantities) and from "a different
    // user is on this browser → don't leak the previous cart".
    const localOwnerRef = useRef(null);

    // Load from localStorage once, on mount.
    //
    // The WISHLIST is intentionally never read from localStorage: it is a
    // per-user, signed-in-only feature persisted in the DB (see the cloud sync
    // below), so a guest   or a different user on this browser   must never see a
    // wishlist that isn't theirs. The CART is loaded only when the stored blob is
    // a genuine guest cart (no owner) or belongs to the current user; another
    // user's cart is dropped rather than shown.
    useEffect(() => {
        try {
            const raw = localStorage.getItem("ecobazar-cart-v1");
            if (raw) {
                const parsed = JSON.parse(raw);
                const owner = parsed.ownerId ?? null;
                localOwnerRef.current = owner;
                const mine = owner === null || owner === userId; // guest cart or my own
                dispatch({
                    type: "HYDRATE",
                    payload: {
                        items: mine ? parsed.items || [] : [],
                        wishlist: [], // DB-only; never from localStorage
                        coupon: mine ? parsed.coupon || null : null,
                    },
                });
            }
        } catch {}
        setHydrated(true);
        // Runs once; `userId` is already the SSR-provided value on first client render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist the CART to localStorage on every change (after first hydration),
    // tagged with its current owner. The wishlist is deliberately NOT written here
    //   it lives in the DB per user, so it can never leak via this shared blob.
    useEffect(() => {
        if (!hydrated) return;
        try {
            localStorage.setItem(
                "ecobazar-cart-v1",
                JSON.stringify({
                    items: state.items,
                    coupon: state.coupon,
                    ownerId: userId,
                }),
            );
        } catch {}
    }, [state.items, state.coupon, hydrated, userId]);

    // ---- Cloud cart (logged-in users) ---------------------------------------
    // `cloudReady` gates DB writes: it flips true only AFTER the initial sync has
    // hydrated the cart, so we never overwrite the saved cart with stale local
    // data mid-sync.
    const [cloudReady, setCloudReady] = useState(false);
    const prevUserId = useRef(undefined);

    useEffect(() => {
        if (!hydrated) return;
        const prev = prevUserId.current;
        prevUserId.current = userId;

        // Logged out (or logged out just now): clear cart + wishlist locally   they
        // are safely persisted in the DB and will be restored on next login. This
        // also prevents one account's items lingering for the next visitor.
        if (!userId) {
            if (prev) {
                dispatch({
                    type: "HYDRATE",
                    payload: { items: [], wishlist: [], coupon: null },
                });
                try {
                    localStorage.removeItem("ecobazar-cart-v1");
                } catch {}
                localOwnerRef.current = null;
            }
            setCloudReady(false);
            return;
        }

        if (prev === userId) return; // already synced for this user

        setCloudReady(false);
        let cancelled = false;
        const localOwner = localOwnerRef.current;
        const localItems = stateRef.current.items;
        const localCoupon = stateRef.current.coupon;

        (async () => {
            try {
                if (localOwner == null && localItems.length) {
                    // Guest cart present → merge it into the user's saved cart (summing
                    // quantities). The wishlist comes from the DB (the user's own).
                    const merged = await mergeCart(localItems, localCoupon);
                    if (cancelled) return;
                    if (merged)
                        dispatch({
                            type: "HYDRATE",
                            payload: {
                                items: merged.items,
                                wishlist: merged.wishlist || [],
                                coupon: merged.coupon ?? null,
                            },
                        });
                } else {
                    // Returning or different user → the DB cart + wishlist are
                    // authoritative (no summing, and never another user's data).
                    const dbCart = await getCart();
                    if (cancelled) return;
                    dispatch({
                        type: "HYDRATE",
                        payload: {
                            items: dbCart?.items || [],
                            wishlist: dbCart?.wishlist || [],
                            coupon: dbCart?.coupon ?? null,
                        },
                    });
                }
                localOwnerRef.current = userId;
            } catch {
                // Network/DB hiccup: keep whatever is local; don't block the UI.
            } finally {
                if (!cancelled) setCloudReady(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId, hydrated]);

    // Persist cart + wishlist changes to the DB while logged in (debounced).
    useEffect(() => {
        if (!hydrated || !userId || !cloudReady) return;
        const id = setTimeout(() => {
            saveCart(state.items, state.coupon, state.wishlist).catch(() => {});
        }, 600);
        return () => clearTimeout(id);
    }, [
        state.items,
        state.coupon,
        state.wishlist,
        hydrated,
        userId,
        cloudReady,
    ]);

    // ---- Keep cart prices honest ---------------------------------------------
    // Items carry the price they had when they were added. A Hot Deals offer
    // starting or ending afterwards would leave the cart showing a figure checkout
    // won't use   and when an offer EXPIRES, the buyer would be charged more than
    // the summary said. Re-read the authoritative prices whenever the set of items
    // changes (and once on load).
    //
    // The dependency is the sorted SLUG list, not `state.items`: repricing changes
    // item prices, so depending on the items themselves would re-run this on its
    // own result. Paired with the REPRICE reducer case returning the same state
    // object when nothing changed, that keeps it from looping.
    const slugKey = state.items
        .map((i) => i.slug)
        .sort()
        .join("|");

    useEffect(() => {
        if (!hydrated || !slugKey) return;
        let cancelled = false;

        (async () => {
            try {
                const res = await repriceCart(stateRef.current.items);
                if (cancelled || !res) return;
                dispatch({
                    type: "REPRICE",
                    bySlug: new Map((res.items || []).map((i) => [i.slug, i])),
                    missing: new Set(res.missing || []),
                });
            } catch {
                // Offline or a transient failure   keep showing what we have. Checkout
                // still recomputes, so this can never cause a wrong charge.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [slugKey, hydrated]);

    // Toast helper   pushes onto a queue (newest first). The Toast component owns
    // each toast's countdown/auto-dismiss (so it can pause on hover), then calls
    // dismissToast(). Duration is clamped to a 3s minimum per the UX spec.
    const dismissToast = useCallback((id) => {
        setToasts((list) => list.filter((x) => x.id !== id));
    }, []);

    const showToast = useCallback((text, kind = "success", duration = 3000) => {
        const id = Math.random().toString(36).slice(2);
        setToasts((list) => [
            { id, kind, text, duration: Math.max(3000, duration) },
            ...list,
        ]);
        return id;
    }, []);

    // Derived totals.
    const subtotal = state.items.reduce((s, i) => s + i.price * i.qty, 0);
    let discount = 0;
    if (state.coupon) {
        discount =
            state.coupon.type === "percent"
                ? subtotal * (state.coupon.value / 100)
                : state.coupon.value;
        discount = Math.min(discount, subtotal);
    }
    const shipping = 0;
    const total = Math.max(0, subtotal - discount + shipping);
    const itemCount = state.items.reduce((s, i) => s + i.qty, 0);

    // High-level actions.
    const addItem = useCallback(
        (product, qty = 1) => {
            dispatch({ type: "ADD_ITEM", product, qty });
            showToast(t("toast.addedToCart", { qty, name: product.name }));
        },
        [showToast, t],
    );

    const removeItem = useCallback(
        (slug) => {
            const i = state.items.find((x) => x.slug === slug);
            dispatch({ type: "REMOVE_ITEM", slug });
            if (i)
                showToast(t("toast.removedFromCart", { name: i.name }), "info");
        },
        [state.items, showToast, t],
    );

    const updateQty = useCallback((slug, qty) => {
        dispatch({ type: "UPDATE_QTY", slug, qty });
    }, []);

    const clearCart = useCallback(() => dispatch({ type: "CLEAR_CART" }), []);

    const applyCoupon = useCallback(
        (code) => {
            const key = code.trim().toUpperCase();
            if (!key) return { ok: false, error: t("toast.enterCoupon") };
            const def = COUPONS[key];
            if (!def) {
                showToast(t("toast.invalidCoupon"), "error");
                return { ok: false, error: t("toast.invalidCoupon") };
            }
            // Localized, code-derived label (falls back to the English COUPONS label).
            const label = t(`coupon.${key}`);
            dispatch({
                type: "APPLY_COUPON",
                coupon: { code: key, ...def, label },
            });
            showToast(t("toast.couponApplied", { label }));
            return { ok: true };
        },
        [showToast, t],
    );

    const toggleWishlist = useCallback(
        (slug, name) => {
            // Wishlist is a signed-in-only feature. Guests are prompted to log in and
            // nothing is added.
            if (!userId) {
                showToast(t("toast.wishlistLoginRequired"), "error");
                return;
            }
            const has = state.wishlist.includes(slug);
            dispatch({ type: "TOGGLE_WISHLIST", slug });
            const nm = name || t("common.item", {});
            showToast(
                has
                    ? t("toast.removedFromWishlist", { name: nm })
                    : t("toast.addedToWishlist", { name: nm }),
                "info",
            );
        },
        [userId, state.wishlist, showToast, t],
    );

    const value = {
        items: state.items,
        wishlist: state.wishlist,
        coupon: state.coupon,
        isAuthed: !!userId,
        itemCount,
        subtotal,
        discount,
        shipping,
        total,
        hydrated,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        applyCoupon,
        toggleWishlist,
        showToast,
        toasts,
        dismissToast,
    };

    return (
        <CartContext.Provider value={value}>{children}</CartContext.Provider>
    );
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
    return ctx;
}
