import { CalendarEvent } from '../types';

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string from an array of CalendarEvent items.
 */
export function generateICS(events: CalendarEvent[], calendarTitle = 'Advocate360 Chamber Fixtures'): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

  const formatDateToICS = (dateStr: string, timeStr?: string, durationHours = 2) => {
    // dateStr is 'YYYY-MM-DD'
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    let hours = 10;
    let minutes = 30;

    if (timeStr) {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const ampm = match[3]?.toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      }
    }

    // Convert IST (UTC+5:30) to UTC date object
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const localUtcTime = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0)).getTime();
    const utcDate = new Date(localUtcTime - istOffsetMs);

    const endUtcDate = new Date(utcDate.getTime() + durationHours * 60 * 60 * 1000);

    const formatUtcString = (d: Date) => {
      return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
    };

    return {
      start: formatUtcString(utcDate),
      end: formatUtcString(endUtcDate)
    };
  };

  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Advocate360 AI LegalOS//Chamber Hearing Sync//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarTitle}`,
    'X-WR-TIMEZONE:Asia/Kolkata'
  ];

  events.forEach((evt) => {
    const { start, end } = formatDateToICS(evt.date, evt.time);

    // Escape description text according to RFC 5545
    const descriptionText = [
      `Matter: ${evt.caseTitle}`,
      `Stage / Purpose: ${evt.hearingType}`,
      `Court & Room: ${evt.court}`,
      `Hon'ble Judge / Bench: ${evt.judge || 'Hon. Court'}`,
      `Chamber Case ID: ${evt.caseId}`,
      'Exported from Advocate360 AI LegalOS'
    ].join('\\n');

    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:hearing-${evt.id}-${evt.caseId.replace(/[^a-zA-Z0-9]/g, '')}@advocate360.legal`);
    icsLines.push(`DTSTAMP:${nowStamp}`);
    icsLines.push(`DTSTART:${start}`);
    icsLines.push(`DTEND:${end}`);
    icsLines.push(`SUMMARY:[COURT] ${evt.caseTitle} (${evt.hearingType})`);
    icsLines.push(`DESCRIPTION:${descriptionText}`);
    icsLines.push(`LOCATION:${evt.court}`);
    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('TRANSP:OPAQUE');
    icsLines.push('BEGIN:VALARM');
    icsLines.push('ACTION:DISPLAY');
    icsLines.push(`DESCRIPTION:Upcoming Hearing: ${evt.caseTitle}`);
    icsLines.push('TRIGGER:-PT2H'); // 2 hours prior reminder
    icsLines.push('END:VALARM');
    icsLines.push('END:VEVENT');
  });

  icsLines.push('END:VCALENDAR');
  return icsLines.join('\r\n');
}

/**
 * Triggers a browser download of the .ics file for Google Calendar, Apple Calendar, or Outlook.
 */
export function downloadICS(events: CalendarEvent[], fileName = 'Advocate360_Court_Hearings.ics', calendarTitle?: string) {
  if (!events || events.length === 0) {
    alert('No hearing events available to export.');
    return;
  }

  const content = generateICS(events, calendarTitle);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
