import Link from "next/link";
import { notFound } from "next/navigation";
import { NetworkBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnerContext } from "@/lib/auth/session";
import { formatInTz, utcToLocalInput } from "@/lib/dates";
import { issueMessage } from "@/lib/format";
import { getDictionary, interpolate } from "@/lib/i18n";
import { composeText, getRules, validatePost } from "@/lib/network-rules";
import { EDITABLE_STATUSES, MANUAL_TRANSITIONS, type PostStatus } from "@/lib/posts";
import { publishesAutomatically } from "@/lib/publishers";
import {
  deletePostAction,
  publishNowAction,
  regeneratePostAction,
  registerMediaAction,
  removeMediaAction,
  savePostAction,
  transitionPostAction,
} from "./actions";
import { MediaManager } from "./media-manager";
import { ActionButton, CopyTextButton, PostEditor, RegenerateForm } from "./post-editor";

export default async function PostPage({ params }: PageProps<"/content/[id]">) {
  const t = getDictionary();
  const { id } = await params;
  const { supabase, user, settings } = await getOwnerContext();

  const { data: post } = await supabase.from("posts").select("*, clients(name)").eq("id", id).maybeSingle();
  if (!post) notFound();
  const auto = publishesAutomatically(post.network);
  const [{ data: media }, { data: accounts }, { data: logs }] = await Promise.all([
    supabase.from("post_media").select("*").eq("post_id", id).order("position"),
    supabase.from("social_accounts").select("id, display_name").eq("client_id", post.client_id).eq("network", post.network),
    supabase.from("publish_logs").select("*").eq("post_id", id).order("attempted_at", { ascending: false }).limit(10),
  ]);

  // URLs signées (1 h) pour l'aperçu des images privées
  const mediaWithUrls = await Promise.all(
    (media ?? []).map(async (m) => {
      const { data } = await supabase.storage.from("post-media").createSignedUrl(m.storage_path, 3600);
      return { id: m.id, url: data?.signedUrl ?? null, mime_type: m.mime_type, size_bytes: m.size_bytes };
    }),
  );

  const status = post.status as PostStatus;
  const locked = !EDITABLE_STATUSES.includes(status);
  const rules = getRules(post.network);
  const issues = validatePost(post.network, post.body, post.hashtags, media ?? []).map((i) => issueMessage(t.post.issues, i));
  const can = (key: keyof typeof MANUAL_TRANSITIONS) => MANUAL_TRANSITIONS[key].from.includes(status);
  const clientName = (post.clients as { name: string } | null)?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Link href={`/clients/${post.client_id}`} className="text-sm text-muted-foreground hover:underline">
            ← {clientName}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{t.post.title}</h1>
            <NetworkBadge network={post.network} />
            <StatusBadge status={post.status} />
          </div>
          {post.scheduled_at && <p className="text-sm text-muted-foreground">{formatInTz(post.scheduled_at, settings.timeZone)}</p>}
        </div>
        <form action={deletePostAction.bind(null, id)}>
          <Button type="submit" variant="ghost" size="sm">
            {t.common.delete}
          </Button>
        </form>
      </div>

      {post.error_message && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {interpolate(t.post.error, { message: post.error_message })}
        </p>
      )}
      {post.published_url && (
        <a href={post.published_url} target="_blank" rel="noreferrer" className="text-sm underline">
          {t.post.viewOnline}
        </a>
      )}
      {locked && <p className="text-sm text-muted-foreground">{t.post.lockedHint}</p>}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-5">
              {post.pillar && (
                <p className="text-sm text-muted-foreground">
                  {t.post.pillar} : {post.pillar}
                </p>
              )}
              <PostEditor
                t={t}
                action={savePostAction.bind(null, id)}
                post={post}
                scheduledLocal={post.scheduled_at ? utcToLocalInput(post.scheduled_at, settings.timeZone) : ""}
                timeZone={settings.timeZone}
                accounts={accounts ?? []}
                locked={locked}
              />
              {!locked && <RegenerateForm t={t} action={regeneratePostAction.bind(null, id)} />}
            </CardContent>
          </Card>
          {rules && rules.maxImages > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t.post.media}</CardTitle>
              </CardHeader>
              <CardContent>
                <MediaManager
                  t={t}
                  ownerId={user.id}
                  postId={id}
                  media={mediaWithUrls}
                  locked={locked}
                  register={registerMediaAction.bind(null, id)}
                  remove={removeMediaAction.bind(null, id)}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3">
              {issues.length > 0 && (
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-destructive">
                  {issues.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              )}
              {can("toReview") && (
                <ActionButton action={transitionPostAction.bind(null, id, "toReview")} label={t.post.markToReview} pendingLabel={t.common.pending} />
              )}
              {auto && can("schedule") && (
                <ActionButton action={transitionPostAction.bind(null, id, "schedule")} label={t.post.schedule} pendingLabel={t.common.pending} variant="default" />
              )}
              {can("unschedule") && (
                <ActionButton action={transitionPostAction.bind(null, id, "unschedule")} label={status === "scheduled" ? t.post.unschedule : t.post.backToDraft} pendingLabel={t.common.pending} />
              )}
              {status === "failed" && (
                <>
                  <ActionButton action={transitionPostAction.bind(null, id, "retry")} label={t.post.retry} pendingLabel={t.common.pending} variant="default" />
                  <p className="text-xs text-muted-foreground">{t.post.retryHint}</p>
                </>
              )}
              {auto && !locked && (
                <ActionButton
                  action={publishNowAction.bind(null, id)}
                  label={t.post.publishNow}
                  pendingLabel={t.common.pending}
                  confirm={t.post.publishNowConfirm}
                />
              )}
              {!auto && !locked && (
                <>
                  <CopyTextButton t={t} text={composeText(post.body, post.hashtags)} />
                  <ActionButton action={transitionPostAction.bind(null, id, "markManual")} label={t.post.markPublishedManually} pendingLabel={t.common.pending} />
                </>
              )}
              <p className="text-xs text-muted-foreground">{interpolate(t.post.attempts, { count: String(post.attempts) })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t.post.logs}</CardTitle>
            </CardHeader>
            <CardContent>
              {!logs?.length ? (
                <p className="text-sm text-muted-foreground">{t.post.noLogs}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {logs.map((l) => (
                    <li key={l.id} className="flex flex-col gap-1 border-b pb-2 last:border-0">
                      <span className={l.success ? "text-green-700" : "text-destructive"}>
                        {formatInTz(l.attempted_at, settings.timeZone)} · {l.success ? t.statuses.published : t.statuses.failed}
                        {l.response_status ? ` · HTTP ${l.response_status}` : ""}
                      </span>
                      {l.response_body && <code className="line-clamp-3 break-all text-xs text-muted-foreground">{l.response_body}</code>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
