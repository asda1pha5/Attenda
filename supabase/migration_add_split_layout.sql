alter table public.events drop constraint if exists events_box_mode_check;
alter table public.events add constraint events_box_mode_check
  check (box_mode in ('above','below','left','right','overlay')) not valid;
