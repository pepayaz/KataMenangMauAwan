-- Riwayat dan deteksi perubahan status (bab 8.1 B nomor 5). Pemilik: B.
--
-- Klaim yang sama bisa dicek berkali-kali; `claim_hash` yang menghubungkannya.
-- Ketika data baru terbit, verdict untuk hash yang sama bisa berubah — itulah
-- janji produk di bab 1.3 nomor 5: "agen memberi tahu bila statusnya berubah".
--
-- Semua view di bawah memakai security_invoker supaya kebijakan RLS pemanggil
-- tetap berlaku; tanpa itu view akan berjalan sebagai pemiliknya dan membocorkan
-- riwayat pengguna lain.

create or replace view claim_verdict_history
  with (security_invoker = true)
as
  select
    c.user_id,
    cl.claim_hash,
    cl.id          as claim_id,
    cl.check_id,
    cl.ticker,
    cl.type,
    cl.asserted,
    v.verdict,
    v.explanation,
    v.computed,
    c.created_at
  from claims cl
  join checks c   on c.id = cl.check_id
  join verdicts v on v.claim_id = cl.id
  where c.status = 'done';

-- Untuk setiap klaim, verdict sebelumnya atas hash yang sama milik pengguna
-- yang sama. Baris dengan previous_verdict berbeda adalah "status berubah".
create or replace view claim_status_changes
  with (security_invoker = true)
as
  select
    h.*,
    lag(h.verdict)    over w as previous_verdict,
    lag(h.created_at) over w as previous_checked_at
  from claim_verdict_history h
  where h.user_id is not null
  window w as (partition by h.user_id, h.claim_hash order by h.created_at);

-- Ringkasan satu baris per cek untuk halaman riwayat: status paling parah yang
-- ditemukan menentukan warna kartu di UI (C).
create or replace view check_summaries
  with (security_invoker = true)
as
  select
    c.id            as check_id,
    c.user_id,
    c.source,
    c.status,
    c.credits_used,
    c.created_at,
    c.finished_at,
    left(c.raw_text, 280)                          as excerpt,
    count(cl.id)                                   as claim_count,
    count(*) filter (where v.verdict = 'refuted')    as refuted_count,
    count(*) filter (where v.verdict = 'misleading') as misleading_count,
    count(*) filter (where v.verdict = 'supported')  as supported_count,
    array_remove(array_agg(distinct cl.ticker), null) as tickers
  from checks c
  left join claims cl  on cl.check_id = c.id
  left join verdicts v on v.claim_id  = cl.id
  group by c.id;
