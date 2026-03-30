/**
 * Larisa & Shine Wedding RSVP — Google Apps Script
 *
 * HOW TO DEPLOY:
 * 1. Open your Google Sheet
 * 2. Extensions → Apps Script
 * 3. Delete all existing code and paste this entire file
 * 4. Click Save (Ctrl+S)
 * 5. Click Deploy → Manage Deployments
 * 6. Click the pencil (edit) on the existing deployment
 * 7. Set Version to "New version"
 * 8. Click Deploy
 * 9. Copy the new Web App URL and update the fetch() in index.html if it changed
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
  'Pre / Post Wedding Plans',
  'Message'
];

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
      new Date(),                  // Timestamp
      data.attending      || '',   // Attending
      data.fullname       || '',   // Full Name
      data.mobile         || '',   // Mobile / WhatsApp
      data.email          || '',   // Email
      data.guests         || '',   // Party Size
      data.days_attending || '',   // Days Attending
      data.dietary        || '',   // Dietary Requirements
      data.plans          || '',   // Pre / Post Wedding Plans
      data.message        || ''    // Message
    ];

    sheet.appendRow(row);

    // Auto-resize all columns after each entry
    sheet.autoResizeColumns(1, HEADERS.length);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function formatHeaderRow(sheet) {
  var headerRange = sheet.getRange(1, 1, 1, HEADERS.length);

  // Background and text colour
  headerRange.setBackground('#3D4A38');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);

  // Freeze the header row so it stays visible when scrolling
  sheet.setFrozenRows(1);

  // Timestamp column — format as readable date/time
  sheet.getRange('A:A').setNumberFormat('dd/mm/yyyy hh:mm');

  // Highlight the dietary column in light yellow — needs catering attention
  sheet.getRange(1, 8, 1, 1).setBackground('#FFEB9C');
  sheet.getRange(1, 8, 1, 1).setFontColor('#9C6500');
}

/**
 * Run this function once manually to set up the sheet headers
 * if you want to prepare the sheet before the first RSVP comes in.
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
 * GET handler — returns a simple status page so you can verify the script is live.
 */
function doGet() {
  return ContentService
    .createTextOutput('Larisa & Shine RSVP endpoint is live.')
    .setMimeType(ContentService.MimeType.TEXT);
}
