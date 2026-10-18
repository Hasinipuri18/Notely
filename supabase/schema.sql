-- Notely initial database schema for Supabase.
-- Apply this once in the Supabase SQL Editor on a new project.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9._-]{3,32}$'),
  display_name text not null default '',
  requested_role text not null default 'student' check (requested_role in ('student', 'faculty')),
  role text not null default 'student' check (role in ('student', 'faculty')),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

create table if not exists public.sections (
  id text primary key check (id in ('A', 'B', 'C', 'D')),
  name text not null unique
);

insert into public.sections (id, name) values
  ('A', 'Section A'),
  ('B', 'Section B'),
  ('C', 'Section C'),
  ('D', 'Section D')
on conflict (id) do update set name = excluded.name;

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  semester text not null check (semester in ('I Semester', 'II Semester')),
  title text not null,
  short_title text not null,
  type text not null check (type in ('Theory', 'Lab')),
  sort_order smallint not null,
  unique (semester, title)
);

insert into public.subjects (semester, title, short_title, type, sort_order) values
  ('I Semester', 'Mathematical and Statistical Foundations', 'MSF', 'Theory', 1),
  ('I Semester', 'Computer Organization and Architecture', 'COA', 'Theory', 2),
  ('I Semester', 'Object Oriented Programming through Java', 'OOP''S through JAVA', 'Theory', 3),
  ('I Semester', 'Software Engineering', 'SE', 'Theory', 4),
  ('I Semester', 'Database Management System', 'DBMS', 'Theory', 5),
  ('I Semester', 'Computational Mathematics Lab', 'CM lab', 'Lab', 6),
  ('I Semester', 'Object Oriented Programming through Java Lab', 'OOP''S through JAVA lab', 'Lab', 7),
  ('I Semester', 'Software Engineering Lab', 'SE lab', 'Lab', 8),
  ('I Semester', 'Database Management Systems Lab', 'DBMS lab', 'Lab', 9),
  ('I Semester', 'Node JS/React JS/Django', 'Node JS/React JS/Django', 'Lab', 10),
  ('II Semester', 'Discrete Mathematics', 'DM', 'Theory', 1),
  ('II Semester', 'Operating Systems', 'OS', 'Theory', 2),
  ('II Semester', 'Algorithms Design and Analysis', 'ADA', 'Theory', 3),
  ('II Semester', 'Computer Networks', 'CN', 'Theory', 4),
  ('II Semester', 'Machine Learning', 'ML', 'Theory', 5),
  ('II Semester', 'Innovation and Entrepreneurship', 'IE', 'Theory', 6),
  ('II Semester', 'Operating Systems Lab', 'OS lab', 'Lab', 7),
  ('II Semester', 'Computer Networks Lab', 'CN lab', 'Lab', 8),
  ('II Semester', 'Machine Learning Lab', 'ML lab', 'Lab', 9),
  ('II Semester', 'Data Visualization - R Programming/ Power BI', 'Power BI', 'Lab', 10),
  ('II Semester', 'Indian Knowledge System', 'Indian Knowledge System', 'Theory', 11)
on conflict (semester, title) do update set
  short_title = excluded.short_title,
  type = excluded.type,
  sort_order = excluded.sort_order;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  unit_label text not null check (length(trim(unit_label)) between 1 and 80),
  title text not null check (length(trim(title)) between 1 and 100),
  uploader_name text not null default 'Faculty',
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes
  add column if not exists uploader_name text not null default 'Faculty';

create index if not exists notes_subject_created_idx
  on public.notes (subject_id, created_at desc);
create index if not exists notes_uploaded_by_created_idx
  on public.notes (uploaded_by, created_at desc);

create table if not exists public.note_sections (
  note_id uuid not null references public.notes (id) on delete cascade,
  section_id text not null references public.sections (id) on delete restrict,
  primary key (note_id, section_id)
);
create index if not exists note_sections_section_idx
  on public.note_sections (section_id, note_id);

create table if not exists public.saved_notes (
  student_id uuid not null references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (student_id, note_id)
);

create table if not exists public.recently_viewed_notes (
  student_id uuid not null references public.profiles (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (student_id, note_id)
);
create index if not exists recently_viewed_student_date_idx
  on public.recently_viewed_notes (student_id, viewed_at desc);

create table if not exists public.upload_reminders (
  id uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  unit_label text not null check (length(trim(unit_label)) between 1 and 80),
  remind_at timestamptz not null,
  completed_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists upload_reminders_faculty_date_idx
  on public.upload_reminders (faculty_id, remind_at);

create table if not exists public.reminder_sections (
  reminder_id uuid not null references public.upload_reminders (id) on delete cascade,
  section_id text not null references public.sections (id) on delete restrict,
  primary key (reminder_id, section_id)
);

-- Requested faculty access is recorded, but new accounts remain students until
-- the project owner approves and promotes them in the Supabase dashboard.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, requested_role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, new.phone, 'student'), '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), ''),
    case when new.raw_user_meta_data ->> 'requested_role' = 'faculty' then 'faculty' else 'student' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_notely on auth.users;
create trigger on_auth_user_created_notely
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();
revoke all on function public.create_profile_for_new_user() from public, anon, authenticated;

create or replace function public.current_user_has_role(expected_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = expected_role
  );
$$;

revoke all on function public.current_user_has_role(text) from public, anon;
grant execute on function public.current_user_has_role(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.sections enable row level security;
alter table public.subjects enable row level security;
alter table public.notes enable row level security;
alter table public.note_sections enable row level security;
alter table public.saved_notes enable row level security;
alter table public.recently_viewed_notes enable row level security;
alter table public.upload_reminders enable row level security;
alter table public.reminder_sections enable row level security;

revoke all on public.profiles, public.sections, public.subjects, public.notes,
  public.note_sections, public.saved_notes, public.recently_viewed_notes,
  public.upload_reminders, public.reminder_sections from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.sections, public.subjects to authenticated;
grant select, insert, update, delete on public.notes, public.note_sections,
  public.saved_notes, public.recently_viewed_notes, public.upload_reminders,
  public.reminder_sections to authenticated;

create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "Users can update their display name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Signed-in users can read sections"
  on public.sections for select to authenticated using (true);
create policy "Signed-in users can read subjects"
  on public.subjects for select to authenticated using (true);

create policy "Signed-in users can read notes"
  on public.notes for select to authenticated using (true);
create policy "Faculty can publish their own notes"
  on public.notes for insert to authenticated
  with check ((select auth.uid()) = uploaded_by and (select public.current_user_has_role('faculty')));
create policy "Faculty can update their own notes"
  on public.notes for update to authenticated
  using ((select auth.uid()) = uploaded_by and (select public.current_user_has_role('faculty')))
  with check ((select auth.uid()) = uploaded_by and (select public.current_user_has_role('faculty')));
create policy "Faculty can delete their own notes"
  on public.notes for delete to authenticated
  using ((select auth.uid()) = uploaded_by and (select public.current_user_has_role('faculty')));

create policy "Signed-in users can read note sections"
  on public.note_sections for select to authenticated using (true);
create policy "Faculty can set sections on their notes"
  on public.note_sections for insert to authenticated
  with check (
    (select public.current_user_has_role('faculty')) and exists (
      select 1 from public.notes n
      where n.id = note_id and n.uploaded_by = (select auth.uid())
    )
  );
create policy "Faculty can remove sections from their notes"
  on public.note_sections for delete to authenticated
  using (
    (select public.current_user_has_role('faculty')) and exists (
      select 1 from public.notes n
      where n.id = note_id and n.uploaded_by = (select auth.uid())
    )
  );

create policy "Students can read their saved notes"
  on public.saved_notes for select to authenticated
  using ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));
create policy "Students can save notes for themselves"
  on public.saved_notes for insert to authenticated
  with check ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));
create policy "Students can unsave their notes"
  on public.saved_notes for delete to authenticated
  using ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));

create policy "Students can read their own recent history"
  on public.recently_viewed_notes for select to authenticated
  using ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));
create policy "Students can record their own views"
  on public.recently_viewed_notes for insert to authenticated
  with check ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));
create policy "Students can update their own view timestamps"
  on public.recently_viewed_notes for update to authenticated
  using ((select auth.uid()) = student_id and (select public.current_user_has_role('student')))
  with check ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));
create policy "Students can clear their own view history"
  on public.recently_viewed_notes for delete to authenticated
  using ((select auth.uid()) = student_id and (select public.current_user_has_role('student')));

create policy "Faculty can read their reminders"
  on public.upload_reminders for select to authenticated
  using ((select auth.uid()) = faculty_id and (select public.current_user_has_role('faculty')));
create policy "Faculty can create their reminders"
  on public.upload_reminders for insert to authenticated
  with check ((select auth.uid()) = faculty_id and (select public.current_user_has_role('faculty')));
create policy "Faculty can update their reminders"
  on public.upload_reminders for update to authenticated
  using ((select auth.uid()) = faculty_id and (select public.current_user_has_role('faculty')))
  with check ((select auth.uid()) = faculty_id and (select public.current_user_has_role('faculty')));
create policy "Faculty can delete their reminders"
  on public.upload_reminders for delete to authenticated
  using ((select auth.uid()) = faculty_id and (select public.current_user_has_role('faculty')));

create policy "Faculty can read sections for their reminders"
  on public.reminder_sections for select to authenticated
  using (exists (
    select 1 from public.upload_reminders r
    where r.id = reminder_id and r.faculty_id = (select auth.uid())
  ));
create policy "Faculty can add sections to their reminders"
  on public.reminder_sections for insert to authenticated
  with check ((select public.current_user_has_role('faculty')) and exists (
    select 1 from public.upload_reminders r
    where r.id = reminder_id and r.faculty_id = (select auth.uid())
  ));
create policy "Faculty can remove sections from their reminders"
  on public.reminder_sections for delete to authenticated
  using ((select public.current_user_has_role('faculty')) and exists (
    select 1 from public.upload_reminders r
    where r.id = reminder_id and r.faculty_id = (select auth.uid())
  ));

-- Private Storage bucket: clients upload files to {auth-user-id}/{note-id}/{filename}.
insert into storage.buckets (id, name, public)
values ('notely-notes', 'notely-notes', false)
on conflict (id) do update set public = false;

create policy "Signed-in users can read note files"
  on storage.objects for select to authenticated
  using (bucket_id = 'notely-notes');
create policy "Faculty can upload files in their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'notely-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_user_has_role('faculty'))
  );
create policy "Faculty can update files in their own folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'notely-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_user_has_role('faculty'))
  )
  with check (
    bucket_id = 'notely-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_user_has_role('faculty'))
  );
create policy "Faculty can delete files in their own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'notely-notes'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
    and (select public.current_user_has_role('faculty'))
  );
