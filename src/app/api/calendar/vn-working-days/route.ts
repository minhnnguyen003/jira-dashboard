import { NextRequest, NextResponse } from 'next/server';
import { calculateWorkingDays } from '@/lib/calendarWorkingDays.js';

interface HolidayItem {
  date: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get('year') || now.getFullYear());
  const month = Number(request.nextUrl.searchParams.get('month') || now.getMonth() + 1);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  try {
    const [holidayResponse, additionalResponse] = await Promise.all([
      fetch(`${request.nextUrl.origin}/holiday.json`),
      fetch(`${request.nextUrl.origin}/additional.json`),
    ]);
    if (!holidayResponse.ok) throw new Error(`Holiday file error: ${holidayResponse.status}`);
    if (!additionalResponse.ok) throw new Error(`Additional file error: ${additionalResponse.status}`);

    const holidayData = (await holidayResponse.json()) as { holidays: HolidayItem[] };
    const additionalData = (await additionalResponse.json()) as { additionalDays: HolidayItem[] };

    const holidayDates = new Set<string>(
      holidayData.holidays
        .filter((h) => {
          const d = new Date(`${h.date}T00:00:00.000Z`);
          return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
        })
        .map((h) => h.date)
    );
    const additionalDates = new Set<string>(
      additionalData.additionalDays
        .filter((day) => {
          const d = new Date(`${day.date}T00:00:00.000Z`);
          return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
        })
        .map((day) => day.date)
    );

    return NextResponse.json({
      year,
      month,
      holidayDates: Array.from(holidayDates).sort(),
      additionalDates: Array.from(additionalDates).sort(),
      workingDays: calculateWorkingDays(year, month, holidayDates, additionalDates),
      source: 'local-calendar-json',
    });
  } catch {
    const holidayDates = new Set<string>();
    return NextResponse.json({
      year,
      month,
      holidayDates: [],
      additionalDates: [],
      workingDays: calculateWorkingDays(year, month, holidayDates, new Set<string>()),
      source: 'fallback',
    });
  }
}
