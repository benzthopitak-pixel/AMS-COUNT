-- =====================================================================
-- AMS Count · ฐานข้อมูล Supabase
-- วิธีใช้: Supabase → SQL Editor → New query → วางไฟล์นี้ทั้งไฟล์ → Run
-- รันซ้ำได้ (ไม่ลบข้อมูลเดิม)
-- =====================================================================

-- ---------- 1) โปรไฟล์ผู้ใช้ (รหัสพนักงาน + ชื่อ + บทบาท) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  code       text unique not null,             -- รหัสพนักงาน ใช้ล็อกอิน
  name       text not null,
  role       text not null default 'counter' check (role in ('lead', 'counter')),
  active     boolean not null default false,   -- หัวหน้าต้องเปิดใช้ก่อน
  created_at timestamptz not null default now()
);

-- บทบาทของคนที่ล็อกอินอยู่ (null = ยังไม่เปิดใช้ / ไม่ได้ล็อกอิน)
create or replace function public.ams_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

-- สร้างโปรไฟล์อัตโนมัติเมื่อมีบัญชีใหม่
-- คนแรกที่สมัคร = หัวหน้า (เปิดใช้ทันที) · คนต่อไป = คนนับ (รอหัวหน้าเปิดใช้)
create or replace function public.ams_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare first_user boolean;
begin
  select not exists (select 1 from public.profiles) into first_user;
  insert into public.profiles (id, code, name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'code', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when first_user then 'lead' else 'counter' end,
    first_user
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists ams_on_auth_user on auth.users;
create trigger ams_on_auth_user after insert on auth.users
  for each row execute function public.ams_new_user();

-- ---------- 2) ข้อมูลรอบนับ + ทะเบียน (meta/round, master/c0..cN) ----------
create table if not exists public.kv (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- ---------- 3) ผลการสแกน / แก้ไข / ผลตัดสิน (1 แถว = 1 เหตุการณ์) ----------
create table if not exists public.events (
  id          text primary key,                 -- รหัสเฉพาะจากเครื่อง (ส่งซ้ำไม่ซ้ำ)
  round       text not null,
  dev         text not null,
  t           bigint not null,                  -- เวลาที่เกิดบนเครื่อง (ms)
  k           text not null check (k in ('scan', 'edit', 'del', 'rv')),
  code        text not null,
  by_name     text,
  data        jsonb not null,                   -- เหตุการณ์เต็ม
  created_by  uuid default auth.uid(),
  received_at timestamptz not null default now()
);
create index if not exists events_round_idx on public.events (round, t);
create index if not exists events_round_dev_idx on public.events (round, dev);

-- ---------- 4) สิทธิ์ (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.kv       enable row level security;
alter table public.events   enable row level security;

-- profiles: ทุกคนที่เปิดใช้แล้วเห็นรายชื่อทีม · ตัวเองเห็นของตัวเองเสมอ · หัวหน้าแก้ได้
drop policy if exists profiles_read  on public.profiles;
drop policy if exists profiles_lead  on public.profiles;
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.ams_role() is not null);
create policy profiles_lead on public.profiles for update
  using (public.ams_role() = 'lead') with check (public.ams_role() = 'lead');

-- kv: ทุกคนอ่านได้ · เฉพาะหัวหน้าเขียน (นำเข้าทะเบียน / มอบพื้นที่ / ปิดรอบ)
drop policy if exists kv_read  on public.kv;
drop policy if exists kv_write on public.kv;
create policy kv_read  on public.kv for select using (public.ams_role() is not null);
create policy kv_write on public.kv for all
  using (public.ams_role() = 'lead') with check (public.ams_role() = 'lead');

-- events: ทุกคนอ่านได้ · คนนับเพิ่มได้ยกเว้นผลตัดสิน (rv) · ห้ามแก้แถวเดิม · หัวหน้าลบได้ (ล้างรอบ)
drop policy if exists events_read   on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_delete on public.events;
create policy events_read on public.events for select using (public.ams_role() is not null);
create policy events_insert on public.events for insert
  with check (
    public.ams_role() = 'lead'
    or (public.ams_role() = 'counter' and k <> 'rv' and created_by = auth.uid())
  );
create policy events_delete on public.events for delete using (public.ams_role() = 'lead');

-- ---------- 5) Realtime: ให้เว็บกับแอปเห็นการเปลี่ยนแปลงทันที ----------
do $$ begin
  alter publication supabase_realtime add table public.kv;
exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; when undefined_object then null; end $$;

-- ---------- 6) ตัวช่วยตรวจ: จำนวนผลนับต่อเครื่องบนระบบ ----------
create or replace function public.ams_count_by_dev(p_round text, p_dev text) returns bigint
language sql stable security invoker set search_path = public as $$
  select count(*) from public.events where round = p_round and dev = p_dev
$$;

-- ---------- 7) ตัวช่วยหน้าเข้าสู่ระบบ: มีบัญชีในระบบแล้วหรือยัง (ไม่เปิดเผยรายชื่อ) ----------
create or replace function public.ams_has_users() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles)
$$;
grant execute on function public.ams_has_users() to anon, authenticated;

-- ---------- 8) หัวหน้าตั้ง PIN ใหม่ให้คนในทีม ----------
create or replace function public.ams_set_pin(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if public.ams_role() is distinct from 'lead' then raise exception 'เฉพาะหัวหน้า'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'PIN สั้นเกินไป'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = p_user;
end $$;
revoke all on function public.ams_set_pin(uuid, text) from public;
grant execute on function public.ams_set_pin(uuid, text) to authenticated;
