"use server";

import { revalidatePath } from "next/cache";

import { logAudit, requireManager, requireOwner } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email/send";
import { unsafeAdminClient } from "@/lib/supabase/admin";

export type EmailActionState = {
  error?: string;
  ok?: string;
  fieldErrors?: Record<string, string>;
};

function str(fd: FormData, k: string) {
  return ((fd.get(k) as string | null) ?? "").trim();
}

// ---------------------------------------------------------------------------
// Template Manager — create / update / archive
// ---------------------------------------------------------------------------
export async function createTemplate(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const member = await requireManager();
  const name = str(formData, "name");
  const subject = str(formData, "subject");
  const body = str(formData, "body");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Poné un nombre.";
  if (!subject) fieldErrors.subject = "Poné un asunto.";
  if (!body) fieldErrors.body = "Escribí el cuerpo.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = unsafeAdminClient();
  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      restaurant_id: member.restaurantId,
      name,
      subject,
      body,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "template.created",
    entityType: "email_template",
    entityId: data.id,
    metadata: { name },
  });

  revalidatePath("/emails");
  return { ok: "Template creado." };
}

export async function updateTemplate(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const member = await requireManager();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const subject = str(formData, "subject");
  const body = str(formData, "body");
  const status = str(formData, "status");
  if (!id) return { error: "Falta el template." };

  const allowed = ["draft", "active", "archived"];
  const supabase = unsafeAdminClient();
  const { error } = await supabase
    .from("email_templates")
    .update({
      name,
      subject,
      body,
      ...(allowed.includes(status) ? { status: status as "draft" } : {}),
    })
    .eq("id", id)
    .eq("restaurant_id", member.restaurantId);
  if (error) return { error: error.message };

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "template.updated",
    entityType: "email_template",
    entityId: id,
    metadata: { status },
  });

  revalidatePath("/emails");
  return { ok: "Template actualizado." };
}

export async function archiveTemplate(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = str(formData, "id");
  if (!id) return;

  const supabase = unsafeAdminClient();
  await supabase
    .from("email_templates")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("restaurant_id", member.restaurantId);

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "template.archived",
    entityType: "email_template",
    entityId: id,
  });

  revalidatePath("/emails");
}

// ---------------------------------------------------------------------------
// Test Send — owner sends a real (or mock) email to their own inbox
// ---------------------------------------------------------------------------
export async function sendTestEmailAction(
  _prev: EmailActionState,
  formData: FormData,
): Promise<EmailActionState> {
  const owner = await requireOwner();
  const to = str(formData, "to");
  const subject = str(formData, "subject") || "Email de prueba · Tips";
  const body = str(formData, "body") || "<p>Funciona. Este es un email de prueba de Tips.</p>";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
    return { error: "Email de destino inválido." };

  const outcome = await sendTestEmail({
    restaurantId: owner.restaurantId,
    userId: owner.userId,
    to,
    subject,
    html: body,
  });

  revalidatePath("/emails");
  if (outcome.status === "sent") return { ok: `Enviado a ${to}.` };
  if (outcome.status === "skipped")
    return { error: outcome.error ?? "Email provider not configured" };
  return { error: outcome.error ?? "No se pudo enviar." };
}
