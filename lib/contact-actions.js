"use server";

// lib/contact-actions.js
// Server action for the public /contact form. Anyone (guest or signed-in) can
// submit; rows land in ContactMessage and are visible from
// /dashboard/messages (ADMIN only).

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "./prisma";

const contactSchema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().email().max(200),
    subject: z.string().trim().min(6).max(200),
    message: z.string().trim().min(10).max(5000),
});

export async function submitContactMessageAction(input) {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) {
        return { ok: false, error: "invalid" };
    }
    await prisma.contactMessage.create({ data: parsed.data });
    revalidatePath("/dashboard/messages");
    return { ok: true };
}
