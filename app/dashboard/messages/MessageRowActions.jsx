"use client";

import { useTransition } from "react";
import { useT } from "../../../lib/i18n/LanguageProvider";
import {
    setMessageReadAction,
    deleteMessageAction,
} from "./_actions";

export default function MessageRowActions({ id, isRead }) {
    const t = useT();
    const [pending, startTransition] = useTransition();

    const toggleRead = () =>
        startTransition(async () => {
            await setMessageReadAction(id, !isRead);
        });

    const onDelete = () => {
        if (!confirm(t("dashboard.messagesConfirmDelete"))) return;
        startTransition(async () => {
            await deleteMessageAction(id);
        });
    };

    return (
        <div className="flex items-center gap-2 shrink-0">
            <button
                type="button"
                onClick={toggleRead}
                disabled={pending}
                className="text-xs font-medium text-gray-600 hover:text-eco-green px-2 py-1 rounded border border-gray-200 hover:border-eco-green disabled:opacity-60"
            >
                {isRead
                    ? t("dashboard.messagesMarkUnread")
                    : t("dashboard.messagesMarkRead")}
            </button>
            <button
                type="button"
                onClick={onDelete}
                disabled={pending}
                className="text-xs font-medium text-gray-500 hover:text-red-600 px-2 py-1 rounded border border-gray-200 hover:border-red-200 disabled:opacity-60"
            >
                {t("dashboard.messagesDelete")}
            </button>
        </div>
    );
}
