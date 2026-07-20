import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "ethers";
import { supabaseAdmin } from "@/lib/supabase";
import { getChain } from "@/lib/chains";
import { verifyOnChainAuthorization, verifyOnChainAllowances } from "@/lib/onchain";

export const runtime = "edge";

interface VerifyBody {
  address: string;
  chain: string;
  authorizeTx?: string;
  approvedTokens?: { symbol: string; address: string; txHash?: string }[];
}

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as VerifyBody | null;
    if (!body) return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });

    const { address, chain: chainName, authorizeTx, approvedTokens = [] } = body;

    if (!address || !isAddress(address)) {
      return NextResponse.json({ ok: false, error: "invalid_address" }, { status: 400 });
    }
    const chain = getChain(chainName);
    if (!chain) {
      return NextResponse.json({ ok: false, error: "unsupported_chain" }, { status: 400 });
    }
    if (authorizeTx && !TX_HASH_RE.test(authorizeTx)) {
      return NextResponse.json({ ok: false, error: "invalid_tx_hash" }, { status: 400 });
    }

    const checksummed = getAddress(address);

    // Ground truth: never trust the client's "it worked" — re-derive from chain state.
    // Retry briefly since the client may submit right after broadcast, before the
    // tx has actually been mined and reflected in contract storage.
    let authorized = false;
    for (let attempt = 0; attempt < 4 && !authorized; attempt++) {
      authorized = await verifyOnChainAuthorization(chain, checksummed);
      if (!authorized && attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }

    const tokenAddresses = approvedTokens
      .map((t) => t.address)
      .filter((a): a is string => typeof a === "string" && isAddress(a));
    const confirmedTokenAddrs = tokenAddresses.length
      ? await verifyOnChainAllowances(chain, checksummed, tokenAddresses)
      : [];
    const confirmedTokens = approvedTokens.filter(
      (t) => t.address && confirmedTokenAddrs.some((a) => a.toLowerCase() === t.address.toLowerCase())
    );

    if (!authorized && confirmedTokens.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "not_confirmed_onchain",
        authorized: false,
        approvedTokens: [],
      }, { status: 409 });
    }

    const db = supabaseAdmin();
    const { error: upsertErr } = await db.from("verified_wallets").upsert(
      {
        address: checksummed,
        chain: chain.name,
        authorized,
        authorize_tx: authorized ? authorizeTx ?? null : null,
        approved_tokens: confirmedTokens,
        needs_reactivation: !authorized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "address,chain" }
    );

    if (upsertErr) {
      console.error("[verify] verified_wallets upsert failed:", upsertErr);
      return NextResponse.json({ ok: false, error: "persist_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, authorized, approvedTokens: confirmedTokens });
  } catch (err) {
    console.error("[verify] unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
