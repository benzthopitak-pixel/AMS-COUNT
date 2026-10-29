-- AMS Count · เพิ่มปุ่ม "ลบ" คนในทีม
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งหมดนี้ → Run (ครั้งเดียว)
create or replace function public.ams_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if public.ams_role() is distinct from 'lead' then raise exception 'เฉพาะ Admin'; end if;
  if p_user = auth.uid() then raise exception 'ลบบัญชีตัวเองไม่ได้'; end if;
  delete from auth.users where id = p_user;
end $$;
revoke all on function public.ams_delete_user(uuid) from public;
grant execute on function public.ams_delete_user(uuid) to authenticated;
