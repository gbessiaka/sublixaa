import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContextOrNull } from "@/lib/auth/session";
import { formatInTz, localToUtc } from "@/lib/dates";
import { getDictionary, interpolate } from "@/lib/i18n";
import { composeText } from "@/lib/network-rules";

export const maxDuration = 60;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  meta: { fontSize: 9, color: "#555", marginBottom: 2 },
  post: { borderTop: "1px solid #ddd", paddingTop: 8, marginTop: 8 },
  head: { flexDirection: "row", gap: 8, marginBottom: 4 },
  date: { fontFamily: "Helvetica-Bold" },
  network: { color: "#0a66c2" },
  status: { color: "#555" },
  images: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  image: { width: 120, height: 120, objectFit: "cover" },
});

// Les polices PDF standard ne contiennent pas les émojis : on les retire
function pdfSafe(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/[^\u0000-ÿ’–—…€Œœ]/g, "");
}

// F-36 : export PDF du calendrier d'un client (date, réseau, texte, image)
export async function GET(request: NextRequest, { params }: RouteContext<"/api/export/[clientId]">) {
  const { clientId } = await params;
  const t = getDictionary();
  const ctx = await getOwnerContextOrNull();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));
  const tz = ctx.settings.timeZone;

  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  const start = localToUtc(`${from}T00:00`, tz);
  const end = localToUtc(`${to}T23:59`, tz);

  const [{ data: client }, { data: posts }] = await Promise.all([
    ctx.supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
    ctx.supabase
      .from("posts")
      .select("id, scheduled_at, network, body, hashtags, status, post_media(storage_path, mime_type, position)")
      .eq("client_id", clientId)
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at"),
  ]);
  if (!client) return NextResponse.json({ error: t.common.notFound }, { status: 404 });

  // Images téléchargées côté serveur depuis le stockage privé
  const items = await Promise.all(
    (posts ?? []).map(async (p) => {
      const media = [...(p.post_media ?? [])].sort((a, b) => a.position - b.position).slice(0, 4);
      const images = await Promise.all(
        media.map(async (m) => {
          const { data } = await ctx.supabase.storage.from("post-media").download(m.storage_path);
          if (!data) return null;
          return { data: Buffer.from(await data.arrayBuffer()), format: m.mime_type === "image/png" ? ("png" as const) : ("jpg" as const) };
        }),
      );
      return { ...p, images: images.filter((i): i is NonNullable<typeof i> => i !== null) };
    }),
  );

  const labels = t.networks as Record<string, string>;
  const statuses = t.statuses as Record<string, string>;
  const fmtDay = (d: string) => formatInTz(localToUtc(`${d}T12:00`, tz), tz, "d MMMM yyyy");

  const doc = (
    <Document title={interpolate(t.export.title, { client: client.name })}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{pdfSafe(interpolate(t.export.title, { client: client.name }))}</Text>
        <Text style={styles.meta}>{pdfSafe(interpolate(t.export.period, { from: fmtDay(from), to: fmtDay(to) }))}</Text>
        <Text style={styles.meta}>{pdfSafe(interpolate(t.export.generatedOn, { date: formatInTz(new Date(), tz) }))}</Text>
        {items.length === 0 && <Text style={{ marginTop: 16 }}>{pdfSafe(t.export.empty)}</Text>}
        {items.map((p) => (
          <View key={p.id} style={styles.post} wrap={false}>
            <View style={styles.head}>
              <Text style={styles.date}>{pdfSafe(formatInTz(p.scheduled_at!, tz, "EEEE d MMMM yyyy 'à' HH:mm"))}</Text>
              <Text style={styles.network}>{labels[p.network] ?? p.network}</Text>
              <Text style={styles.status}>{pdfSafe(statuses[p.status] ?? p.status)}</Text>
            </View>
            <Text>{pdfSafe(composeText(p.body, p.hashtags))}</Text>
            {p.images.length > 0 && (
              <View style={styles.images}>
                {p.images.map((img, i) => (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image key={i} src={img} style={styles.image} />
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  const filename = `calendrier-${client.name.replace(/[^\w-]+/g, "-").toLowerCase()}-${from}-${to}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
