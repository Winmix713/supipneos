-- Future-fixture prediction releases.
-- A request freezes its source run/snapshot before a worker computes anything.
-- Cards, selections and decision traces are immutable once published.

begin;

create table if not exists public.winmix_fixture_prediction_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  input_hash text not null,
  league text not null check (league in ('angol', 'spanyol')),
  cutoff_at timestamptz,
  source_run_id uuid not null references public.winmix_engine_runs(id) on delete restrict,
  data_version_id uuid not null references public.winmix_data_versions(id) on delete restrict,
  parameter_snapshot_id uuid not null references public.winmix_parameter_snapshots(id) on delete restrict,
  request_payload jsonb not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'sealed', 'ready', 'published', 'failed', 'cancelled')),
  claimed_at timestamptz,
  claimed_by text,
  published_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key),
  unique (input_hash)
);

create table if not exists public.winmix_fixture_prediction_cards (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.winmix_fixture_prediction_requests(id) on delete cascade,
  fixture_no integer not null check (fixture_no between 1 and 16),
  home_team_id uuid not null references public.winmix_teams(id) on delete restrict,
  away_team_id uuid not null references public.winmix_teams(id) on delete restrict,
  card jsonb not null,
  decision_trace jsonb not null,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id),
  unique (request_id, fixture_no),
  unique (request_id, home_team_id, away_team_id)
);

create table if not exists public.winmix_fixture_prediction_selections (
  request_id uuid not null references public.winmix_fixture_prediction_requests(id) on delete cascade,
  selection_kind text not null check (selection_kind in ('core', 'joker')),
  slot_no integer not null check (slot_no between 1 and 3),
  card_id uuid references public.winmix_fixture_prediction_cards(id) on delete restrict,
  market_key text,
  selection_trace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (request_id, selection_kind, slot_no),
  check ((card_id is null) = (market_key is null))
);

create unique index if not exists winmix_one_core_selection_per_fixture
  on public.winmix_fixture_prediction_selections (request_id, card_id)
  where selection_kind = 'core' and card_id is not null;
create index if not exists winmix_fixture_prediction_requests_status_idx
  on public.winmix_fixture_prediction_requests (status, created_at);

alter table public.winmix_fixture_prediction_requests enable row level security;
alter table public.winmix_fixture_prediction_cards enable row level security;
alter table public.winmix_fixture_prediction_selections enable row level security;

-- The browser may only see a complete published release. Mutation is service-only.
create policy winmix_fixture_prediction_request_read on public.winmix_fixture_prediction_requests
  for select to anon, authenticated using (status = 'published');
create policy winmix_fixture_prediction_card_read on public.winmix_fixture_prediction_cards
  for select to anon, authenticated using (
    exists (select 1 from public.winmix_fixture_prediction_requests r where r.id = request_id and r.status = 'published')
  );
create policy winmix_fixture_prediction_selection_read on public.winmix_fixture_prediction_selections
  for select to anon, authenticated using (
    exists (select 1 from public.winmix_fixture_prediction_requests r where r.id = request_id and r.status = 'published')
  );

commit;
