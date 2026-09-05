-- Store only a sanitized callback stage so OAuth failures can be diagnosed
-- without logging authorization codes, access tokens, or user data.
alter table public.meta_oauth_attempts
  add column if not exists failure_stage text,
  add column if not exists failed_at timestamptz;
