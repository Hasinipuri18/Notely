-- Required for faculty names to appear on notes uploaded to the shared library.
alter table public.notes
  add column if not exists uploader_name text not null default 'Faculty';
