-- ZONE — Temporary Social Communication Schema (EU Region / GDPR Compliant)
-- Deploy on a European Supabase project (e.g., Frankfurt eu-central-1 or Ireland eu-west-1).
-- Enable Anonymous Sign-Ins in Supabase Dashboard -> Authentication -> Providers -> Anonymous.

create extension if not exists pgcrypto;

-- 1. Temporary Sessions (Anonymous Auth backed)
create table if not exists public.zone_profiles (
  uid uuid primary key references auth.users(id) on delete cascade,
  tag text not null,
  nickname text not null check (char_length(nickname) between 2 and 32),
  avatar_url text not null default '',
  bio text not null default '',
  custom_status text not null default '',
  presence text not null default 'online' check (presence in ('online', 'idle', 'dnd', 'invisible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Rooms (Public & Private with Configurable Retention)
create table if not exists public.zone_rooms (
  id text primary key,
  name text not null check (char_length(name) between 1 and 64),
  description text not null default '',
  icon_color text not null default '#3B82F6',
  invite_code text unique not null,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  retention text not null default 'until_close' check (retention in ('5m', '15m', '60m', 'until_close')),
  clear_on_close boolean not null default true,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.zone_room_members (
  room_id text not null references public.zone_rooms(id) on delete cascade,
  uid uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (room_id, uid)
);

-- 3. Channels (Text, Voice, Video)
create table if not exists public.zone_channels (
  id text primary key,
  room_id text not null references public.zone_rooms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 48),
  topic text not null default '',
  type text not null check (type in ('text', 'voice', 'video')),
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Temporary Files Registry (Mandatory 5-minute TTL)
create table if not exists public.zone_temp_files (
  id uuid primary key default gen_random_uuid(),
  room_id text references public.zone_rooms(id) on delete cascade,
  channel_id text references public.zone_channels(id) on delete cascade,
  uploader_uid uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index if not exists idx_zone_temp_files_expires_at on public.zone_temp_files (expires_at);

-- 5. Temporary Messages
create table if not exists public.zone_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.zone_rooms(id) on delete cascade,
  channel_id text not null references public.zone_channels(id) on delete cascade,
  author_uid uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  author_tag text not null,
  content text not null default '',
  temp_file_id uuid references public.zone_temp_files(id) on delete set null,
  file_expired boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_zone_messages_expires_at on public.zone_messages (expires_at);

-- 6. Row Level Security
alter table public.zone_profiles enable row level security;
alter table public.zone_rooms enable row level security;
alter table public.zone_room_members enable row level security;
alter table public.zone_channels enable row level security;
alter table public.zone_temp_files enable row level security;
alter table public.zone_messages enable row level security;

create policy "Authenticated anonymous users can read profiles"
  on public.zone_profiles for select using (auth.uid() is not null);
create policy "Users manage own profile"
  on public.zone_profiles for all using (auth.uid() = uid) with check (auth.uid() = uid);

create policy "Public rooms or joined rooms readable"
  on public.zone_rooms for select using (
    visibility = 'public' or exists (
      select 1 from public.zone_room_members m where m.room_id = id and m.uid = auth.uid()
    )
  );
create policy "Authenticated create room"
  on public.zone_rooms for insert with check (auth.uid() = owner_id);
create policy "Owner delete room"
  on public.zone_rooms for delete using (auth.uid() = owner_id);

create policy "Members read room membership"
  on public.zone_room_members for select using (
    exists (select 1 from public.zone_room_members m where m.room_id = room_id and m.uid = auth.uid())
  );
create policy "Users join or leave rooms"
  on public.zone_room_members for insert with check (auth.uid() = uid);
create policy "Users leave rooms"
  on public.zone_room_members for delete using (auth.uid() = uid);

create policy "Members read channels"
  on public.zone_channels for select using (
    exists (select 1 from public.zone_room_members m where m.room_id = room_id and m.uid = auth.uid())
  );

create policy "Members read non-expired temp files"
  on public.zone_temp_files for select using (
    now() < expires_at and exists (
      select 1 from public.zone_room_members m where m.room_id = room_id and m.uid = auth.uid()
    )
  );
create policy "Members insert temp files"
  on public.zone_temp_files for insert with check (auth.uid() = uploader_uid);

create policy "Members read non-expired messages"
  on public.zone_messages for select using (
    (expires_at is null or now() < expires_at) and exists (
      select 1 from public.zone_room_members m where m.room_id = room_id and m.uid = auth.uid()
    )
  );
create policy "Members send messages"
  on public.zone_messages for insert with check (auth.uid() = author_uid);
