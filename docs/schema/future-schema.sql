-- FitLytix future schema (Postgres / Supabase-compatible). NOT APPLIED. Reference for backend migration.
-- Every table: GRANTs then RLS then policies.

create type public.app_role as enum ('athlete', 'coach', 'head_coach', 'admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  primary_sport text not null,
  experience text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.athletes to authenticated;
grant all on public.athletes to service_role;
alter table public.athletes enable row level security;

create table public.coach_athletes (
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  primary key (coach_user_id, athlete_id)
);
grant select on public.coach_athletes to authenticated;
grant all on public.coach_athletes to service_role;
alter table public.coach_athletes enable row level security;

create or replace function public.can_access_athlete(_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.athletes a where a.id = _athlete and a.user_id = auth.uid())
      or exists (select 1 from public.coach_athletes c where c.athlete_id = _athlete and c.coach_user_id = auth.uid())
$$;

create policy "own athlete row" on public.athletes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "coach reads linked athletes" on public.athletes for select to authenticated using (public.can_access_athlete(id));
create policy "coach sees own links" on public.coach_athletes for select to authenticated using (coach_user_id = auth.uid());

-- Wearables ---------------------------------------------------------------
create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  provider text not null check (provider in ('garmin','apple_health','google_health_connect','whoop','oura','polar','samsung','fitbit','other')),
  status text not null default 'not_connected' check (status in ('not_connected','ready_to_connect','connected','sync_error','manual')),
  external_account_id text,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (athlete_id, provider)
);
-- OAuth tokens live in a separate server-only table (no grants to authenticated).
create table public.wearable_tokens (
  connection_id uuid primary key references public.wearable_connections(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  expires_at timestamptz
);
grant all on public.wearable_tokens to service_role;
alter table public.wearable_tokens enable row level security;

grant select, insert, update on public.wearable_connections to authenticated;
grant all on public.wearable_connections to service_role;
alter table public.wearable_connections enable row level security;
create policy "athlete/coach read connections" on public.wearable_connections for select to authenticated using (public.can_access_athlete(athlete_id));
create policy "athlete manages own connections" on public.wearable_connections for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()) and status in ('not_connected','ready_to_connect','manual'));

create table public.health_metrics (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  source text not null,
  connection_id uuid references public.wearable_connections(id) on delete set null,
  metric_type text not null,
  value numeric not null,
  unit text not null,
  start_time timestamptz not null,
  end_time timestamptz,
  external_id text,
  device_id text,
  metadata jsonb,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index on public.health_metrics (athlete_id, metric_type, start_time desc);
grant select, insert on public.health_metrics to authenticated;
grant all on public.health_metrics to service_role;
alter table public.health_metrics enable row level security;
create policy "read own or coached metrics" on public.health_metrics for select to authenticated using (public.can_access_athlete(athlete_id));
create policy "athlete inserts manual metrics" on public.health_metrics for insert to authenticated
  with check (source = 'manual' and exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

-- Body analysis (append-only) --------------------------------------------
create table public.body_analysis_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  measured_at date not null,
  source text not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.body_analysis_records to authenticated;
grant all on public.body_analysis_records to service_role;
alter table public.body_analysis_records enable row level security;
create policy "read body" on public.body_analysis_records for select to authenticated using (public.can_access_athlete(athlete_id));
create policy "insert own body" on public.body_analysis_records for insert to authenticated
  with check (exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

-- Coach-controlled proposals ---------------------------------------------
create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('training','nutrition')),
  status text not null default 'needs_review' check (status in ('draft','needs_review','approved','rejected')),
  goal text,
  sections jsonb not null,
  rationale jsonb not null,
  source_context text[] not null,
  provider text not null,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.ai_proposals to authenticated;
grant all on public.ai_proposals to service_role;
alter table public.ai_proposals enable row level security;
create policy "coach manages own proposals" on public.ai_proposals for all to authenticated using (coach_user_id = auth.uid()) with check (coach_user_id = auth.uid());
create policy "athlete sees approved only" on public.ai_proposals for select to authenticated
  using (status = 'approved' and exists (select 1 from public.athletes a where a.id = athlete_id and a.user_id = auth.uid()));

-- Further tables (same pattern): goals, milestones, programs, workouts, workout_results,
-- nutrition_profiles, nutrition_plans, nutrition_feedback, notifications, subscriptions, coach_profiles, organizations.
