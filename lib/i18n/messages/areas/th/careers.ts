/**
 * พื้นที่หน้าร่วมงานกับไวไว (/careers)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/th.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    หน้า /careers (ร่วมงานกับไวไว) — รอบที่ 16
    ข้อมูลจริงจากไฟล์ `Work with Wai Wai.txt` ของฝ่ายบุคคล (20 ตำแหน่ง)
    ⚠️ ประกาศรับสมัครเปลี่ยนบ่อย และช่อง "เพศ"/"อายุ" เป็นข้อมูลอ่อนไหว — ดู PRODUCT_ROADMAP.md § 9
    ตัวเลขจำนวนอัตรา (openings) อยู่ใน features/careers/jobs.ts ไม่ได้อยู่ในพจนานุกรม
  */
export const careersPage = {
    meta: {
      title: "ร่วมงานกับไวไว — ตำแหน่งที่เปิดรับ",
      description:
        "ตำแหน่งงานที่เปิดรับของบริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด (ไวไว) ทั้งสายการผลิต วิศวกรรม ขาย และการตลาด พร้อมวิธีสมัคร",
    },
    eyebrow: "ร่วมงานกับไวไว",
    title: "ร่วมงานกับไวไว",
    intro:
      "ร่วมเป็นส่วนหนึ่งขององค์กรไทยที่ผลิตบะหมี่กึ่งสำเร็จรูปไวไวมาอย่างยาวนาน เรามีตำแหน่งเปิดรับทั้งสายการผลิต วิศวกรรม ขาย และการตลาด",
    stats: {
      positions: "ตำแหน่งที่เปิดรับ",
      openings: "อัตราที่เปิดรับ",
      departments: "ฝ่ายที่เปิดรับ",
    },
    boardTitle: "ตำแหน่งที่เปิดรับ",
    boardIntro: "เลือกดูตามฝ่าย หรือกด “ทั้งหมด” เพื่อดูทุกตำแหน่ง",
    filterGroup: "กรองตำแหน่งตามฝ่าย",
    filterAll: "ทั้งหมด",
    positionUnit: "ตำแหน่ง",
    openingsUnit: "อัตรา",
    empty: "ยังไม่มีตำแหน่งในฝ่ายนี้",
    notSpecified: "ไม่ระบุ",
    fields: {
      gender: "เพศ",
      age: "อายุ",
      qualifications: "คุณสมบัติ",
      experience: "ประสบการณ์",
    },
    genders: {
      male: "ชาย",
      female: "หญิง",
      any: "ไม่จำกัด",
    },
    departments: {
      salesUpcountry: "ขายต่างจังหวัด",
      salesBangkok: "ขายกรุงเทพฯ",
      productionPlanning: "วางแผนการผลิต",
      executiveOffice: "สำนักกรรมการฯ",
      marketingActivities: "กิจกรรมการตลาด",
      productManagement: "บริหารผลิตภัณฑ์",
      keyAccount: "key-account",
      pcSalesPromotion: "PC-ส่งเสริมการตลาด",
      specialEvents: "กิจกรรมพิเศษ",
      stSalesPromotion: "ST-ส่งเสริมการตลาด",
      engineering2: "วิศวกรรม 2",
    },
    jobs: {
      driverUpcountry: {
        title: "พนักงานขับรถ",
        gender: "male",
        age: "25 ปีขึ้นไป",
        qualifications: "ป.6 ขึ้นไป มีใบขับขี่ประเภท 2 มีคนค้ำประกัน",
        experience: null,
      },
      salesUpcountry: {
        title: "พนักงานขาย",
        gender: "male",
        age: "25 ปีขึ้นไป",
        qualifications: "ม.6 ขึ้นไป ออกต่างจังหวัดได้ มีบุคคลค้ำประกัน",
        experience: null,
      },
      driverBangkok: {
        title: "พนักงานขับรถ",
        gender: "male",
        age: "22 ปีขึ้นไป",
        qualifications: "ม.3 ขึ้นไป มีใบขับขี่ประเภท 2 มีคนค้ำประกัน",
        experience: "0-1 ปี",
      },
      securityGuard: {
        title: "รปภ. 2",
        gender: "male",
        age: "25-45 ปี",
        qualifications: "ม.3 ขึ้นไป",
        experience: null,
      },
      airconTechnician: {
        title: "ช่างแอร์ โรงงาน 1",
        gender: "male",
        age: "21-35 ปี",
        qualifications: "ปวช.-ปวส. ช่างไฟฟ้า ช่างเครื่องปรับอากาศ หรือสาขาที่เกี่ยวข้อง",
        experience: "1-2 ปี",
      },
      marketingManager: {
        title: "ผู้จัดการ / ผู้ช่วยผู้จัดการ",
        gender: "any",
        age: "30-35 ปี",
        qualifications: "ป.ตรี บริหารธุรกิจ การตลาด",
        experience: "5-10 ปี",
      },
      productManager: {
        title: "ผู้จัดการ / ผู้ช่วยผู้จัดการ",
        gender: "any",
        age: "25-30 ปี",
        qualifications: "ป.ตรีขึ้นไป การตลาด ออกต่างจังหวัดได้ มีรถยนต์ส่วนตัว",
        experience: "5 ปี",
      },
      asstManagerKeyAccount: {
        title: "ผู้ช่วยผู้จัดการ",
        gender: "female",
        age: "30 ปีขึ้นไป",
        qualifications: "ป.ตรี การตลาด",
        experience: "5 ปี",
      },
      departmentHeadPc: {
        title: "หัวหน้าแผนก",
        gender: "female",
        age: "30 ปีขึ้นไป",
        qualifications: "ป.ตรี การตลาด",
        experience: "5-10 ปี",
      },
      asstDepartmentHeadKeyAccount: {
        title: "ผู้ช่วยหัวหน้าแผนก",
        gender: "any",
        age: "25 ปีขึ้นไป",
        qualifications: "ป.ตรี การตลาด",
        experience: "3 ปีขึ้นไป",
      },
      unitHeadPc: {
        title: "หัวหน้าหน่วย",
        gender: "any",
        age: "35-40 ปี",
        qualifications: "ป.ตรี การตลาดหรือสาขาที่เกี่ยวข้อง",
        experience: "1 ปีขึ้นไป",
      },
      driverSpecialEvents: {
        title: "พนักงานขับรถ",
        gender: "male",
        age: "25-35 ปี",
        qualifications: "ม.3 หรือเทียบเท่า มีใบขับขี่ประเภท 2",
        experience: "1 ปี",
      },
      specialEventsStaff: {
        title: "พนักงานกิจกรรมพิเศษ",
        gender: "female",
        age: "20-30 ปี",
        qualifications: "ม.3 ขึ้นไป ทำงานออกต่างจังหวัดได้",
        experience: null,
      },
      pcStaff: {
        title: "พนักงานพีซี",
        gender: "female",
        age: "25-35 ปี",
        qualifications: "ม.3 ขึ้นไป ทำอาหารได้ / คิดคำนวณได้",
        experience: null,
      },
      electricianM1M3: {
        title: "ช่างไฟฟ้า M 1 / M 3",
        gender: "male",
        age: "21-45 ปี",
        qualifications: "ปวช.-ป.ตรี ไฟฟ้ากำลัง/อิเล็กทรอนิกส์ เข้ากะได้",
        experience: "1-2 ปี",
      },
      machineTechnicianM1: {
        title: "ช่างเครื่องห่อ / ช่างซ่อมบำรุง M 1",
        gender: "male",
        age: "20 ปีขึ้นไป",
        qualifications: "ปวส. ไฟฟ้า สามารถซ่อมเครื่องจักรได้",
        experience: "1-2 ปี",
      },
      machineTechnicianM3: {
        title: "ช่างเครื่องห่อ / ช่างซ่อมบำรุง M 3",
        gender: "male",
        age: "22 ปี",
        qualifications: "ปวส. ไฟฟ้า สามารถซ่อมเครื่องจักรได้",
        experience: null,
      },
      boilerShiftHead: {
        title: "หัวหน้ากะผู้ควบคุมหม้อไอน้ำ",
        gender: "male",
        age: "25 ปีขึ้นไป",
        qualifications: "ปวส. ช่างยนต์ ช่างกล มีใบควบคุมหม้อไอน้ำ จะพิจารณาเป็นพิเศษ",
        experience: "2 ปี",
      },
      boilerElectrician: {
        title: "ช่างไฟฟ้าหม้อไอน้ำ 2 กะ 3",
        gender: "male",
        age: "25 ปีขึ้นไป",
        qualifications: "ปวส. ไฟฟ้ากำลัง ด้านไฟฟ้าโรงงาน ทำโอทีวันอาทิตย์ได้",
        experience: null,
      },
      boilerStaff: {
        title: "พนักงานหม้อไอน้ำ",
        gender: "male",
        age: "26 ปีขึ้นไป",
        qualifications: "ป.6 ทำโอทีในวันหยุดได้",
        experience: null,
      },
    },
    applyTitle: "วิธีการสมัคร",
    applyIntro: "สมัครผ่านทาง e-mail จดหมายสมัครงาน หรือสมัครด้วยตนเอง",
    applyEmailLabel: "อีเมล",
    applyPhoneLabel: "โทรศัพท์",
    applyMobileLabel: "มือถือ",
    applyExtLabel: "ต่อ",
    applyAddressLabel: "ที่อยู่",
    applyContactLabel: "ผู้ประสานงาน",
    companyName: "บริษัท โรงงานผลิตภัณฑ์อาหารไทย จำกัด",
    address: "42/1 ม.2 ต.อ้อมใหญ่ อ.สามพราน จ.นครปฐม 73160",
    contactPerson: "คุณปวีณ์พัชญ์ ตั้งโชควัฒนะ",
    aboutLink: "รู้จักบริษัทและสวัสดิการ",
    note: "ตำแหน่งและจำนวนอัตราตามประกาศของฝ่ายบุคคล — หากอัปเดตแล้ว ควรตรวจสอบกับฝ่ายบุคคลอีกครั้งก่อนสมัคร",
};
