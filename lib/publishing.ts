import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFreshAccount } from "@/lib/accounts";
import { composeText, getRules, validatePost } from "@/lib/network-rules";
import type { PostStatus } from "@/lib/posts";
import { getPublisher, type PublishResult } from "@/lib/publishers";
import type { Database, Json } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;

export type PublishOutcome = { ok: true; url: string } | { ok: false; error: string } | { ok: false; skipped: true };

// Publie une publication. Règle 5 : la ligne passe d'abord en « publishing » par une mise à jour
// conditionnelle (verrou) ; si une autre exécution l'a déjà prise, on n'envoie rien.
// Aucune nouvelle tentative automatique (NF-09).
export async function publishPost(
  admin: Admin,
  params: { postId: string; ownerId: string; allowedFrom: readonly PostStatus[] },
): Promise<PublishOutcome> {
  const { data: current } = await admin
    .from("posts")
    .select("attempts")
    .eq("id", params.postId)
    .eq("owner_id", params.ownerId)
    .maybeSingle();
  if (!current) return { ok: false, skipped: true };

  const { data: post } = await admin
    .from("posts")
    .update({ status: "publishing", attempts: current.attempts + 1, error_message: null })
    .eq("id", params.postId)
    .eq("owner_id", params.ownerId)
    .in("status", [...params.allowedFrom])
    .select("*")
    .maybeSingle();
  if (!post) return { ok: false, skipped: true };

  const fail = async (error: string, result?: PublishResult) => {
    await admin.from("publish_logs").insert({
      post_id: post.id,
      request_summary: (result?.trace.request ?? { network: post.network }) as Json,
      response_status: result?.trace.status ?? null,
      response_body: result?.trace.body ?? null,
      success: false,
    });
    await admin.from("posts").update({ status: "failed", error_message: error }).eq("id", post.id);
    return { ok: false as const, error };
  };

  try {
    const publisher = getPublisher(post.network);
    if (!publisher || !getRules(post.network)?.autoPublish) return await fail("Ce réseau ne se publie pas automatiquement.");
    if (!post.social_account_id) return await fail("Aucun compte connecté pour cette publication. Connectez un compte puis réessayez.");

    const { data: accountRow } = await admin
      .from("social_accounts")
      .select("*")
      .eq("id", post.social_account_id)
      .eq("owner_id", params.ownerId)
      .maybeSingle();
    if (!accountRow) return await fail("Le compte de publication a été déconnecté. Reconnectez-le puis réessayez.");
    if (accountRow.status === "expired") return await fail("La connexion au compte a expiré. Reconnectez-le puis réessayez.");

    const { data: mediaRows } = await admin.from("post_media").select("*").eq("post_id", post.id).order("position");
    const issues = validatePost(post.network, post.body, post.hashtags, mediaRows ?? []);
    if (issues.length) return await fail(`Publication invalide : ${issues.map((i) => i.code).join(", ")}.`);

    const media = [];
    for (const m of mediaRows ?? []) {
      const { data: signed } = await admin.storage.from("post-media").createSignedUrl(m.storage_path, 3600);
      if (!signed) return await fail("Image introuvable dans le stockage.");
      media.push({
        url: signed.signedUrl,
        mimeType: m.mime_type,
        sizeBytes: m.size_bytes,
        bytes: async () => {
          const { data, error } = await admin.storage.from("post-media").download(m.storage_path);
          if (error || !data) throw new Error("Lecture de l'image impossible");
          return data.arrayBuffer();
        },
      });
    }

    const account = await getFreshAccount(admin, accountRow);
    const result = await publisher.publish({ text: composeText(post.body, post.hashtags), media, account });

    if (!result.ok) return await fail(result.error, result);

    await admin.from("publish_logs").insert({
      post_id: post.id,
      request_summary: result.trace.request as Json,
      response_status: result.trace.status ?? null,
      response_body: result.trace.body ?? null,
      success: true,
    });
    await admin
      .from("posts")
      .update({
        status: "published",
        published_url: result.url,
        external_post_id: result.externalId,
        published_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", post.id);
    return { ok: true, url: result.url };
  } catch (error) {
    // Erreur réseau ou délai dépassé : on ne sait pas si la plateforme a reçu la publication,
    // donc pas de relance automatique ; le message invite à vérifier avant de réessayer.
    const message = error instanceof Error ? error.message : String(error);
    return await fail(`Erreur pendant l'envoi : ${message}. Vérifiez sur le réseau avant de réessayer.`);
  }
}
