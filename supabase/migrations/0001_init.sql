-- Cek Dulu — skema basis data inti (bab 6.5 rencana pengembangan).
-- Pemilik: B. Reviewer: A.
--
-- Catatan penyimpangan dari sketsa bab 6.5, disengaja:
--   * `claims.id` dan `evidence.id` bertipe text, bukan uuid. Kontrak bab 5
--     mendefinisikan `claimId` dan `evidenceId` sebagai string, dan verifier
--     membangun evidenceId secara deterministik (`<claimId>:<slug-label>`)
--     supaya laporan evaluasi bisa dibandingkan antar-jalan dan grounding
--     validator punya rujukan yang stabil. Kontrak Zod yang menang atas sketsa
--     SQL; menyimpan uuid acak di sini akan membuang sifat determinstik itu.
--   * `hypothesis_runs.evidence_ids` ikut menjadi text[] karena alasan yang sama.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- pengguna

create table if not exists profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------- cek

create type check_status as enum ('running', 'done', 'error');

create table if not exists checks (
  id           uuid primary key default gen_random_uuid(),
  -- null untuk cek anonim. Bab 15: teks yang dicek pengguna anonim tidak
  -- disimpan ke riwayat siapa pun.
  user_id      uuid references auth.users (id) on delete cascade,
  source       text not null check (source in ('paste', 'share_target', 'extension')),
  raw_text     text not null,
  url          text,
  status       check_status not null default 'running',
  credits_used integer not null default 0,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists checks_user_created_idx on checks (user_id, created_at desc);

-- ----------------------------------------------------------------- klaim

create type claim_type as enum (
  'valuation', 'dividend', 'price_move', 'earnings_growth',
  'foreign_flow', 'accumulation', 'safety'
);

create table if not exists claims (
  id         text primary key,
  check_id   uuid not null references checks (id) on delete cascade,
  type       claim_type not null,
  ticker     text not null,
  asserted   jsonb not null,
  -- Posisi klaim di dalam teks asli, untuk menyorotinya di UI.
  span       int4range not null,
  in_scope   boolean not null default true,
  -- hash(ticker + type + metric + nilai dibulatkan); lihat packages/shared/src/claim-hash.ts
  claim_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists claims_check_idx on claims (check_id);
-- Riwayat memakai indeks ini untuk menemukan klaim yang sama yang pernah dicek.
create index if not exists claims_hash_idx on claims (claim_hash, created_at desc);

-- -------------------------------------------------------------- evidence

create table if not exists evidence (
  id         text primary key,
  claim_id   text not null references claims (id) on delete cascade,
  tool       text not null,
  params     jsonb not null default '{}'::jsonb,
  -- number atau string; kontrak bab 5 mengizinkan keduanya.
  value      jsonb not null,
  label      text not null,
  unit       text,
  credits    integer not null default 0,
  cached     boolean not null default false,
  fetched_at timestamptz not null
);

create index if not exists evidence_claim_idx on evidence (claim_id);

-- ------------------------------------------------------- hipotesis konteks

create table if not exists hypothesis_runs (
  id           uuid primary key default gen_random_uuid(),
  claim_id     text not null references claims (id) on delete cascade,
  hyp_id       text not null,
  triggered    boolean not null,
  strength     text not null check (strength in ('weak', 'strong')),
  evidence_ids text[] not null default '{}',
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists hypothesis_runs_claim_idx on hypothesis_runs (claim_id);

-- --------------------------------------------------------------- verdict

create type verdict_kind as enum (
  'supported', 'refuted', 'misleading', 'unverifiable', 'out_of_scope'
);

create table if not exists verdicts (
  claim_id         text primary key references claims (id) on delete cascade,
  verdict          verdict_kind not null,
  computed         jsonb,
  missing_context  jsonb not null default '[]'::jsonb,
  explanation      text not null,
  evidence_ids     text[] not null default '{}',
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------- jejak

create table if not exists trace_events (
  id       bigserial primary key,
  check_id uuid not null references checks (id) on delete cascade,
  ts       timestamptz not null default now(),
  stage    text not null check (
             stage in ('normalize','extract','route','verify','hunt','adjudicate','done','error')
           ),
  message  text not null,
  data     jsonb,
  credits  integer
);

create index if not exists trace_events_check_idx on trace_events (check_id, ts);

-- ----------------------------------------------------------------- cache

create table if not exists api_cache (
  key         text primary key,
  endpoint    text not null,
  params      jsonb not null default '{}'::jsonb,
  response    jsonb not null,
  fetched_at  timestamptz not null default now(),
  ttl_seconds integer not null
);

create index if not exists api_cache_endpoint_idx on api_cache (endpoint, fetched_at desc);

-- Baris yang sudah lewat TTL-nya. Dipakai skrip pemeliharaan, bukan jalur cek —
-- klien memeriksa kesegaran sendiri supaya satu baris basi tetap bisa dipakai
-- sebagai cadangan ketika API sedang bermasalah.
create or replace view api_cache_stale as
  select key, endpoint, fetched_at, ttl_seconds
  from api_cache
  where fetched_at + (ttl_seconds || ' seconds')::interval < now();

-- ----------------------------------------------------------- buku kredit

create table if not exists credit_ledger (
  id       bigserial primary key,
  endpoint text not null,
  params   jsonb not null default '{}'::jsonb,
  credits  integer not null default 0,
  cached   boolean not null default false,
  check_id uuid references checks (id) on delete set null,
  member   text not null check (member in ('A','B','C','D','demo','cadangan')),
  ts       timestamptz not null default now()
);

create index if not exists credit_ledger_ts_idx on credit_ledger (ts desc);
create index if not exists credit_ledger_member_idx on credit_ledger (member, ts desc);
create index if not exists credit_ledger_check_idx on credit_ledger (check_id);

-- Dibaca dasbor /admin/credits dan laporan kredit harian pukul 21:00.
create or replace view credit_spend_by_member as
  select member, sum(credits)::bigint as credits, count(*)::bigint as calls
  from credit_ledger
  group by member;

-- --------------------------------------------------------- kamus ticker

create table if not exists ticker_aliases (
  alias  text primary key,
  ticker text not null,
  -- 'emiten' dari daftar resmi Sectors, 'manual' dari 100 alias slang yang
  -- dikumpulkan B dan D (bab 8.1 B nomor 2).
  source text not null check (source in ('emiten', 'manual')),
  -- Alias yang lebih spesifik menang saat dua alias cocok pada teks yang sama.
  weight real not null default 1.0
);

create index if not exists ticker_aliases_ticker_idx on ticker_aliases (ticker);

-- ------------------------------------------------------- feature flags

create table if not exists feature_flags (
  key     text primary key,
  enabled boolean not null default false
);

-- Bab 9.1: fitur yang belum utuh pada Senin 28 September pukul 20:00 dimatikan
-- lewat flag, bukan dikirim setengah jadi.
insert into feature_flags (key, enabled) values
  ('claim_types_ext', false),
  ('accounts',        false),
  ('share_target',    false)
on conflict (key) do nothing;
