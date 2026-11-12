-- reminders from the bot: who agreed to get messages, when they last played and when we last wrote
alter table public.players add column if not exists notify boolean not null default false;
alter table public.players add column if not exists last_seen timestamptz;
alter table public.players add column if not exists last_ping timestamptz;
alter table public.players add column if not exists pings int not null default 0;
create index if not exists players_notify_idx on public.players (notify) where notify;
