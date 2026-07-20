"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { mainnet, bsc, polygon } from "viem/chains";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="max-w-sm text-sm text-red-400">
          Missing <code className="font-mono">NEXT_PUBLIC_PRIVY_APP_ID</code>. Add it to your
          environment and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#5b8cff",
          walletList: [
            "metamask",
            "coinbase_wallet",
            "rainbow",
            "wallet_connect_qr",
            "detected_ethereum_wallets",
          ],
        },
        loginMethods: ["wallet"],
        supportedChains: [mainnet, bsc, polygon],
        defaultChain: mainnet,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
