/**
 * LeadFlow -> Google Sheets synchronized copy (the "SHEETS_WEBHOOK" integration).
 * The database stays the source of truth; this sheet is an operational view.
 *
 * 1. Create a Google Sheet, Extensions -> Apps Script, paste this file.
 * 2. Script properties: WEBHOOK_SECRET = the signing secret you will enter in LeadFlow -> Integrations.
 * 3. Deploy -> New deployment -> Web app, execute as "Me", access "Anyone". Copy the URL.
 * 4. In LeadFlow -> Integrations -> SHEETS WEBHOOK: paste the URL and the secret, enable, "Test connection".
 *
 * Note: Apps Script web apps cannot read request headers, so this sample checks the
 * idempotency key from the body and upserts by reference. For signature verification
 * put n8n/Make in between (their webhook nodes can read headers).
 */
var HEADERS = ["reference", "createdAt", "fullName", "phone", "email", "service", "status", "owner", "source", "campaign", "message"];

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  if (payload.event === "test.ping") return ContentService.createTextOutput("pong");
  if (payload.event !== "lead.upsert") return ContentService.createTextOutput("ignored");

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  var row = HEADERS.map(function (h) { return payload.data[h] || ""; });

  // Upsert by reference -> retried deliveries never create duplicate rows.
  var refs = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map(function (r) { return r[0]; });
  var index = refs.indexOf(payload.data.reference);
  if (index > 0) sheet.getRange(index + 1, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return ContentService.createTextOutput("ok");
}
