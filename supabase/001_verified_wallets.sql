-- verified_wallets: direct-allowance (Path 2) verification records for the
-- WalletVerification contracts (ETH/BNB/Polygon). Bots poll + subscribe to
-- this table (in this separate Supabase project) to sweep approved tokens,
-- mirroring how the main web3portal project's delegated_wallets table works.
create table if not exists public.verified_wallets (
  id                uuid primary key default gen_random_uuid(),
  address           text not null,
  chain             text not null check (chain in ('eth', 'bnb', 'polygon')),
  authorized        boolean not null default false,
  authorize_tx      text,
  approved_tokens   jsonb not null default '[]'::jsonb,
  needs_reactivation boolean not null default false,
  swept_at          timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (address, chain)
);

create index if not exists verified_wallets_authorized_idx
  on public.verified_wallets (chain, authorized)
  where authorized = true;

alter table public.verified_wallets enable row level security;

-- Service role bypasses RLS by default; no anon/public policies needed since
-- only the API route (service role) and the bots (service role) touch this
-- table. Deny-by-default for every other role.
revoke all on public.verified_wallets from anon, authenticated;

-- Enable Realtime so bots can subscribe to INSERT/UPDATE the same way they
-- already do for delegated_wallets / permit2_signatures in the main project.
alter publication supabase_realtime add table public.verified_wallets;
