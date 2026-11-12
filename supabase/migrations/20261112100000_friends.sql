-- friend cards: medals and the best vehicle shown to friends; anti-spam for battle challenges
alter table public.players add column if not exists medals jsonb not null default '{}'::jsonb;
alter table public.players add column if not exists best text;
alter table public.players add column if not exists last_challenge timestamptz;
