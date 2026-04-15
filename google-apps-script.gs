/**
 * Larisa & Shine Wedding RSVP — Google Apps Script
 *
 * HOW TO DEPLOY (must do this every time you update the script):
 * 1. Open your Google Sheet → Extensions → Apps Script
 * 2. Delete ALL existing code and paste this entire file
 * 3. Click Save (Ctrl+S / Cmd+S)
 * 4. Click Deploy → Manage Deployments
 * 5. Click the pencil icon (edit) on the existing deployment
 * 6. Change "Version" dropdown to "New version"   ← CRITICAL — skipping this means old code runs
 * 7. Click Deploy
 * 8. The Web App URL stays the same — no need to update index.html
 *
 * SHEET COLUMNS (auto-created on first submission if sheet is empty):
 * Timestamp | Attending | Full Name | Mobile / WhatsApp | Email | Party Size |
 * Days Attending | Dietary Requirements | Pre / Post Wedding Plans | Message
 */

var HEADERS = [
  'Timestamp',
  'Attending',
  'Full Name',
  'Mobile / WhatsApp',
  'Email',
  'Party Size',
  'Days Attending',
  'Dietary Requirements',
  'Message'
];

// Wedding event details
var WEDDING_SITE_URL = 'https://shineabraham.github.io/weddingwebsite/';

var EVENTS = {
  day1: {
    title: 'Larisa & Shine — Engagement & Reception',
    date:  '3rd January 2027',
    start: '20270103T100000Z', // 3:30pm IST = 10:00 UTC
    end:   '20270103T180000Z', // 11:30pm IST = 18:00 UTC
    location: 'Aramana Palli & Windsor Castle, Kodimatha, Kottayam, Kerala, India',
    description: 'Engagement ceremony at Aramana Palli followed by reception at Windsor Castle, Kodimatha. Dress code: Day 1 colours.'
  },
  day2: {
    title: 'Larisa & Shine — Wedding & Reception',
    date:  '5th January 2027',
    start: '20270105T093000Z', // 3:00pm IST = 09:30 UTC
    end:   '20270105T180000Z', // 11:30pm IST = 18:00 UTC
    location: 'Aramana Palli & Backwater Ripples, Kumarakom, Kerala, India',
    description: 'Marriage ceremony at Aramana Palli followed by wedding reception at Backwater Ripples, Kumarakom. Dress code: Day 2 colours.'
  }
};

// ─────────────────────────────────────────────
//  MAIN HANDLER
// ─────────────────────────────────────────────

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // Write headers if missing — check cell A1 content, not just row count
    var firstCell = sheet.getLastRow() > 0 ? sheet.getRange(1, 1).getValue() : '';
    if (firstCell !== 'Timestamp') {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      formatHeaderRow(sheet);
    }

    var row = [
      new Date(),
      data.attending      || '',
      data.fullname       || '',
      data.mobile         || '',
      data.email          || '',
      data.guests         || '',
      data.days_attending || '',
      data.dietary        || '',
      data.message        || ''
    ];

    sheet.appendRow(row);
    sheet.autoResizeColumns(1, HEADERS.length);

    // Send confirmation email if an address was provided
    // For no-RSVPs, the contact field may have been an email — fall back to mobile
    var emailAddr = (data.email || '').trim();
    if (!emailAddr && (data.mobile || '').indexOf('@') !== -1) {
      emailAddr = data.mobile.trim();
      data.email = emailAddr;
    }
    if (emailAddr) {
      sendConfirmationEmail(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────
//  EMAIL
// ─────────────────────────────────────────────

function sendConfirmationEmail(data) {
  var isYes     = (data.attending || '').toLowerCase() === 'yes';
  var firstName = (data.fullname || 'there').split(' ')[0];

  // Plain subjects — no emoji, no ALL CAPS, no promotional wording (reduces spam score)
  var subject   = isYes
    ? 'Your RSVP is confirmed — Larisa & Shine, 5 January 2027'
    : 'Thank you for letting us know — Larisa & Shine';

  var htmlBody  = isYes ? buildYesEmail(data, firstName) : buildNoEmail(data, firstName);

  // Plain-text fallback — email clients and spam filters expect both
  var plainBody = isYes
    ? 'Dear ' + firstName + ',\n\nYour RSVP is confirmed! We are so excited to celebrate with you on 5 January 2027 in Kottayam, Kerala.\n\nVisit the wedding website for all the details: ' + WEDDING_SITE_URL + '\n\nWith love,\nLarisa & Shine'
    : 'Dear ' + firstName + ',\n\nThank you so much for letting us know. We will miss you dearly, and hope to celebrate with you another time.\n\nWith love,\nLarisa & Shine';

  var options = {
    htmlBody:  htmlBody,
    name:      'Larisa & Shine Wedding',
    replyTo:   'shineabraham1@gmail.com'
  };

  // Attach ICS calendar file(s) for attending guests
  if (isYes) {
    var icsContent = buildICS(data);
    if (icsContent) {
      options.attachments = [
        Utilities.newBlob(icsContent, 'text/calendar', 'larisa-and-shine-wedding.ics')
      ];
    }
  }

  MailApp.sendEmail(data.email.trim(), subject, plainBody, options);
}

// ─────────────────────────────────────────────
//  YES EMAIL TEMPLATE
// ─────────────────────────────────────────────

function buildYesEmail(data, firstName) {
  var days      = data.days_attending || '';
  var guests    = data.guests         || '1';
  var dietary   = data.dietary        || '—';
  var plans     = data.plans          || '—';
  var message   = data.message        || '';

  var calButtons = buildCalendarButtons(data);

  var detailRows = [
    ['Attending',          'Yes — so excited to have you!'],
    ['Party Size',         guests + (guests === '1' ? ' guest' : ' guests')],
    ['Days Attending',     days || '—'],
    ['Dietary Notes',      dietary],
    ['Pre/Post Plans',     plans]
  ];

  if (message) {
    detailRows.push(['Your Message', message]);
  }

  var detailRowsHTML = detailRows.map(function(r) {
    return '<tr>' +
      '<td style="padding:9px 16px;font-family:Georgia,serif;font-size:13px;color:#75886D;font-weight:600;border-bottom:1px solid rgba(61,74,56,0.08);width:38%;vertical-align:top;">' + r[0] + '</td>' +
      '<td style="padding:9px 16px;font-family:Georgia,serif;font-size:13px;color:#3D4A38;border-bottom:1px solid rgba(61,74,56,0.08);">' + r[1] + '</td>' +
      '</tr>';
  }).join('');

  var mobileStyles = '<style>' +
    '@media only screen and (max-width:480px){' +
    '.eh{padding:28px 20px 20px !important;}' +
    '.en{font-size:30px !important;}' +
    '.ep{font-size:11px !important;letter-spacing:0.1em !important;}' +
    '.eb{padding:24px 20px 18px !important;}' +
    '.es{padding:0 20px 20px !important;}' +
    '.ef{padding:14px 20px !important;}' +
    '.cb{display:block !important;width:100% !important;margin:5px 0 !important;text-align:center !important;}' +
    '}' +
    '</style>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + mobileStyles + '</head><body style="margin:0;padding:0;background:#f2ede4;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede4;padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table width="100%" style="max-width:560px;background:#f9f7f2;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(61,74,56,0.12);">' +

    // Header
    '<tr><td class="eh" style="background:#3D4A38;padding:36px 32px 28px;text-align:center;">' +
    '<p class="en" style="margin:0;font-family:Georgia,serif;font-size:38px;font-weight:400;color:#fff;line-height:1.15;">Larisa <span style="font-style:italic;color:rgba(255,255,255,0.45);">&amp;</span> Shine</p>' +
    '<div style="padding:12px 0 4px;text-align:center;"><div style="display:inline-flex;align-items:center;gap:10px;"><div style="height:1px;width:40px;background:rgba(255,255,255,0.2);"></div><span style="color:rgba(255,255,255,0.35);font-size:12px;">✦</span><div style="height:1px;width:40px;background:rgba(255,255,255,0.2);"></div></div></div>' +
    '<p style="margin:8px 0 10px;font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(255,255,255,0.9);">So glad you can make it!</p>' +
    '<p class="ep" style="margin:0;font-family:Georgia,serif;font-size:12px;color:rgba(255,255,255,0.85);letter-spacing:0.18em;text-transform:uppercase;">5th January 2027 &nbsp;&middot;&nbsp; Kottayam, Kerala</p>' +
    '</td></tr>' +

    // Greeting
    '<tr><td class="eb" style="padding:32px 32px 20px;text-align:center;">' +
    '<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:21px;color:#3D4A38;font-style:italic;">Dear ' + firstName + ',</p>' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#5C6E54;line-height:1.75;">We are absolutely thrilled that you\'ll be joining us to celebrate our special day. Your presence means the world to us, and we cannot wait to share these cherished moments with you.</p>' +
    '</td></tr>' +

    // RSVP summary card
    '<tr><td class="es" style="padding:0 32px 24px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f7f2;border-radius:10px;overflow:hidden;border:1px solid rgba(61,74,56,0.12);">' +
    '<tr><td style="padding:12px 16px;background:#75886D;">' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#fff;">Your RSVP Details</p>' +
    '</td></tr>' +
    detailRowsHTML +
    '</table>' +
    '</td></tr>' +

    // Add to calendar section
    (calButtons ? (
      '<tr><td class="es" style="padding:0 32px 28px;text-align:center;">' +
      '<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#75886D;">Add to your calendar</p>' +
      calButtons +
      '<p style="margin:14px 0 0;font-family:Georgia,serif;font-size:12px;color:#6B7D63;font-style:italic;">A .ics file is also attached — open it to save to any calendar app.</p>' +
      '</td></tr>'
    ) : '') +

    // Helpful note
    '<tr><td class="es" style="padding:0 32px 24px;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(117,136,109,0.1);border-radius:10px;border-left:3px solid #75886D;">' +
    '<tr><td style="padding:14px 18px;">' +
    '<p style="margin:0 0 5px;font-family:Georgia,serif;font-size:11px;font-weight:600;color:#3D4A38;text-transform:uppercase;letter-spacing:0.1em;">Good to know</p>' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#5C6E54;line-height:1.65;">Wedding shuttles will run between venues on both days. All logistical details will be shared closer to the celebrations. In the meantime, visit our <a href="' + WEDDING_SITE_URL + '" style="color:#3D4A38;font-weight:600;">wedding website</a> for travel, accommodation, and dress code info.</p>' +
    '</td></tr>' +
    '</table>' +
    '</td></tr>' +

    // Closing
    '<tr><td class="es" style="padding:0 32px 32px;text-align:center;">' +
    '<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;color:#5C6E54;">With so much love,</p>' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:26px;font-style:italic;color:#3D4A38;">Larisa &amp; Shine</p>' +
    '</td></tr>' +

    // Footer
    '<tr><td class="ef" style="background:#3D4A38;padding:18px 32px;text-align:center;">' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.08em;">This is an automated confirmation. Please do not reply.</p>' +
    '</td></tr>' +

    '</table>' +
    '</td></tr></table>' +
    '</body></html>';
}

// ─────────────────────────────────────────────
//  NO EMAIL TEMPLATE
// ─────────────────────────────────────────────

function buildNoEmail(data, firstName) {
  var mobileStyles = '<style>' +
    '@media only screen and (max-width:480px){' +
    '.eh{padding:28px 20px 20px !important;}' +
    '.en{font-size:30px !important;}' +
    '.ep{font-size:11px !important;letter-spacing:0.1em !important;}' +
    '.eb{padding:24px 20px 24px !important;}' +
    '.es{padding:0 20px 24px !important;}' +
    '.ef{padding:14px 20px !important;}' +
    '}' +
    '</style>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + mobileStyles + '</head><body style="margin:0;padding:0;background:#f2ede4;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2ede4;padding:24px 12px;">' +
    '<tr><td align="center">' +
    '<table width="100%" style="max-width:560px;background:#f9f7f2;border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(61,74,56,0.12);">' +

    '<tr><td class="eh" style="background:#3D4A38;padding:36px 32px 28px;text-align:center;">' +
    '<p class="en" style="margin:0;font-family:Georgia,serif;font-size:38px;font-weight:400;color:#fff;line-height:1.15;">Larisa <span style="font-style:italic;color:rgba(255,255,255,0.45);">&amp;</span> Shine</p>' +
    '<div style="padding:12px 0 4px;text-align:center;"><div style="display:inline-flex;align-items:center;gap:10px;"><div style="height:1px;width:40px;background:rgba(255,255,255,0.2);"></div><span style="color:rgba(255,255,255,0.35);font-size:12px;">✦</span><div style="height:1px;width:40px;background:rgba(255,255,255,0.2);"></div></div></div>' +
    '<p style="margin:8px 0 10px;font-family:Georgia,serif;font-size:16px;font-style:italic;color:rgba(255,255,255,0.9);">We\'ll miss you dearly</p>' +
    '<p class="ep" style="margin:0;font-family:Georgia,serif;font-size:12px;color:rgba(255,255,255,0.85);letter-spacing:0.18em;text-transform:uppercase;">5th January 2027 &nbsp;&middot;&nbsp; Kottayam, Kerala</p>' +
    '</td></tr>' +

    '<tr><td class="eb" style="padding:32px 32px 28px;text-align:center;">' +
    '<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:21px;color:#3D4A38;font-style:italic;">Dear ' + firstName + ',</p>' +
    '<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:15px;color:#5C6E54;line-height:1.75;">Thank you so much for letting us know. We completely understand, and we\'ll truly miss having you with us on our special day.</p>' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:15px;color:#5C6E54;line-height:1.75;">We hope we\'ll have the chance to celebrate with you another time. You\'ll always have a special place in our hearts.</p>' +
    '</td></tr>' +

    '<tr><td class="es" style="padding:0 32px 32px;text-align:center;">' +
    '<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:15px;color:#5C6E54;">With love,</p>' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:26px;font-style:italic;color:#3D4A38;">Larisa &amp; Shine</p>' +
    '</td></tr>' +

    '<tr><td class="ef" style="background:#3D4A38;padding:18px 32px;text-align:center;">' +
    '<p style="margin:0;font-family:Georgia,serif;font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:0.08em;">This is an automated confirmation. Please do not reply.</p>' +
    '</td></tr>' +

    '</table>' +
    '</td></tr></table>' +
    '</body></html>';
}

// ─────────────────────────────────────────────
//  CALENDAR BUTTONS (Google Calendar links)
// ─────────────────────────────────────────────

function buildCalendarButtons(data) {
  var days = (data.days_attending || '').toLowerCase();
  var buttons = [];

  var btnStyle = 'display:inline-block;padding:12px 20px;background:#75886D;color:#fff;text-decoration:none;border-radius:8px;font-family:Georgia,serif;font-size:13px;margin:4px;';

  if (days.indexOf('both') !== -1 || days.indexOf('day 1') !== -1 || days.indexOf('3rd') !== -1 || days.indexOf('engagement') !== -1) {
    buttons.push('<a class="cb" href="' + googleCalLink(EVENTS.day1) + '" style="' + btnStyle + '">+ Day 1 — Engagement &amp; Reception</a>');
  }
  if (days.indexOf('both') !== -1 || days.indexOf('day 2') !== -1 || days.indexOf('5th') !== -1 || days.indexOf('wedding') !== -1) {
    buttons.push('<a class="cb" href="' + googleCalLink(EVENTS.day2) + '" style="' + btnStyle + '">+ Day 2 — Wedding &amp; Reception</a>');
  }

  // Fallback: show both buttons if we couldn't parse the days
  if (buttons.length === 0) {
    buttons.push('<a class="cb" href="' + googleCalLink(EVENTS.day1) + '" style="' + btnStyle + '">+ Day 1 — Engagement &amp; Reception</a>');
    buttons.push('<a class="cb" href="' + googleCalLink(EVENTS.day2) + '" style="' + btnStyle + '">+ Day 2 — Wedding &amp; Reception</a>');
  }

  return buttons.join('<br>');
}

function googleCalLink(ev) {
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent(ev.title) +
    '&dates=' + ev.start + '/' + ev.end +
    '&details=' + encodeURIComponent(ev.description) +
    '&location=' + encodeURIComponent(ev.location);
}

// ─────────────────────────────────────────────
//  ICS CALENDAR FILE
// ─────────────────────────────────────────────

function buildICS(data) {
  var days = (data.days_attending || '').toLowerCase();
  var vevents = [];

  var includeDay1 = days.indexOf('both') !== -1 || days.indexOf('day 1') !== -1 || days.indexOf('3rd') !== -1 || days.indexOf('engagement') !== -1;
  var includeDay2 = days.indexOf('both') !== -1 || days.indexOf('day 2') !== -1 || days.indexOf('5th') !== -1 || days.indexOf('wedding') !== -1;

  // Fallback: include both if we couldn't parse
  if (!includeDay1 && !includeDay2) { includeDay1 = true; includeDay2 = true; }

  if (includeDay1) { vevents.push(buildVEvent(EVENTS.day1, data)); }
  if (includeDay2) { vevents.push(buildVEvent(EVENTS.day2, data)); }

  if (vevents.length === 0) return null;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Larisa & Shine Wedding//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Larisa & Shine Wedding',
    'X-WR-TIMEZONE:Asia/Kolkata'
  ].concat(vevents).concat(['END:VCALENDAR']).join('\r\n');
}

function buildVEvent(ev, data) {
  var uid = ev.start + '-larisa-shine-wedding@gmail.com';
  var now = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  var attendeeName = data.fullname || '';

  return [
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + now,
    'DTSTART:' + ev.start,
    'DTEND:' + ev.end,
    'SUMMARY:' + ev.title,
    'DESCRIPTION:' + ev.description.replace(/,/g, '\\,'),
    'LOCATION:' + ev.location.replace(/,/g, '\\,'),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Tomorrow — ' + ev.title,
    'END:VALARM',
    'END:VEVENT'
  ].join('\r\n');
}

// ─────────────────────────────────────────────
//  SHEET HELPERS
// ─────────────────────────────────────────────

function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  headerRange.setBackground('#3D4A38');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  sheet.setFrozenRows(1);
  sheet.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');
  sheet.getRange(1, 8, 1, 1).setBackground('#FFEB9C');
  sheet.getRange(1, 8, 1, 1).setFontColor('#9C6500');
}

/**
 * Run once manually to set up sheet headers.
 * Extensions → Apps Script → Select setupSheet → Run
 */
function setupSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clearContents();
  sheet.appendRow(HEADERS);
  formatHeaderRow(sheet);
  sheet.autoResizeColumns(1, HEADERS.length);
  SpreadsheetApp.getUi().alert('Sheet headers set up successfully!');
}

/**
 * GET handler — returns a status page to confirm the script is live.
 */
function doGet() {
  return ContentService
    .createTextOutput('Larisa & Shine RSVP endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}
