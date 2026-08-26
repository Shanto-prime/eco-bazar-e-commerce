// app/dashboard/messages/page.js   ADMIN only.
// Inbox for public /contact form submissions.

import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth-helpers";
import { getT } from "../../../lib/i18n/server";
import LocalTime from "../../../components/LocalTime";
import MessageRowActions from "./MessageRowActions";

export default async function DashboardMessages() {
    const { t } = await getT();
    await requireRole("ADMIN", "/dashboard/messages");

    const messages = await prisma.contactMessage.findMany({
        orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
        take: 200,
    });

    return (
        <div>
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold">
                    {t("dashboard.messages")}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {t("dashboard.messagesSubtitle", {
                        count: String(messages.length),
                    })}
                </p>
            </header>

            {messages.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500 bg-white">
                    {t("dashboard.messagesEmpty")}
                </div>
            ) : (
                <ul className="space-y-3">
                    {messages.map((m) => (
                        <li
                            key={m.id}
                            className={`bg-white border rounded-lg p-4 sm:p-5 ${
                                m.isRead
                                    ? "border-gray-200"
                                    : "border-eco-green/40 ring-1 ring-eco-green/10"
                            }`}
                        >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold truncate">
                                            {m.name}
                                        </span>
                                        <a
                                            href={`mailto:${m.email}`}
                                            className="text-sm text-eco-green underline break-all"
                                        >
                                            {m.email}
                                        </a>
                                        {!m.isRead && (
                                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-eco-green text-white rounded-full px-2 py-0.5">
                                                {t("dashboard.messagesUnread")}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        <LocalTime value={m.createdAt} />
                                    </div>
                                </div>
                                <MessageRowActions
                                    id={m.id}
                                    isRead={m.isRead}
                                />
                            </div>
                            <div className="mt-3 text-sm">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                                    {t("dashboard.messagesSubject")}
                                </div>
                                <div className="font-medium">{m.subject}</div>
                            </div>
                            <div className="mt-3 text-sm">
                                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                                    {t("dashboard.messagesMessage")}
                                </div>
                                <p className="whitespace-pre-wrap break-words text-gray-800">
                                    {m.message}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
