-- Preserve a creative-level UTM identifier so marketing can compare individual posts.
alter table public.funnel_events
  add column if not exists content text;

create index if not exists funnel_events_content_idx
  on public.funnel_events (content, created_at desc)
  where content is not null;;
