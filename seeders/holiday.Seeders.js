// seeders/holiday.Seeder.js
//
// National holidays master list — India
// No company_id, no org_id — platform level
// HR imports from this list into their company
//
// Run order: after moduleSeeder

const HolidayMaster = require("../modules/holiday/models/holidayMaster.model");

const NATIONAL_HOLIDAYS_2026 = [
  { name: "New Year's Day",        date: "2026-01-01", type: "NATIONAL", country: "IN", isRecurring: true },
  { name: "Republic Day",          date: "2026-01-26", type: "NATIONAL", country: "IN", isRecurring: true },
  { name: "Holi",                  date: "2026-03-03", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Good Friday",           date: "2026-04-03", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Ram Navami",            date: "2026-03-28", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Eid ul-Fitr",           date: "2026-03-31", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Maharashtra Day",       date: "2026-05-01", type: "NATIONAL", country: "IN", isRecurring: true },
  { name: "Eid ul-Adha",           date: "2026-06-07", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Independence Day",      date: "2026-08-15", type: "NATIONAL", country: "IN", isRecurring: true },
  { name: "Janmashtami",           date: "2026-08-21", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Gandhi Jayanti",        date: "2026-10-02", type: "NATIONAL", country: "IN", isRecurring: true },
  { name: "Dussehra",              date: "2026-10-09", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Diwali",                date: "2026-10-29", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Diwali (Laxmi Puja)",   date: "2026-10-30", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Diwali (Bhai Dooj)",    date: "2026-11-01", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Guru Nanak Jayanti",    date: "2026-11-14", type: "NATIONAL", country: "IN", isRecurring: false },
  { name: "Christmas Day",         date: "2026-12-25", type: "NATIONAL", country: "IN", isRecurring: true },
];

exports.seedHolidays = async () => {
  try {
    let inserted = 0;
    let skipped  = 0;

    for (const holiday of NATIONAL_HOLIDAYS_2026) {
      const exists = await HolidayMaster.findOne({
        name:    holiday.name,
        date:    new Date(holiday.date),
        country: holiday.country,
      });

      if (!exists) {
        await HolidayMaster.create({
          ...holiday,
          date:     new Date(holiday.date),
          year:     new Date(holiday.date).getFullYear(),
          isActive: true,
        });
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(`✅ Holidays seeded — ${inserted} inserted, ${skipped} already existed`);
  } catch (err) {
    console.error("❌ Holiday seeder failed:", err.message);
  }
};