-- Keep the QR panel's saved status honest whenever an event is edited.
alter table public.events
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_events_updated_at();
