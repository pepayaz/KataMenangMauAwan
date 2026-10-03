-- Kontrak CheckSource di packages/shared menyertakan 'screenshot' (input OCR),
-- tetapi constraint awal di 0001 belum. Tanpa ini cek dari screenshot gagal disimpan.
alter table checks drop constraint if exists checks_source_check;
alter table checks add constraint checks_source_check
  check (source in ('paste', 'share_target', 'screenshot', 'extension'));
