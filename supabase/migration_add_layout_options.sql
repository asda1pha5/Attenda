alter table public.events add column if not exists box_mode text not null default 'below';
alter table public.events add constraint events_box_mode_check check (box_mode in ('above','below','overlay')) not valid;
alter table public.events add column if not exists show_image boolean not null default true;
alter table public.events add column if not exists rsvp_title text not null default 'Please RSVP';
alter table public.events add column if not exists rsvp_subtitle text;
alter table public.events add column if not exists registry_position text not null default 'bottom';
alter table public.events add constraint events_registry_position_check check (registry_position in ('top','bottom')) not valid;
