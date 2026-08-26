"use server";

// app/dashboard/messages/_actions.js
// Admin-only mutations for contact-form messages.

import { revalidatePath } from "next/cache";
import { prisma } from "../../../lib/prisma";
import { requireRole } from "../../../lib/auth-helpers";

export async function setMessageReadAction(id, isRead) {
    await requireRole("ADMIN");
    if (typeof id !== "string" || !id) return { ok: false };
    await prisma.contactMessage.update({
        where: { id },
        data: { isRead: Boolean(isRead) },
    });
    revalidatePath("/dashboard/messages");
    return { ok: true };
}

export async function deleteMessageAction(id) {
    await requireRole("ADMIN");
    if (typeof id !== "string" || !id) return { ok: false };
    await prisma.contactMessage.delete({ where: { id } });
    revalidatePath("/dashboard/messages");
    return { ok: true };
}
