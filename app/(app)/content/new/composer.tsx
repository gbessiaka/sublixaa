"use client";

import { Feather, Hash, ImagePlus, PenLine, SlidersHorizontal, Type, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import { interpolate } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { registerMediaAction } from "../[id]/actions";
import { createPostsAction, draftTextAction } from "./actions";

type Mode = "write" | "draft";
type Tone = keyof Dictionary["compose"]["tones"];
type NetworkOption = { id: string; label: string; maxLength: number; mediaRequired: boolean; auto: boolean };
type Picked = { file: File; url: string };

function Panel({ icon: Icon, title, children, className }: { icon: LucideIcon; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-4 rounded-3xl bg-card p-6", className)}>
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Icon className="size-5 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

export function Composer({
  t,
  ownerId,
  clients,
  networks,
  defaultClientId,
  timeZone,
}: {
  t: Dictionary;
  ownerId: string;
  clients: { id: string; name: string }[];
  networks: NetworkOption[];
  defaultClientId: string;
  timeZone: string;
}) {
  const c = t.compose;
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("write");
  const [clientId, setClientId] = useState(defaultClientId);
  const [selected, setSelected] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [link, setLink] = useState("");
  const [tone, setTone] = useState<Tone>("client");
  const [keywords, setKeywords] = useState("");
  const [details, setDetails] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [body, setBody] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [drafting, startDrafting] = useTransition();
  const [saving, startSaving] = useTransition();

  // Libère les aperçus d'images à la fermeture
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => () => imagesRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const chosen = networks.filter((n) => selected.includes(n.id));
  const strictest = useMemo(() => [...chosen].sort((a, b) => a.maxLength - b.maxLength)[0], [chosen]);
  const tagList = hashtags.split(/[\s,]+/).map((h) => h.replace(/^#+/, "")).filter(Boolean);
  const fullLength = body.trim().length + (link && !body.includes(link) ? link.length + 2 : 0) + tagList.reduce((s, h) => s + h.length + 2, 0);
  const tooLong = strictest ? fullLength > strictest.maxLength : false;
  const manual = chosen.filter((n) => !n.auto).map((n) => n.label);
  const needsImage = chosen.some((n) => n.mediaRequired) && images.length === 0;
  const busy = drafting || saving;

  function toggleNetwork(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const ok = Array.from(files).filter((f) => ["image/jpeg", "image/png"].includes(f.type) && f.size <= 8 * 1024 * 1024);
    if (ok.length < files.length) setError(c.imageHint);
    setImages((prev) => [...prev, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function checkBasics(): boolean {
    if (!clientId) return fail(c.errors.clientRequired);
    if (!selected.length) return fail(c.errors.networksRequired);
    return true;
  }

  function fail(message: string): false {
    setError(message);
    return false;
  }

  function onDraft() {
    setError(null);
    if (!checkBasics()) return;
    if (!topic.trim()) return void fail(c.errors.topicRequired);
    startDrafting(async () => {
      const result = await draftTextAction({ clientId, networks: selected, topic, link: link || undefined, tone, keywords, details });
      if (!result.ok) return void setError(result.error);
      setBody(result.body);
      setHashtags(result.hashtags.join(" "));
    });
  }

  function onSave(status: "draft" | "to_review") {
    setError(null);
    if (!checkBasics()) return;
    if (!body.trim()) return void fail(c.errors.bodyRequired);
    if (tooLong && strictest) return void fail(interpolate(c.errors.tooLong, { network: strictest.label, max: String(strictest.maxLength) }));
    startSaving(async () => {
      const result = await createPostsAction({
        clientId,
        networks: selected,
        topic: topic || undefined,
        body,
        hashtags: tagList,
        link: link || undefined,
        scheduledLocal: scheduledLocal || undefined,
        status,
      });
      if (!result.ok) return void setError(result.error);

      // Images : envoyées dans le dossier de chaque publication, puis enregistrées
      let uploadFailed = false;
      if (images.length) {
        const supabase = createClient();
        for (const postId of result.ids) {
          for (const { file } of images) {
            const ext = file.type === "image/png" ? "png" : "jpg";
            const path = `${ownerId}/${postId}/${crypto.randomUUID()}.${ext}`;
            const { error: upError } = await supabase.storage.from("post-media").upload(path, file, { contentType: file.type });
            if (upError) {
              uploadFailed = true;
              continue;
            }
            const registered = await registerMediaAction(postId, { storagePath: path, mimeType: file.type, sizeBytes: file.size, ...(await imageSize(file)) });
            if (registered?.error) uploadFailed = true;
          }
        }
      }
      if (uploadFailed) setError(c.errors.upload);
      router.push(result.ids.length === 1 ? `/content/${result.ids[0]}` : `/content?client=${clientId}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex self-start rounded-full bg-muted p-1" role="tablist">
        {(
          [
            ["write", PenLine, c.modes.write],
            ["draft", Feather, c.modes.draft],
          ] as const
        ).map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-colors",
              mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Panel icon={SlidersHorizontal} title={c.settings}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client">{c.client}</Label>
            <NativeSelect id="client" value={clientId} onChange={(e) => setClientId(e.target.value)} className="h-10 bg-card">
              {clients.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{c.networks}</legend>
            <div className="flex flex-wrap gap-2">
              {networks.map((n) => {
                const on = selected.includes(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleNetwork(n.id)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                      on ? "bg-sidebar text-sidebar-foreground" : "border border-foreground/20 hover:bg-muted",
                    )}
                  >
                    {n.label}
                  </button>
                );
              })}
            </div>
            {manual.length > 0 && <p className="text-xs text-muted-foreground">{interpolate(c.manualHint, { networks: manual.join(", ") })}</p>}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="topic">
              {c.topic}
              {mode === "draft" && " *"}
            </Label>
            <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={1000} placeholder={c.topicPlaceholder} className="h-10" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="link">{c.link}</Label>
            <Input id="link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" className="h-10" />
            <p className="text-xs text-muted-foreground">{c.linkHint}</p>
          </div>

          {mode === "draft" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tone">{c.tone}</Label>
                  <NativeSelect id="tone" value={tone} onChange={(e) => setTone(e.target.value as Tone)} className="h-10 bg-card">
                    {(Object.keys(c.tones) as Tone[]).map((k) => (
                      <option key={k} value={k}>
                        {c.tones[k]}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="keywords">{c.keywords}</Label>
                  <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder={c.keywordsPlaceholder} className="h-10" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="details">{c.details}</Label>
                <Textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder={c.detailsPlaceholder} />
              </div>
              <Button type="button" onClick={onDraft} disabled={busy} className="h-11">
                <Feather />
                {drafting ? t.common.generating : body ? c.redraft : c.draftSubmit}
              </Button>
            </>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="date">{c.date}</Label>
            <Input id="date" type="datetime-local" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} className="h-10" />
            <p className="text-xs text-muted-foreground">{interpolate(c.dateHint, { tz: timeZone })}</p>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel icon={Type} title={c.text}>
            <Textarea
              id="body"
              aria-label={c.text}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={drafting ? t.common.generating : mode === "write" ? c.textPlaceholderWrite : c.textPlaceholderDraft}
              disabled={drafting}
              className="min-h-56 bg-card"
            />
            {strictest && (
              <p className={cn("flex flex-wrap justify-between gap-2 text-xs", tooLong ? "text-destructive" : "text-muted-foreground")}>
                <span>{interpolate(c.charCount, { count: String(fullLength), max: String(strictest.maxLength) })}</span>
                {chosen.length > 1 && <span>{interpolate(c.charLimitFrom, { network: strictest.label })}</span>}
              </p>
            )}
          </Panel>

          <Panel icon={Hash} title={c.hashtags}>
            <Input id="hashtags" aria-label={c.hashtags} value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder={c.hashtagsPlaceholder} className="h-10" />
            {tagList.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {tagList.map((h, i) => (
                  <li key={`${h}-${i}`} className="rounded-full bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                    #{h}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={ImagePlus} title={c.image}>
            {images.length > 0 && (
              <ul className="flex flex-wrap gap-3">
                {images.map((img, i) => (
                  <li key={img.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="size-28 rounded-2xl object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 rounded-full bg-card/90 p-1 shadow-sm hover:bg-card"
                      aria-label={c.removeImage}
                      title={c.removeImage}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={busy}>
                <ImagePlus />
                {c.importImage}
              </Button>
              <span className="text-xs text-muted-foreground">{c.imageHint}</span>
            </div>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => onFiles(e.target.files)} />
            {needsImage && <p className="text-xs text-amber-700">{c.imageRequired}</p>}
          </Panel>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}>
          {error ?? (chosen.length > 1 ? interpolate(c.savedMany, { count: String(chosen.length) }) : "")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => onSave("draft")} disabled={busy} className="h-10 px-5">
            {saving ? c.saving : c.saveDraft}
          </Button>
          <Button type="button" onClick={() => onSave("to_review")} disabled={busy} className="h-10 px-5">
            {saving ? c.saving : c.sendToReview}
          </Button>
        </div>
      </div>
    </div>
  );
}
