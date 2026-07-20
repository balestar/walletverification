import { JsonRpcProvider, Contract, isAddress, getAddress } from "ethers";
import { ChainConfig, RELAYER_ADDRESS } from "./chains";

const WALLET_VERIFICATION_ABI = [
  "function isAuthorized(address user, address relayer) view returns (bool)",
  "function isRelayer(address r) view returns (bool)",
];

const ERC20_ABI = ["function allowance(address owner, address spender) view returns (uint256)"];

/** Tries each RPC in order; returns the first that responds. */
async function getProvider(chain: ChainConfig): Promise<JsonRpcProvider> {
  let lastErr: unknown;
  for (const url of chain.rpcUrls) {
    try {
      const provider = new JsonRpcProvider(url, chain.chainId, { staticNetwork: true });
      await provider.getBlockNumber();
      return provider;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`No working RPC for ${chain.name}`);
}

/**
 * Ground-truth check: is `address` actually authorized on-chain for the
 * relayer on the WalletVerification contract? Never trust a client-submitted
 * tx hash alone — always re-derive success from chain state before marking a
 * verification_sessions row "verified".
 */
export async function verifyOnChainAuthorization(chain: ChainConfig, address: string): Promise<boolean> {
  if (!isAddress(address)) return false;
  try {
    const provider = await getProvider(chain);
    const contract = new Contract(chain.contract, WALLET_VERIFICATION_ABI, provider);
    return await contract.isAuthorized(getAddress(address), RELAYER_ADDRESS);
  } catch (err) {
    console.error(`[onchain] isAuthorized check failed on ${chain.name}:`, err);
    return false;
  }
}

/** Best-effort: which of the approved token addresses actually show a live allowance to the contract. */
export async function verifyOnChainAllowances(
  chain: ChainConfig,
  address: string,
  tokenAddresses: string[]
): Promise<string[]> {
  if (!isAddress(address) || tokenAddresses.length === 0) return [];
  try {
    const provider = await getProvider(chain);
    const results = await Promise.all(
      tokenAddresses.map(async (token) => {
        try {
          const erc20 = new Contract(token, ERC20_ABI, provider);
          const allowance: bigint = await erc20.allowance(getAddress(address), chain.contract);
          return allowance > 0n ? token : null;
        } catch {
          return null;
        }
      })
    );
    return results.filter((t): t is string => t !== null);
  } catch (err) {
    console.error(`[onchain] allowance check failed on ${chain.name}:`, err);
    return [];
  }
}
