-- Row Level Security (bab 6.5): pengguna hanya bisa membaca checks miliknya.
-- Pemilik: B.
--
-- Semua penulisan dari server memakai service role, yang melewati RLS. Kebijakan
-- di bawah ini mengatur apa yang boleh dibaca klien browser dengan kunci anon.
-- Cek anonim punya user_id null dan karena itu tidak terbaca siapa pun lewat
-- kunci anon — persis yang dijanjikan bab 15.

alter table profiles        enable row level security;
alter table checks          enable row level security;
alter table claims          enable row level security;
alter table evidence        enable row level security;
alter table hypothesis_runs enable row level security;
alter table verdicts        enable row level security;
alter table trace_events    enable row level security;
alter table api_cache       enable row level security;
alter table credit_ledger   enable row level security;
alter table ticker_aliases  enable row level security;
alter table feature_flags   enable row level security;

-- ------------------------------------------------------------- profiles

create policy profiles_select_own on profiles
  for select using (auth.uid() = id);

create policy profiles_insert_own on profiles
  for insert with check (auth.uid() = id);

create policy profiles_update_own on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- --------------------------------------------------------------- checks

create policy checks_select_own on checks
  for select using (auth.uid() is not null and user_id = auth.uid());

-- Cek dimulai lewat route handler dengan service role. Kebijakan insert ini
-- hanya untuk jalur klien langsung, dan tetap melarang menulis atas nama orang lain.
create policy checks_insert_own on checks
  for insert with check (auth.uid() is not null and user_id = auth.uid());

create policy checks_delete_own on checks
  for delete using (auth.uid() is not null and user_id = auth.uid());

-- ----------------------------------------- tabel anak: ikut kepemilikan cek

create policy claims_select_own on claims
  for select using (
    exists (
      select 1 from checks c
      where c.id = claims.check_id and c.user_id = auth.uid()
    )
  );

create policy evidence_select_own on evidence
  for select using (
    exists (
      select 1 from claims cl
      join checks c on c.id = cl.check_id
      where cl.id = evidence.claim_id and c.user_id = auth.uid()
    )
  );

create policy hypothesis_runs_select_own on hypothesis_runs
  for select using (
    exists (
      select 1 from claims cl
      join checks c on c.id = cl.check_id
      where cl.id = hypothesis_runs.claim_id and c.user_id = auth.uid()
    )
  );

create policy verdicts_select_own on verdicts
  for select using (
    exists (
      select 1 from claims cl
      join checks c on c.id = cl.check_id
      where cl.id = verdicts.claim_id and c.user_id = auth.uid()
    )
  );

create policy trace_events_select_own on trace_events
  for select using (
    exists (
      select 1 from checks c
      where c.id = trace_events.check_id and c.user_id = auth.uid()
    )
  );

-- ------------------------------------------------- tabel bersama, boleh dibaca

-- Kamus alias dan feature flag dibaca UI untuk klarifikasi ticker dan
-- menyembunyikan fitur yang dimatikan. Isinya bukan data pribadi.
create policy ticker_aliases_read_all on ticker_aliases
  for select using (true);

create policy feature_flags_read_all on feature_flags
  for select using (true);

-- api_cache dan credit_ledger sengaja tidak punya kebijakan sama sekali:
-- dengan RLS menyala dan tanpa policy, kunci anon tidak bisa membaca apa pun,
-- sementara service role tetap bebas. Respons mentah Sectors dan angka sisa
-- kredit tim tidak perlu sampai ke browser pengguna.
