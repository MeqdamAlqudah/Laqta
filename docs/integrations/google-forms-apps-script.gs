/**
 * Google Forms -> LeadFlow channel adapter.
 * 1. Open your Google Form -> Extensions -> Apps Script, paste this file.
 * 2. Project Settings -> Script properties:
 *      LEADFLOW_URL    = https://your-domain/api/v1/webhooks/google-forms?org=smile-clinic
 *      WEBHOOK_SECRET  = (same value as WEBHOOK_SECRET in LeadFlow's .env)
 * 3. Triggers -> Add trigger -> onFormSubmit, event source "From form", type "On form submit".
 * Question titles must match the aliases in src/adapters/google-forms.ts
 * (e.g. "Full name", "Mobile number", "Email", "Service", "Message", "Consent").
 */
function onFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var responses = {};
  e.response.getItemResponses().forEach(function (r) {
    responses[r.getItem().getTitle()] = r.getResponse();
  });
  var body = JSON.stringify({ responseId: e.response.getId(), responses: responses });
  var ts = String(Math.floor(Date.now() / 1000));
  var raw = Utilities.computeHmacSha256Signature(ts + "." + body, props.getProperty("WEBHOOK_SECRET"));
  var hex = raw.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");

  var res = UrlFetchApp.fetch(props.getProperty("LEADFLOW_URL"), {
    method: "post",
    contentType: "application/json",
    payload: body,
    headers: { "x-leadflow-timestamp": ts, "x-leadflow-signature": "sha256=" + hex },
    muteHttpExceptions: true,
  });
  // 201 = created, 200 = already received (idempotent). Anything else: Apps Script logs it.
  if (res.getResponseCode() >= 300) throw new Error("LeadFlow returned " + res.getResponseCode() + ": " + res.getContentText());
}
