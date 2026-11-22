import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decrypt, encryptOptional, encrypt } from "@/lib/crypto";
import { getPublisher, type OAuthAccount, type PublishAccount, type Publisher, type TokenSet } from "@/lib/publishers";
import type { Database, Tables } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;
type AccountRow = Tables<"social_accounts">;
export type AccountStatus = "active" | "expiring" | "expired";

const DAY = 24 * 60 * 60 * 1000;

// État d'une connexion (F-10) : « expire bientôt » 7 jours avant l'échéance,
// sauf si le jeton peut être renouvelé automatiquement.
export function computeStatus(expiresAt: Date | null, refreshable: boolean): AccountStatus {
  if (!expiresAt || refreshable) return "active";
  const left = expiresAt.getTime() - Date.now();
  if (left <= 0) return "expired";
  if (left <= 7 * DAY) return "expiring";
  return "active";
}

export function toPublishAccount(row: AccountRow): PublishAccount {
  return {
    externalId: row.external_id,
    displayName: row.display_name,
    accessToken: row.access_token_enc ? decrypt(row.access_token_enc) : "",
    refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
    tokenExpiresAt: row.token_expires_at ? new Date(row.token_expires_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function statusFor(publisher: Publisher | null, account: OAuthAccount | PublishAccount, expiresAt: Date | null) {
  const pa: PublishAccount = {
    externalId: account.externalId,
    displayName: null,
    accessToken: "",
    refreshToken: "refreshToken" in account ? (account.refreshToken ?? null) : null,
    tokenExpiresAt: expiresAt,
    metadata: {},
  };
  return computeStatus(expiresAt, publisher ? publisher.canRefresh(pa) && Boolean(publisher.refresh) : false);
}

// Enregistre (ou met à jour) un compte connecté, jetons chiffrés (NF-01)
export async function saveAccount(admin: Admin, ownerId: string, clientId: string, network: string, account: OAuthAccount) {
  const publisher = getPublisher(network);
  const expiresAt = account.expiresAt ?? null;
  const { error } = await admin.from("social_accounts").upsert(
    {
      owner_id: ownerId,
      client_id: clientId,
      network,
      external_id: account.externalId,
      display_name: account.displayName,
      access_token_enc: encrypt(account.accessToken),
      refresh_token_enc: encryptOptional(account.refreshToken),
      token_expires_at: expiresAt?.toISOString() ?? null,
      scopes: account.scopes ?? [],
      metadata: (account.metadata ?? {}) as Database["public"]["Tables"]["social_accounts"]["Insert"]["metadata"],
      status: statusFor(publisher, account, expiresAt),
    },
    { onConflict: "client_id,network,external_id" },
  );
  if (error) throw new Error(error.message);
}

async function storeRefreshed(admin: Admin, row: AccountRow, tokens: TokenSet, publisher: Publisher) {
  const expiresAt = tokens.expiresAt ?? null;
  const update = {
    access_token_enc: encrypt(tokens.accessToken),
    refresh_token_enc: tokens.refreshToken !== undefined ? encryptOptional(tokens.refreshToken) : row.refresh_token_enc,
    token_expires_at: expiresAt?.toISOString() ?? null,
    status: statusFor(publisher, { externalId: row.external_id, refreshToken: tokens.refreshToken ?? null } as PublishAccount, expiresAt),
  };
  await admin.from("social_accounts").update(update).eq("id", row.id).eq("owner_id", row.owner_id);
}

// Renvoie un compte prêt à publier, en renouvelant le jeton s'il expire bientôt
export async function getFreshAccount(admin: Admin, row: AccountRow): Promise<PublishAccount> {
  const publisher = getPublisher(row.network);
  const account = toPublishAccount(row);
  if (!publisher?.refresh || !publisher.canRefresh(account)) return account;
  const expiresAt = account.tokenExpiresAt?.getTime();
  // X : jeton de 2 h, renouvelé s'il expire dans moins de 5 minutes
  if (expiresAt && expiresAt - Date.now() < 5 * 60 * 1000) {
    const tokens = await publisher.refresh(account);
    await storeRefreshed(admin, row, tokens, publisher);
    return { ...account, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken ?? account.refreshToken, tokenExpiresAt: tokens.expiresAt ?? null };
  }
  return account;
}

// Tâche quotidienne (F-10, F-11) : renouvelle ce qui peut l'être, met à jour les états
export async function refreshAllAccounts(admin: Admin) {
  const { data: rows } = await admin.from("social_accounts").select("*");
  const summary = { checked: 0, refreshed: 0, expiring: 0, expired: 0, errors: 0 };
  for (const row of rows ?? []) {
    summary.checked++;
    const publisher = getPublisher(row.network);
    const account = toPublishAccount(row);
    const expiresAt = account.tokenExpiresAt;
    const refreshable = Boolean(publisher?.refresh && publisher.canRefresh(account));
    try {
      if (publisher?.refresh && refreshable && expiresAt && expiresAt.getTime() - Date.now() < 7 * DAY) {
        const tokens = await publisher.refresh(account);
        await storeRefreshed(admin, row, tokens, publisher);
        summary.refreshed++;
        continue;
      }
    } catch {
      summary.errors++;
    }
    const status = computeStatus(expiresAt, false);
    const effective = refreshable && status !== "expired" ? "active" : status;
    if (effective === "expiring") summary.expiring++;
    if (effective === "expired") summary.expired++;
    if (effective !== row.status) {
      await admin.from("social_accounts").update({ status: effective }).eq("id", row.id);
    }
  }
  return summary;
}
