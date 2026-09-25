/**
 * Careers page area (/careers)
 *
 * แยกจากพจนานุกรมก้อนเดียว (เดิมอยู่ lib/i18n/messages/en.ts) เพื่อให้
 * แต่ละพื้นที่มีไฟล์ของตัวเอง — ดูเพดานขนาดต่อพื้นที่ใน scripts/check-i18n.ts
 */

  /*
    The /careers page — round 16.
    Real data from the HR department's `Work with Wai Wai.txt` (20 positions).
    ⚠️ Job adverts change often, and the "gender"/"age" columns are sensitive data — see PRODUCT_ROADMAP.md § 9.
    The openings count lives in features/careers/jobs.ts, not in the dictionary.
    NOTE: this English copy is my translation — it must be reviewed by HR before the site goes live.
  */
export const careersPage = {
    meta: {
      title: "Work with Wai Wai — open positions",
      description:
        "Open positions at Thai Preserved Food Factory Co., Ltd. (Wai Wai) across production, engineering, sales and marketing, with how to apply.",
    },
    eyebrow: "Work with Wai Wai",
    title: "Work with Wai Wai",
    intro:
      "Join a Thai company that has been making Wai Wai instant noodles for decades. We have openings across production, engineering, sales and marketing.",
    stats: {
      positions: "Open positions",
      openings: "Openings",
      departments: "Departments",
    },
    boardTitle: "Open positions",
    boardIntro: "Browse by department, or press “All” to see every position.",
    filterGroup: "Filter positions by department",
    filterAll: "All",
    positionUnit: "positions",
    openingsUnit: "openings",
    empty: "There are no positions in this department yet.",
    notSpecified: "Not specified",
    fields: {
      gender: "Gender",
      age: "Age",
      qualifications: "Qualifications",
      experience: "Experience",
    },
    genders: {
      male: "Male",
      female: "Female",
      any: "No preference",
    },
    departments: {
      salesUpcountry: "Upcountry sales",
      salesBangkok: "Bangkok sales",
      productionPlanning: "Production planning",
      executiveOffice: "Executive office",
      marketingActivities: "Marketing activities",
      productManagement: "Product management",
      keyAccount: "Key account",
      pcSalesPromotion: "PC – sales promotion",
      specialEvents: "Special events",
      stSalesPromotion: "ST – sales promotion",
      engineering2: "Engineering 2",
    },
    jobs: {
      driverUpcountry: {
        title: "Driver",
        gender: "male",
        age: "25 and over",
        qualifications:
          "Prathom 6 or above; holds a type 2 driving licence; has a guarantor",
        experience: null,
      },
      salesUpcountry: {
        title: "Sales representative",
        gender: "male",
        age: "25 and over",
        qualifications:
          "Mathayom 6 or above; able to travel upcountry; has a guarantor",
        experience: null,
      },
      driverBangkok: {
        title: "Driver",
        gender: "male",
        age: "22 and over",
        qualifications: "Mathayom 3 or above; holds a type 2 driving licence; has a guarantor",
        experience: "0-1 years",
      },
      securityGuard: {
        title: "Security guard (level 2)",
        gender: "male",
        age: "25-45",
        qualifications: "Mathayom 3 or above",
        experience: null,
      },
      airconTechnician: {
        title: "Air-conditioning technician, Factory 1",
        gender: "male",
        age: "21-35",
        qualifications:
          "Vocational certificate or diploma in electrical or air-conditioning work, or a related field",
        experience: "1-2 years",
      },
      marketingManager: {
        title: "Manager / Assistant manager",
        gender: "any",
        age: "30-35",
        qualifications: "Bachelor's degree in business administration or marketing",
        experience: "5-10 years",
      },
      productManager: {
        title: "Manager / Assistant manager",
        gender: "any",
        age: "25-30",
        qualifications:
          "Bachelor's degree or above in marketing; able to travel upcountry; owns a car",
        experience: "5 years",
      },
      asstManagerKeyAccount: {
        title: "Assistant manager",
        gender: "female",
        age: "30 and over",
        qualifications: "Bachelor's degree in marketing",
        experience: "5 years",
      },
      departmentHeadPc: {
        title: "Department head",
        gender: "female",
        age: "30 and over",
        qualifications: "Bachelor's degree in marketing",
        experience: "5-10 years",
      },
      asstDepartmentHeadKeyAccount: {
        title: "Assistant department head",
        gender: "any",
        age: "25 and over",
        qualifications: "Bachelor's degree in marketing",
        experience: "3 years and over",
      },
      unitHeadPc: {
        title: "Unit head",
        gender: "any",
        age: "35-40",
        qualifications: "Bachelor's degree in marketing or a related field",
        experience: "1 year and over",
      },
      driverSpecialEvents: {
        title: "Driver",
        gender: "male",
        age: "25-35",
        qualifications: "Mathayom 3 or equivalent; holds a type 2 driving licence",
        experience: "1 year",
      },
      specialEventsStaff: {
        title: "Special events staff",
        gender: "female",
        age: "20-30",
        qualifications: "Mathayom 3 or above; able to work upcountry",
        experience: null,
      },
      pcStaff: {
        title: "PC staff",
        gender: "female",
        age: "25-35",
        qualifications: "Mathayom 3 or above; able to cook and to do calculations",
        experience: null,
      },
      electricianM1M3: {
        title: "Electrician, M 1 / M 3",
        gender: "male",
        age: "21-45",
        qualifications:
          "Vocational certificate to bachelor's degree in power electrical or electronics; able to work shifts",
        experience: "1-2 years",
      },
      machineTechnicianM1: {
        title: "Packing machine / maintenance technician, M 1",
        gender: "male",
        age: "20 and over",
        qualifications: "Vocational diploma in electrical work; able to repair machinery",
        experience: "1-2 years",
      },
      machineTechnicianM3: {
        title: "Packing machine / maintenance technician, M 3",
        gender: "male",
        age: "22",
        qualifications: "Vocational diploma in electrical work; able to repair machinery",
        experience: null,
      },
      boilerShiftHead: {
        title: "Shift leader, boiler operators",
        gender: "male",
        age: "25 and over",
        qualifications:
          "Vocational diploma in automotive or mechanical work; a boiler operator licence is an advantage",
        experience: "2 years",
      },
      boilerElectrician: {
        title: "Boiler electrician, 2, shift 3",
        gender: "male",
        age: "25 and over",
        qualifications:
          "Vocational diploma in power electrical work with factory electrical experience; able to work overtime on Sundays",
        experience: null,
      },
      boilerStaff: {
        title: "Boiler operator",
        gender: "male",
        age: "26 and over",
        qualifications: "Prathom 6; able to work overtime on holidays",
        experience: null,
      },
    },
    applyTitle: "How to apply",
    applyIntro: "Apply by e-mail, by post, or in person.",
    applyEmailLabel: "E-mail",
    applyPhoneLabel: "Phone",
    applyMobileLabel: "Mobile",
    applyExtLabel: "ext.",
    applyAddressLabel: "Address",
    applyContactLabel: "Contact",
    companyName: "Thai Preserved Food Factory Co., Ltd.",
    address: "42/1 Moo 2, Om Yai, Sam Phran, Nakhon Pathom 73160, Thailand",
    contactPerson: "Khun Paweephat Tangchokwattana",
    aboutLink: "About the company and employee benefits",
    note: "Positions and numbers follow the HR department's advert — please check with HR before applying in case it has been updated.",
};
