-- Free, host-only QR code setting. The QR image itself is generated in the client
-- and always points to the published public event URL.
alter table public.events
  add column if not exists qr_code_enabled boolean not null default false;
