/* AssetSync · เริ่มทำงาน: วาดหน้าจอและเชื่อมต่อฐานข้อมูล (ไฟล์นี้ต้องโหลดเป็นไฟล์สุดท้าย) */
document.fonts?.ready?.then(() => render());
render();
connect();
