import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { addCalendarEntry, deleteCalendarEntry, updateCalendarEntry } from '@/lib/calendarConfig.js';

type CalendarType = 'holiday' | 'additional';
type CalendarEntry = { date: string; name: string };

const calendarFiles: Record<CalendarType, { fileName: string; listKey: 'holidays' | 'additionalDays' }> = {
  holiday: { fileName: 'holiday.json', listKey: 'holidays' },
  additional: { fileName: 'additional.json', listKey: 'additionalDays' },
};

function getConfig(type: unknown) {
  if (type !== 'holiday' && type !== 'additional') throw new Error('Loại ngày không hợp lệ.');
  return calendarFiles[type];
}

async function readCalendar(type: CalendarType) {
  const config = getConfig(type);
  const filePath = path.join(process.cwd(), 'public', config.fileName);
  const data = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  const entries = Array.isArray(data[config.listKey]) ? data[config.listKey] as CalendarEntry[] : [];
  return { config, filePath, data, entries };
}

async function writeCalendar(type: CalendarType, entries: CalendarEntry[]) {
  const { config, filePath, data } = await readCalendar(type);
  const nextData = { ...data, [config.listKey]: entries };
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(nextData, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
  return nextData;
}

export async function GET() {
  try {
    const [holiday, additional] = await Promise.all([readCalendar('holiday'), readCalendar('additional')]);
    return NextResponse.json({ holidays: holiday.entries, additionalDays: additional.entries });
  } catch {
    return NextResponse.json({ error: 'Không thể đọc dữ liệu lịch.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type as CalendarType;
    const { entries } = await readCalendar(type);
    const updated = addCalendarEntry(entries, body.entry);
    const data = await writeCalendar(type, updated);
    return NextResponse.json({ entries: data[getConfig(type).listKey] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể lưu dữ liệu lịch.' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const type = body.type as CalendarType;
    const { entries } = await readCalendar(type);
    const updated = updateCalendarEntry(entries, body.originalDate, body.entry);
    const data = await writeCalendar(type, updated);
    return NextResponse.json({ entries: data[getConfig(type).listKey] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu lịch.' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type') as CalendarType;
    const date = request.nextUrl.searchParams.get('date');
    if (!date) throw new Error('Ngày cần xóa là bắt buộc.');
    const { entries } = await readCalendar(type);
    const updated = deleteCalendarEntry(entries, date);
    const data = await writeCalendar(type, updated);
    return NextResponse.json({ entries: data[getConfig(type).listKey] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Không thể xóa dữ liệu lịch.' }, { status: 400 });
  }
}
