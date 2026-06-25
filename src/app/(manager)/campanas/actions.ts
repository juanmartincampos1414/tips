"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isReachable, resolveAudience } from "@/lib/campaigns";
import { sendGuestEmail } from "@/lib/email/send";
import { logAudit, requireManager } from "@/lib/auth";
import { getCrmData, syncCampaignConversions } from "@/lib/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CampaignChannel,
  CampaignRecipientStatus,
} from "@/lib/database.types";

export type CampaignActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function str(fd: FormData, k: string) {
  return ((fd.get(k) as string | null) ?? "").trim();
}

/** Count of reachable guests for a segment+channel (projection for the builder). */
async function projectAudience(
  restaurantId: string,
  segment: string,
  channel: CampaignChannel,
) {
  const { guests } = await getCrmData(restaurantId);
  return resolveAudience(guests, segment).filter((g) => isReachable(g, channel));
}

export async function createCampaign(
  _prev: CampaignActionState,
  formData: FormData,
): Promise<CampaignActionState> {
  const member = await requireManager();
  const name = str(formData, "name");
  const description = str(formData, "description");
  const channel = (str(formData, "channel") || "email") as CampaignChannel;
  const segment = str(formData, "segment");
  const templateId = str(formData, "template_id");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Poné un nombre.";
  if (!segment) fieldErrors.segment = "Elegí un segmento.";
  if (channel === "email" && !templateId)
    fieldErrors.template_id = "Elegí una plantilla.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const audience = await projectAudience(member.restaurantId, segment, channel);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      restaurant_id: member.restaurantId,
      name,
      description: description || null,
      channel,
      segment,
      template_id: channel === "email" ? templateId : null,
      status: "draft",
      audience_count: audience.length,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "campaign.created",
    entityType: "campaign",
    entityId: data.id,
    metadata: { name, channel, segment, audience: audience.length },
  });

  redirect(`/campanas/${data.id}`);
}

export async function sendCampaign(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = str(formData, "id");
  if (!id) return;

  const supabase = createAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("restaurant_id", member.restaurantId)
    .maybeSingle();
  if (!campaign || campaign.status !== "draft") return;

  const channel = campaign.channel as CampaignChannel;
  const audience = await projectAudience(member.restaurantId, campaign.segment, channel);
  if (audience.length === 0) {
    await supabase
      .from("campaigns")
      .update({ audience_count: 0 })
      .eq("id", id);
    revalidatePath(`/campanas/${id}`);
    return;
  }

  // Resolve template content (email channel).
  let subject = campaign.name;
  let html = `<p>${campaign.description ?? campaign.name}</p>`;
  if (channel === "email" && campaign.template_id) {
    const { data: tpl } = await supabase
      .from("email_templates")
      .select("subject, body")
      .eq("id", campaign.template_id)
      .maybeSingle();
    if (tpl) {
      subject = tpl.subject;
      html = tpl.body;
    }
  }

  await supabase
    .from("campaigns")
    .update({ status: "sending", sent_at: new Date().toISOString(), audience_count: audience.length })
    .eq("id", id);

  // Freeze the audience snapshot (chunked for large audiences).
  for (let i = 0; i < audience.length; i += 500) {
    await supabase.from("campaign_audiences").upsert(
      audience.slice(i, i + 500).map((g) => ({
        campaign_id: id,
        guest_id: g.id,
        segment_snapshot: g.segment,
      })),
      { onConflict: "campaign_id,guest_id", ignoreDuplicates: true },
    );
  }

  // Dispatch per guest + collect recipient rows. NOTE: this is a per-guest loop;
  // it's fine for mock/moderate audiences, but a real send to many thousands
  // needs a queue / Resend batch API (each real send is an external call) —
  // tracked as a follow-up before high-volume real campaigns go live.
  const recipients: {
    campaign_id: string;
    guest_id: string;
    channel: CampaignChannel;
    status: CampaignRecipientStatus;
    email_log_id: string | null;
    reason: string | null;
  }[] = [];

  for (const g of audience) {
    if (channel === "email") {
      const outcome = await sendGuestEmail({
        restaurantId: member.restaurantId,
        userId: member.userId,
        guest: { id: g.id, email: g.email, marketing_consent: g.marketing_consent },
        subject,
        html,
        templateId: campaign.template_id,
      });
      const status: CampaignRecipientStatus =
        outcome.status === "sent"
          ? "pending"
          : outcome.status === "skipped"
            ? "skipped"
            : "failed";
      recipients.push({
        campaign_id: id,
        guest_id: g.id,
        channel,
        status,
        email_log_id: outcome.logId,
        reason: outcome.error ?? null,
      });
    } else {
      // WhatsApp is prepared but has no live provider yet.
      recipients.push({
        campaign_id: id,
        guest_id: g.id,
        channel,
        status: "skipped",
        email_log_id: null,
        reason: "WhatsApp preparado · sin proveedor configurado",
      });
    }
  }

  for (let i = 0; i < recipients.length; i += 500) {
    await supabase
      .from("campaign_recipients")
      .upsert(recipients.slice(i, i + 500), { onConflict: "campaign_id,guest_id", ignoreDuplicates: false });
  }

  // Last-touch attribution pointer on each targeted guest (chunked IN list).
  const audienceIds = audience.map((g) => g.id);
  const stampedAt = new Date().toISOString();
  for (let i = 0; i < audienceIds.length; i += 500) {
    await supabase
      .from("guests")
      .update({ last_campaign_id: id, last_campaign_sent_at: stampedAt })
      .in("id", audienceIds.slice(i, i + 500));
  }

  await supabase.from("campaigns").update({ status: "completed" }).eq("id", id);

  // Seed any conversions that already fall in the window.
  await syncCampaignConversions(member.restaurantId);

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "campaign.sent",
    entityType: "campaign",
    entityId: id,
    metadata: { channel, segment: campaign.segment, audience: audience.length },
  });

  revalidatePath("/campanas");
  revalidatePath(`/campanas/${id}`);
}

export async function archiveCampaign(formData: FormData): Promise<void> {
  const member = await requireManager();
  const id = str(formData, "id");
  if (!id) return;

  const supabase = createAdminClient();
  await supabase
    .from("campaigns")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("restaurant_id", member.restaurantId);

  await logAudit({
    restaurantId: member.restaurantId,
    userId: member.userId,
    action: "campaign.archived",
    entityType: "campaign",
    entityId: id,
  });

  revalidatePath("/campanas");
}
