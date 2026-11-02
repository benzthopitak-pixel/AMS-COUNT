/* AMS Count · ค่าการเชื่อมต่อ
 * ใส่ค่าจาก Supabase → Project Settings → API แล้วบันทึก (ดูคู่มือข้อ 2)
 * ใส่ได้เฉพาะ anon public key · ห้ามใส่ service_role key
 * ถ้าเว้นว่างไว้ แอปจะถามค่าเหล่านี้ตอนเปิดครั้งแรกแทน
 */
window.AMS_CONFIG = {
  SUPABASE_URL: 'https://hcjbjbdjddnnutpwjbny.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_3f4E6MIXQOxMS7Ss_2uG2g_LEcwPH4k',
  // ใช้ฐานข้อมูลเดียวกับ Inventory Tools · ล็อกอินด้วยรหัสพนักงาน + รหัสผ่านชุดเดียวกัน
  LOGIN_DOMAIN: 'ipone.co.th'
};
