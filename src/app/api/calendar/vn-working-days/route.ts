import { NextRequest, NextResponse } from 'next/server';

interface HolidayItem {
  date: string;
  name: string;
}

function getMonthDateRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function isWeekday(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function calculateWorkingDays(year: number, month: number, holidayDates: Set<string>) {
  const { start, end } = getMonthDateRange(year, month);
  let workingDays = 0;

  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = toIsoDate(cursor);
    if (isWeekday(cursor) && !holidayDates.has(iso)) {
      workingDays += 1;
    }
  }

  return workingDays;
}

export async function GET(request: NextRequest) {
  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get('year') || now.getFullYear());
  const month = Number(request.nextUrl.searchParams.get('month') || now.getMonth() + 1);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
  }

  try {
    const response = await fetch(`${request.nextUrl.origin}/holiday.json`);
    if (!response.ok) throw new Error(`Holiday file error: ${response.status}`);
    const data = (await response.json()) as { holidays: HolidayItem[] };

    const holidayDates = new Set<string>(
      data.holidays
        .filter((h) => {
          const d = new Date(`${h.date}T00:00:00.000Z`);
          return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
        })
        .map((h) => h.date)
    );

    return NextResponse.json({
      year,
      month,
      holidayDates: Array.from(holidayDates).sort(),
      workingDays: calculateWorkingDays(year, month, holidayDates),
      source: 'local-holiday-json',
    });
  } catch {
    const holidayDates = new Set<string>();
    return NextResponse.json({
      year,
      month,
      holidayDates: [],
      workingDays: calculateWorkingDays(year, month, holidayDates),
      source: 'fallback',
    });
  }
}
