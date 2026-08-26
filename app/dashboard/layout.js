// app/dashboard/layout.js
// Shared chrome for every /dashboard/* route.
// Renders the sidebar (drawer on mobile, persistent on desktop) and a tiny
// top bar with the signed-in user + sign-out button. Reuses the public site
// header/footer from the root layout.

import { requireAuth } from "../../lib/auth-helpers";
import { getT } from "../../lib/i18n/server";
import { prisma } from "../../lib/prisma";
import DashboardShell from "./_components/DashboardShell";

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t("meta.dashboardTitle") };
}

export default async function DashboardLayout({ children }) {
    // Defense-in-depth: middleware already redirects anonymous users, but if
    // someone disables it, requireAuth still catches the request.
    const user = await requireAuth();

    // Pending profile-change requests power the sidebar badge. Only the admin can
    // action them, so only the admin pays for the query everyone else skips it.
    const counts = {};
    if (user.role === "ADMIN") {
        const [pendingRequests, pendingApprovals, unreadMessages] =
            await Promise.all([
                prisma.profileChangeRequest.count({
                    where: { status: "PENDING" },
                }),
                prisma.approvalRequest.count({ where: { status: "PENDING" } }),
                prisma.contactMessage.count({ where: { isRead: false } }),
            ]);
        counts.pendingRequests = pendingRequests;
        counts.pendingApprovals = pendingApprovals;
        counts.unreadMessages = unreadMessages;
    }

    return (
        <DashboardShell user={user} counts={counts}>
            {children}
        </DashboardShell>
    );
}
