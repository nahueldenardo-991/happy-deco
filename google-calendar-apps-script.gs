const HAPPY_DECO_SECRET = "happy-deco-calendar-2026";
const DEFAULT_CALENDAR_NAME = "Happy Deco - Eventos";
const DEFAULT_SHARE_WITH = [
  "happydecoar@gmail.com",
  "julietaalvarezpaz12@gmail.com",
  "cataovejero2025@gmail.com",
  "oliveravaleriaximena@gmail.com"
];

function doGet(e) {
  const callback = e.parameter.callback || "";
  try {
    const payload = JSON.parse(e.parameter.payload || "{}");
    const result = upsertHappyDecoEvent_(payload);
    if (callback) return jsonpResponse_(callback, result);
    return htmlResponse_(
      "Evento agendado",
      `El evento "${escapeHtml_(result.title)}" quedó agendado en ${escapeHtml_(result.calendarName)}. Ya podés cerrar esta pestaña.`
    );
  } catch (error) {
    const result = { ok: false, error: error.message || String(error) };
    if (callback) return jsonpResponse_(callback, result);
    return htmlResponse_("No se pudo agendar", escapeHtml_(error.message || String(error)));
  }
}

function upsertHappyDecoEvent_(payload) {
  if (!payload || payload.secret !== HAPPY_DECO_SECRET) {
    throw new Error("Clave interna inválida.");
  }
  if (!payload.date) {
    throw new Error("Falta la fecha del evento.");
  }

  const calendarName = payload.calendarName || DEFAULT_CALENDAR_NAME;
  const calendar = getOrCreateCalendar_(calendarName);
  const shareWith = payload.shareWith || DEFAULT_SHARE_WITH;
  shareCalendar_(calendar, shareWith);

  const sourceId = payload.sourceId || Utilities.getUuid();
  const title = payload.title || "Happy Deco - Evento";
  const date = parseDate_(payload.date);
  const description = [
    payload.description || "",
    "",
    `HAPPY_DECO_DASHBOARD_ID:${sourceId}`
  ].join("\n").trim();

  let event = findExistingEvent_(calendar, sourceId, date);
  if (event) {
    event.setTitle(title);
    event.setAllDayDate(date);
    event.setDescription(description);
    event.setLocation(payload.location || "");
    clearReminders_(event);
  } else {
    event = calendar.createAllDayEvent(title, date, {
      description,
      location: payload.location || ""
    });
  }

  const reminders = payload.remindersMinutes || [21600, 10080, 4320, 0];
  reminders.forEach(minutes => event.addPopupReminder(Number(minutes)));
  const guests = syncGuests_(event, shareWith);

  return {
    ok: true,
    eventId: event.getId(),
    title,
    calendarName,
    calendarId: calendar.getId(),
    guests
  };
}

function getOrCreateCalendar_(name) {
  const calendars = CalendarApp.getCalendarsByName(name);
  if (calendars.length) return calendars[0];
  const calendar = CalendarApp.createCalendar(name, {
    summary: "Calendario compartido de eventos Happy Deco"
  });
  calendar.setColor(CalendarApp.Color.TURQUOISE);
  return calendar;
}

function shareCalendar_(calendar, emails) {
  emails.forEach(email => {
    if (!email) return;
    try {
      calendar.addEditor(email);
    } catch (error) {
      try {
        calendar.addViewer(email);
      } catch (ignored) {}
    }
  });
}

function syncGuests_(event, emails) {
  const targetEmails = Array.from(new Set((emails || []).filter(Boolean)));
  const existing = event.getGuestList().map(guest => guest.getEmail().toLowerCase());
  targetEmails.forEach(email => {
    try {
      if (!existing.includes(String(email).toLowerCase())) event.addGuest(email);
    } catch (error) {}
  });
  return targetEmails;
}

function findExistingEvent_(calendar, sourceId, eventDate) {
  const start = new Date(eventDate);
  start.setDate(start.getDate() - 1);
  const end = new Date(eventDate);
  end.setDate(end.getDate() + 2);
  const marker = `HAPPY_DECO_DASHBOARD_ID:${sourceId}`;
  const events = calendar.getEvents(start, end, { search: marker });
  return events.length ? events[0] : null;
}

function clearReminders_(event) {
  try {
    event.removeAllReminders();
  } catch (error) {}
}

function parseDate_(isoDate) {
  const parts = String(isoDate).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error("La fecha no tiene formato válido.");
  }
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function htmlResponse_(title, message) {
  const html = `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml_(title)}</title>
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            color: #2f2630;
            background: #fbf5ee;
          }
          main {
            width: min(520px, calc(100% - 32px));
            padding: 28px;
            border: 1px solid #ead9cb;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 18px 50px rgba(72, 52, 35, .12);
          }
          h1 { margin: 0 0 10px; font-size: 28px; }
          p { margin: 0; color: #756a72; font-size: 17px; line-height: 1.45; }
        </style>
      </head>
      <body>
        <main>
          <h1>${escapeHtml_(title)}</h1>
          <p>${message}</p>
        </main>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

function jsonpResponse_(callback, data) {
  const safeCallback = String(callback || "").replace(/[^a-zA-Z0-9_.$]/g, "");
  const body = `${safeCallback}(${JSON.stringify(data)});`;
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
