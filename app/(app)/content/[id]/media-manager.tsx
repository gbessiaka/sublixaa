"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionState } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type MediaItem = { id: string; url: string | null; mime_type: string; size_bytes: number };

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

// F-20 : images envoyées directement dans Supabase Storage (dossier du propriétaire), puis enregistrées
export function MediaManager({
  t,
  ownerId,
  postId,
  media,
  locked,
  register,
  remove,
}: {
  t: Dictionary;
  ownerId: string;
  postId: string;
  media: MediaItem[];
  locked: boolean;
  register: (m: { storagePath: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null }) => Promise<ActionState>;
  remove: (mediaId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    const supabase = createClient();
    try {
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png"].includes(file.type)) {
          setError(t.post.errors.upload);
          continue;
        }
        const ext = file.type === "image/png" ? "png" : "jpg";
        const path = `${ownerId}/${postId}/${crypto.randomUUID()}.${ext}`;
        const { error: upError } = await supabase.storage.from("post-media").upload(path, file, { contentType: file.type });
        if (upError) {
          setError(`${t.post.errors.upload} (${upError.message})`);
          continue;
        }
        const size = await imageSize(file);
        const result = await register({ storagePath: path, mimeType: file.type, sizeBytes: file.size, ...size });
        if (result?.error) setError(result.error);
      }
    } finally {
      setUploading(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.post.noMedia}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {media.map((m) => (
            <li key={m.id} className="flex flex-col items-center gap-1">
              {m.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.url} alt="" className="size-28 rounded-md border object-cover" />
              )}
              <span className="text-xs text-muted-foreground">
                {m.mime_type.replace("image/", "").toUpperCase()} · {(m.size_bytes / 1024 / 1024).toFixed(1)} Mo
              </span>
              {!locked && (
                <Button type="button" variant="ghost" size="sm" onClick={() => startTransition(() => remove(m.id))}>
                  {t.post.removeImage}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <label className="flex w-fit cursor-pointer flex-col gap-1 text-sm">
          <span className="font-medium">{uploading ? t.post.uploading : t.post.addImages}</span>
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            disabled={uploading}
            onChange={(e) => {
              void onFiles(e.target.files);
              e.target.value = "";
            }}
            className="text-sm"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
