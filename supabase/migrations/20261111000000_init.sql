-- War of Victor: players for leaderboards, Telegram Stars purchases

create table if not exists public.players (
  tg_id        bigint primary key,
  name         text not null default 'Командир',
  xp           bigint not null default 0,
  battles      integer not null default 0,
  wins         integer not null default 0,
  kills        integer not null default 0,
  dmg          bigint not null default 0,
  last_battle  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists players_xp_idx on public.players (xp desc);
create index if not exists players_wins_idx on public.players (wins desc);
create index if not exists players_kills_idx on public.players (kills desc);

-- Stars payments arrive through the bot webhook; the game claims them once
create table if not exists public.purchases (
  charge_id    text primary key,
  tg_id        bigint not null,
  product      text not null,
  stars        integer not null,
  crystals     integer not null,
  coins        integer not null default 0,
  claimed      boolean not null default false,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz
);
create index if not exists purchases_unclaimed_idx on public.purchases (tg_id) where not claimed;

alter table public.players enable row level security;
alter table public.purchases enable row level security;

-- No policies: the anon key cannot read or write these tables.
-- The game reads leaderboards through the api function, so Telegram ids stay private.
