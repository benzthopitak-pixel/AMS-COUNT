/* AMS Count · ค่าการเชื่อมต่อ
 * ใส่ค่าจาก Supabase → Project Settings → API แล้วบันทึก (ดูคู่มือข้อ 2)
 * ใส่ได้เฉพาะ anon public key · ห้ามใส่ service_role key
 * ถ้าเว้นว่างไว้ แอปจะถามค่าเหล่านี้ตอนเปิดครั้งแรกแทน
 */
window.AMS_CONFIG = {
  SUPABASE_URL: 'https://yggcnezlwdzcveldyxcp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_8hHuHSkYaJ2qM_qX9o2sRQ_EfsrPLgS',
  // โดเมนสมมุติสำหรับสร้างบัญชีจากรหัสพนักงาน (ไม่มีการส่งอีเมลจริง) ไม่ต้องแก้
  LOGIN_DOMAIN: 'ams-count.example.com'
};
