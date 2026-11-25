# Scope

Fully supported — each has a card with examples below:
- triggers: `recordCreated`, `recordUpdated`, `recordMatchesConditions`, `cron`, `formSubmitted`, `recordEntersView`, `genericWebhookReceived`
- actions: `createRecord`, `updateRecord`, `findRecords`, `sort`, `sendEmail`, `sendToSlack`, `gmailSendEmail`, `microsoftOutlookSendEmail`, `aiGenerate`, `aiGenerateStructuredOutput`
- decision groups: `repeatingGroup` (for-each loop), `conditionalGroup` (if/else-if/else) — see their cards for structure
- topology: one trigger plus ordered nodes; each node carries an agent-supplied `key` that later nodes use to read its outputs; groups nest more nodes inside

Many other trigger and action types are also creatable. They have no cards, but the "Available
but not yet fully supported nodes" catalog at the end of these instructions lists each one with
only the inputs you can actually fill (select options are inlined; non-fillable fields are
omitted and fall back to their defaults). Prefer a fully-supported type when it fits; otherwise
pick a creatable type from the catalog. Some types exist but are not creatable here — they are
named in that catalog and must be configured in the Airtable UI.

Validation runs before anything is saved, so when the response has `isValid` false nothing
was created. Use the per-node `errors` (see the Error index below) to correct your input and
call create_automation again; after a couple of failed attempts, surface the
errors to the user instead of retrying indefinitely.

This tool only saves the draft configuration; the automation stays off. Turning it on is a
manual step the user performs in the Airtable UI, which forces a human review before it runs.
After create_automation succeeds, tell the user to open the automation in the Airtable UI to review and turn it on, and share the `automationUrl` from the response so they can go straight to it.

# Mental model

Every trigger input and node input is an expression.

Canonical expression forms:
- literal: `"text"`, `123`, `true`, `null`
- ref: `{"$ref":"trigger","path":["id"]}` or `{"$ref":"node1","path":["records"]}` (substitute the actual node key in place of `node1`); use an empty path `{"$ref":"node1","path":[]}` for the whole referenced output. Always include `path` — use `[]` rather than omitting it.
- template: `{"template":["hello ", {"$ref":"trigger","path":["id"]}]}`
- function call: `{"fn":"uppercase","args":[...]}`
- plain object: `{"fldStatus":{"template":["Done"]}}`
- plain array: `["fldA","fldB"]`
- spread: `[{"spread": <arrayExpr>}]` — flattens an upstream array into the enclosing array

Accepted expression forms that also match the automation UI:
- `{"obj": {...}}` for explicit object literals
- `{"tuple": [...]}` for fixed-length operands and other typed wrapper cases

Destination-first procedure:
1. Identify the destination input.
2. Match the destination shape first.
3. If you read upstream data, inspect the source shape.
4. Use direct copy only when the shapes already match.
5. Otherwise extract a property, map over an array, or switch to `recordTemplate`.

Top-level node inputs are governed by the provider's `valueSchema.type`.
- `AIRTABLE_*_ID` slots take literal string IDs
- `TEXT` slots take text expressions: bare string literals are accepted for static values
  (they are stored — and returned by get_automation — as `{"template":[...]}`),
  and dynamic refs must be wrapped in `template`
- `SELECT` enum slots take literal enum strings
- `AIRTABLE_FIELDS` takes `"all"` or a field ID array
- `AIRTABLE_RECORD_FIELDS` takes a structured object keyed by field ID. Each field value is
  either a static literal (see the field-destination cards) or a dynamic `{"template":[...]}`
  — bare `$ref` / function expressions are rejected inside `fields`, for every field type
  including number, checkbox, date, select, collaborator, and linked record
- `AIRTABLE_FILTERS` takes a structured object whose conjunction and leaf operands use `{"tuple":[...]}`

# Cards

## Card: key (cross-references)
Where it applies: every action node carries a required `key` you assign yourself; later nodes use it to read the node's output via `{"$ref":"<key>","path":[...]}`.
Canonical accepted shape:
- `key` is a non-empty string, unique within the automation
- `key` must not collide with the reserved token(s): `"trigger"`
- downstream refs use the same string verbatim — `{"$ref":"<key>","path":[]}` for the whole output, `{"$ref":"<key>","path":["records"]}` for a property
- reference order: a node may only `$ref` a node defined earlier in the same `nodes` array (or `"trigger"`); forward references are rejected
For new nodes, choose any unique request-local keys; positional names such as `node1`, `node2`, and `node3` are convenient but not required. Read APIs return persisted node IDs as keys. Preserve a returned key when updating that existing node to retain its identity; changing the key creates a new node identity. In every request, all downstream `$ref` values must use the submitted keys consistently.
Rejected shape:
- empty string keys
- the reserved token(s): `"trigger"`
- duplicate keys within a single automation
- referencing a key that does not exist or is defined later than the referencing node
Minimal example:
```json
{
  "nodes":[
    {"key":"node1","type":"findRecords","inputs":{"tableId":"tbl...","queryType":"viewId","viewId":"viw..."}},
    {"key":"node2","type":"createRecord","inputs":{"tableId":"tblLog","createRecordMethod":"customFields","fields":{"fldCount":{"template":[{"fn":"length","args":[{"$ref":"node1","path":["records"]}]}]}}}}
  ]
}
```

## Card: description (action nodes)
Where it applies: any action node (`createRecord`, `updateRecord`, `findRecords`, `sendEmail`, `customScript`).
Canonical accepted shape:
- `description` is an optional top-level field (a sibling of `key`/`type`/`inputs`, NOT inside `inputs`)
- send a plain string, not a `{"template":[...]}` expression
- it is a human-readable UI label shown on the node in the Airtable automation editor; it does not affect execution
Set it to a short phrase describing what the step does, so the user can scan the automation. Omit it when the action is self-explanatory.
Minimal example:
```json
{"key":"node1","type":"updateRecord","description":"Mark the task as in progress","inputs":{"tableId":"tbl...","rowId":{"template":[{"$ref":"trigger","path":["id"]}]},"updateRecordMethod":"customFields","fields":{"fldStatus":{"template":["In Progress"]}}}}
```

## Card: node = repeatingGroup
Where it applies: you need to run a set of nodes once per element of an array (a for-each loop).
Canonical accepted shape:
```json
{
  "key":"loop1",
  "type":"repeatingGroup",
  "name":"For each record",
  "inputs":{"items":{"$ref":"node1","path":["records"]}},
  "nodes":[
    {"key":"node2","type":"updateRecord","inputs":{"tableId":"tbl...","updateRecordMethod":"customFields","fields":{"fldStatus":{"template":["Processed"]}}}}
  ]
}
```
Fields:
- `inputs.items` — required, non-null; an expression resolving to the array to iterate. The expression must derive from a single upstream `$ref`; merging multiple sources (e.g. via `flatten`) is rejected.
- `name`, `description` — optional UI labels; top-level fields (siblings of `key`, not inside `inputs`); send plain strings, not `{"template":[...]}` expressions
- `nodes` — the loop body; runs once per element. May be empty (the loop becomes a no-op pass)
Rules:
- a `repeatingGroup` must be the LAST node in its `nodes` array — nothing can run after it, unless the instructions include "Card: steps after a repeatingGroup"
- a `repeatingGroup` may NOT be nested (directly or transitively) inside another `repeatingGroup`
- a `conditionalGroup` may be nested inside a `repeatingGroup`
Per-iteration data: to read the current element from inside the loop body, see Card: upstream output = repeatingGroup current item.

## Card: upstream output = repeatingGroup current item
Where it applies: an inner node (inside a `repeatingGroup`'s `nodes`) needs the CURRENT element of the iterated `items` array.
How it works: the loop's `key` resolves to the loop's fan-out, whose output exposes one runtime property, `sel7f656839ee1e19`. Wrap `{"$ref":"<loopKey>","path":["sel7f656839ee1e19"]}` in `pickBranchData` to get the current iteration's element, then drill into it with `readProperty` calls.
The element shape matches one element of `items`. When `items` is a records array (e.g. `{"$ref":"node1","path":["records"]}`), each element is a record `{id, url, cellValuesByFieldId}`. When `items` is a non-record column-value array (e.g. a multi-select cell value `{"$ref":"trigger","path":["cellValuesByFieldId","fldTags"]}`), each element is that field family's per-element shape (multi-select: `{id, name, color}`) — see the upstream output cards.
Canonical accepted shape (`<loopKey>` is the `repeatingGroup`'s own key):
- current element's record id (record array `items`):
```json
{"fn":"readProperty","args":[{"fn":"pickBranchData","args":[{"$ref":"<loopKey>","path":["sel7f656839ee1e19"]}]},"id"]}
```
- a cell value off the current element (record array `items`, field `<fieldId>`):
```json
{"fn":"readProperty","args":[{"fn":"readProperty","args":[{"fn":"pickBranchData","args":[{"$ref":"<loopKey>","path":["sel7f656839ee1e19"]}]},"cellValuesByFieldId"]},"<fieldId>"]}
```
- a property off the current element (non-record array `items`, e.g. each element is a multi-select choice `{id, name, color}` — read `name`):
```json
{"fn":"readProperty","args":[{"fn":"pickBranchData","args":[{"$ref":"<loopKey>","path":["sel7f656839ee1e19"]}]},"name"]}
```
Cell values follow the same per-type shapes as trigger/node output — see the upstream output cards for select, collaborator, linked record, lookup, and attachment shapes (e.g. append `,"name"` via another `readProperty` for a single-select's display name).
Rules:
- drill into the picked element with `readProperty` function calls, NOT a `{"$ref":"<loopKey>","path":[...]}` lookup — the `$ref` shorthand walks node outputs, and `<loopKey>.sel7f656839ee1e19` is the whole branch array, not the current element
- reading a field that lands in a `TEXT` slot (e.g. `rowId`) still needs a `{"template":[...]}` wrapper around the `readProperty` expression, like any dynamic text
- `pickBranchData(<loopKey>.sel7f656839ee1e19)` is only meaningful inside that same `repeatingGroup`'s `nodes`; referencing it outside the loop body, or referencing a different loop's key, is rejected at deploy time
Full automation: see Example K below.

## Card: node = conditionalGroup
Where it applies: you need to route to exactly one of several branches (if / else-if / else).
Canonical accepted shape:
```json
{
  "key":"branch1",
  "type":"conditionalGroup",
  "branches":[
    {"condition":{"conjunction":"and","conditions":[{"left":{"$ref":"trigger","path":["cellValuesByFieldId","fldStatus"]},"operator":"=","right":"sel...","valueType":"select"}]},"name":"If done","nodes":[{"key":"node3","type":"createRecord","inputs":{"tableId":"tbl...","createRecordMethod":"customFields","fields":{}}}]},
    {"condition":null,"name":"Else","nodes":[{"key":"node4","type":"createRecord","inputs":{"tableId":"tbl...","createRecordMethod":"customFields","fields":{}}}]}
  ]
}
```
Fields:
- `branches` — ordered, at least one; each routes to its own `nodes` chain. They are evaluated top-to-bottom; the first branch whose condition matches wins.
- `branches[].condition` — a structured condition tree `{conjunction?, conditions:[…]}`, or `null` for the else (catch-all) branch. See Card: condition expressions on conditionalGroup branches.
- `branches[].name`, `branches[].description` — optional UI labels; send plain strings, not `{"template":[...]}` expressions
- `branches[].nodes` — the branch body
Rules:
- a `conditionalGroup` must be the LAST node in its `nodes` array — nothing can run after it
- only the LAST branch may have `condition: null` (the else branch)
- an empty branch (`nodes: []`) is only allowed when the `conditionalGroup` is nested inside a `repeatingGroup`

## Card: condition expressions on conditionalGroup branches
Where it applies: a non-null `branches[].condition` on a `conditionalGroup`.
Shape:
```json
{"conjunction":"and","conditions":[{"left":<expr>,"operator":"=","right":<expr>,"valueType":"select","dataType":"literal"}]}
```
- `conjunction` — `"and"` (default) or `"or"`; how the comparisons combine. Optional.
- `conditions` — one or more comparison leaves; at least one required.
Each comparison leaf:
- `left` — an expression for the left-hand side. Usually a `$ref` into trigger/upstream node data, e.g. `{"$ref":"trigger","path":["cellValuesByFieldId","fldStatus"]}`. The only `fn` wrappers safe here are `first`, `map`/`propertyGetter`, and `last` — the field reference must be a direct argument, not wrapped in an array literal. Do NOT use `length`, `flatten`, or other functions on condition operands; use a template slot for computed values.
- `operator` — an operator NAME, the same operators Airtable filters use (see Card: filter leaf rules): e.g. `=`, `!=`, `contains`, `doesNotContain`, `isEmpty`, `isNotEmpty`, `hasAnyOf`, `hasAllOf`, `isAnyOf`, `isNoneOf`, `<`, `>`, `<=`, `>=`. Pick the operator for the left field's family exactly as in Card: filter leaf rules. Use the name, not an internal symbol like `|`.
- `right` — the comparison value as an expression: usually a literal (e.g. `"sel..."`, `false`, `["recA","recB"]`, or a structured date object), but may also be a `$ref` into trigger/upstream data. For `select` and `multiSelect`, static values MUST use `sel...` choice IDs from the field schema; call `get_table_schema` to retrieve them. Choice names are not accepted here. OMIT for value-less operators (`isEmpty`/`isNotEmpty`).
- `valueType` — REQUIRED. The comparison value type, which follows from the left field's column type. One of: `text`, `number`, `checkbox`, `select`, `multiSelect`, `collaborator`, `multiCollaborator`, `phone`, `date`, `richText`.
- `dataType` — optional, defaults to `"literal"`. Use `"array"` ONLY with the array operators (`contains`/`doesNotContain`/`isEmpty`/`isNotEmpty`) and `valueType` one of `text`/`number`/`date`.
Notes:
- date RHS: use the same structured literal date object as filter leaves (e.g. `{"mode":"exactDate","exactDate":"2026-04-23"}`), not a dynamic expression.
- choice-name resolution applies only to `filtersObj`; conditional-group comparisons require choice IDs.
- `mcp` validates the structure, select choice-ID shape, and that the operator name resolves; remaining type-consistency between `operator`/`valueType`/`left`/`right` is checked at create time by the workflow validator, so a mismatch surfaces as a validation error on the automation.
Example — if/else routing on a single-select Status field (the first matching branch wins; the `null` branch is the fallback):
```json
{
  "key":"route","type":"conditionalGroup",
  "branches":[
    {"condition":{"conditions":[{"left":{"$ref":"trigger","path":["cellValuesByFieldId","fldStatus"]},"operator":"=","right":"sel...","valueType":"select"}]},"name":"Done","nodes":[{"key":"notifyDone","type":"sendEmail","inputs":{}}]},
    {"condition":null,"name":"Otherwise","nodes":[{"key":"notifyOther","type":"sendEmail","inputs":{}}]}
  ]
}
```

## Card: write mode = customFields
Where it applies: `createRecordMethod` or `updateRecordMethod` is `"customFields"`.
Canonical accepted shape: include the method key and `fields`; omit `recordTemplateId`.
Accepted but non-canonical: `fields` may be wrapped as `{"obj": {...}}`.
Rejected shape: sending both `fields` and `recordTemplateId`, or neither.
Minimal example:
```json
{"updateRecordMethod":"customFields","fields":{"fldStatus":{"template":["In Progress"]}}}
```

## Card: write mode = recordTemplate
Where it applies: `createRecordMethod` or `updateRecordMethod` is `"recordTemplate"`.
Canonical accepted shape: include `recordTemplateId`; omit `fields`.
Rejected shape: leaving `recordTemplateId` out, or mixing it with `fields`.
Minimal example:
```json
{"createRecordMethod":"recordTemplate","recordTemplateId":"rtp..."}
```

## Card: trigger = recordCreated
Where it applies: create on new rows.
Canonical accepted shape:
```json
{"type":"recordCreated","inputs":{"tableId":"tbl..."}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
Output tokens: `{id: text, cellValuesByFieldId: object, url: text, actingUser: object}`.
Common mistakes: inventing extra trigger keys; using table names instead of table IDs.

## Card: trigger = recordUpdated
Where it applies: updates to existing rows.
Canonical accepted shape:
```json
{"type":"recordUpdated","inputs":{"tableId":"tbl...","watchFields":["fldA","fldB"]}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `viewId` => `AIRTABLE_VIEW_ID`; when present, send a literal view ID string only
- `watchFields` => `AIRTABLE_FIELDS`; send `"all"` or a field ID array such as `["fldA","fldB"]`
Rejected shape: `"*"`, `null`, field names instead of field IDs, or formula-like objects for `watchFields`.
Output tokens: same record-like envelope as `recordCreated`.

## Card: trigger = recordMatchesConditions
Where it applies: rows entering a matching set.
Canonical accepted shape:
```json
{
  "type":"recordMatchesConditions",
  "inputs":{
    "tableId":"tbl...",
    "filtersObj":{
      "operator":"and",
      "operands":{"tuple":[{"operator":"=","operands":{"tuple":["fldStatus","Done"]}}]}
    }
  }
}
```
Accepted but non-canonical: inner objects may also be written with explicit `{"obj": ...}`.
Rejected shape: formula strings such as `"{Status}='Done'" `.
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `filtersObj` => `AIRTABLE_FILTERS`; send a structured object tree, not a formula string. See the `input slot = filtersObj` card for the exact tuple shape.
Output tokens: same record-like envelope as the other triggers.

## Card: trigger = cron
Where it applies: run the automation on a recurring schedule, or once at a specific time.
Canonical accepted shape: `inputs` carries three keys — `type` (the schedule kind), `config` (a plain object whose shape is fixed per `type`), and `start` (an ISO 8601 timestamp the recurrence is anchored to).
```json
{"type":"cron","inputs":{"type":"weeklyV2","config":{"weekdays":[1,3],"triggerTimes":[{"hour":9,"minute":0,"second":0}],"width":1},"start":"2027-01-04T17:00:00.000Z"}}
```
Input slots:
- `type` => a literal, one of `minutely`, `hourly`, `daily`, `weeklyV2`, `monthly`, `oneTime`
- `config` => a plain object; send exactly the keys listed below for the chosen `type` and no others
- `start` => ISO 8601 timestamp string; REQUIRED for every recurring `type` (`minutely`, `hourly`, `daily`, `weeklyV2`, `monthly`) and optional for `oneTime`. It anchors the recurrence — use the current time unless the user names a start.
Config by `type` (time-of-day `hour` is 0-23, `minute`/`second` are 0-59; all numbers):
- `minutely`: `{"width":<1-1440>}` — every `width` minutes.
- `hourly`: `{"width":<1-24>}` — every `width` hours.
- `daily`: `{"localTriggerTimes":[{"hour":<0-23>,"minute":<0-59>,"second":<0-59>}],"tz":"<IANA tz>","dateModified":"<ISO now>","width":<1-31>}` — every `width` days at the given local times. `tz` is an IANA zone (e.g. `"America/New_York"`); `dateModified` is the current time.
- `weeklyV2`: `{"weekdays":[<0-6>],"triggerTimes":[{"hour":<0-23>,"minute":<0-59>,"second":<0-59>}],"width":<1-12>}` — every `width` weeks on the given weekdays. Weekdays are numbers: `0`=Sunday, `1`=Monday, … `6`=Saturday.
- `monthly`: `{"type":"dayOfMonth","dayOfMonthList":[{"dayOfMonth":<1-31>,"fromEndOfMonth"?:bool}],"localTriggerTime":{"hour":<0-23>,"minute":<0-59>,"second":<0-59>},"tz":"<IANA tz>","dateModified":"<ISO now>","width":<1-12>}` — every `width` months on the given days.
- `oneTime`: `{"triggerDateTime":"<ISO>"}` — fire exactly once at that instant; `start` may be omitted.
Defaults when the user is vague: time of day => 9:00 (`{"hour":9,"minute":0,"second":0}`) — local for `daily`/`monthly` (they carry `tz`), UTC for `weeklyV2` (it has no `tz`); `tz` => `"UTC"` for `daily`/`monthly` (where it is required) unless the user names a zone; weekday => Monday (`1`) for `weeklyV2`; day of month => the 1st for `monthly`.
Output tokens: `{act7b67163aa3e962: date, currentTriggerTime: date, nextTriggerTime: date}`. `act7b67163aa3e962` is when the schedule actually fired; `currentTriggerTime` the expected fire time; `nextTriggerTime` the following scheduled fire. Reference via e.g. `{"$ref":"trigger","path":["act7b67163aa3e962"]}`.
Common mistakes: omitting `start` on a recurring schedule; putting `config` keys that belong to a different `type`; using weekday names instead of `0-6` numbers.

## Card: trigger = formSubmitted
Where it applies: run the automation when a form view or an interface page form is submitted.
Canonical accepted shape:
```json
{"type":"formSubmitted","inputs":{"tableId":"tbl...","formId":"viw..."}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; the table the form writes to. Send a literal table ID string only.
- `formId` => `AIRTABLE_FORM_ID`; the form's ID — a `viw...` form view, or a `pag...` interface page form. Send a literal ID string only; it must be a FORM view, not a grid/calendar/other view.
Output tokens: `{id: text, cellValuesByFieldId: object, url: text}` — the row the submission created.
Common mistakes: passing a non-form view ID; using the table or form name instead of its ID.

## Card: trigger = genericWebhookReceived
Where it applies: run an automation when an external system POSTs an object payload to an
automation-specific URL. This automation trigger is distinct from the Airtable Webhooks API.
Canonical accepted shape:
```json
{"type":"genericWebhookReceived"}
```
Input slots: none.
Setup and schema capture:
1. Create the undeployed automation, then call `get_automation` to obtain its
   `webhookUrl`. Treat this URL as a capability: anyone who has it can fire the trigger.
2. POST a representative object payload, or have the user or external system do so. Every
   accepted POST replaces the latest sample used by trigger tests. While the automation is
   undeployed, the POST does not run its nodes and normally starts a trigger test automatically.
   Automatic tests are rate-limited, so a later POST can replace the sample without immediately
   replacing the captured schema.
3. Poll `get_automation` every 2–3 seconds for up to 30 seconds, stopping when
   `webhookSchemaIsSet` is true. If it remains false, confirm the POST returned
   `{"success":true}`; if the user or external system sent it, ask the user to resend a
   representative object payload. If is still not set, call `test_automation_webhook_trigger`;
   the tool explicitly starts a test against the latest stored sample and waits briefly for its result.
   It does not send a sample, reset or lock the schema, or change the automation's deployment state.
4. Read `webhookSchema` and reference captured fields with paths such as
   `{"$ref":"trigger","path":["body","customer","email"]}`.
Existing deployed automation: every accepted POST replaces the stored test sample and also runs
the live automation, which may cause side effects; it does not start an automatic trigger test.
Warn the user first, then call `test_automation_webhook_trigger` to capture the
latest sample's schema. Agents cannot deploy or undeploy automations.
Output tokens: inferred from the captured payload under `{body: object}`.
Payload constraints: the top level must be an object; only the request body is captured.
Common mistakes:
- confusing this trigger with the Airtable Webhooks API
- inventing a URL
- referencing fields before `webhookSchemaIsSet` is true
- posting a deployed sample without warning about live side effects.
- assuming every POST immediately replaces `webhookSchema` rather than the stored sample used by the next trigger test.

## Card: trigger = recordEntersView
Where it applies: a record entering a specific view (e.g. matching that view's filters/sort).
Canonical accepted shape:
```json
{"type":"recordEntersView","inputs":{"tableId":"tbl...","viewId":"viw..."}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `viewId` => `AIRTABLE_VIEW_ID`; send a literal view ID string only. The view must belong to `tableId`.
Discover `viewId` with list_views_for_table. The view must be one of these types: `grid`, `calendar`, `gallery`, `kanban`, `block`. Any other view type (e.g. `form`, `timeline`, or `list`) is rejected — the automations UI only offers these types.
Output tokens: same record-like envelope as the other triggers.
Common mistakes: using a view name instead of a view ID; choosing a form view; passing a view that belongs to a different table than `tableId`.

## Card: action = createRecord
Where it applies: create a row in `tableId`.
Canonical accepted shape:
```json
{"type":"createRecord","inputs":{"tableId":"tbl...","createRecordMethod":"customFields","fields":{"fldName":{"template":["Copied"]}}}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `createRecordMethod` => `SELECT`; send the literal enum string `"customFields"` or `"recordTemplate"`
- `fields` => `AIRTABLE_RECORD_FIELDS`; send a structured object map when `createRecordMethod` is `"customFields"`
- `recordTemplateId` => `AIRTABLE_RECORD_TEMPLATE_ID`; send a literal template ID string when `createRecordMethod` is `"recordTemplate"`
Output tokens: `{id: text, cellValuesByFieldId: object, url: text}`.
Common mistakes: omitting `tableId`; mixing `fields` and `recordTemplateId`; wrapping `createRecordMethod` in a template. Send the literal string directly: `"customFields"`, not `{"template":["customFields"]}`.

## Card: action = updateRecord
Where it applies: update a row in `tableId`.
Canonical accepted shape:
```json
{"type":"updateRecord","inputs":{"tableId":"tbl...","rowId":{"template":[{"$ref":"trigger","path":["id"]}]},"updateRecordMethod":"customFields","fields":{"fldStatus":{"template":["Done"]}}}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `rowId` => `TEXT`; send a row ID string literal, or wrap dynamic refs in `{"template":[...]}`
- `updateRecordMethod` => `SELECT`; send the literal enum string `"customFields"` or `"recordTemplate"`
- `fields` => `AIRTABLE_RECORD_FIELDS`; send a structured object map when `updateRecordMethod` is `"customFields"`
- `recordTemplateId` => `AIRTABLE_RECORD_TEMPLATE_ID`; send a literal template ID string when `updateRecordMethod` is `"recordTemplate"`
Rejected shape: `recordId` instead of `rowId`, or raw `{"$ref":"trigger","path":["id"]}` in `rowId`.
Why: `rowId` is a `TEXT` input slot, and dynamic text inputs use `template`.
Common mistakes: omitting `tableId`; mixing `fields` and `recordTemplateId`; wrapping `updateRecordMethod` in a template. Send the literal string directly: `"customFields"`, not `{"template":["customFields"]}`.
Output tokens: same as `createRecord`.

## Card: action = findRecords
Where it applies: search for records in `tableId` matching filter conditions or belonging to a view.
Canonical accepted shape:
```json
{"type":"findRecords","inputs":{"tableId":"tbl...","queryType":"filtersObj","filtersObj":{"operator":"and","operands":{"tuple":[{"operator":"=","operands":{"tuple":["fldStatus","selActive"]}}]}}}}
```

Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; the table to search in. Send a literal table ID string only.
- `queryType` => `SELECT`; send `"filtersObj"` to search by conditions, or `"viewId"` to search by view.
- `filtersObj` => `AIRTABLE_FILTERS`; required when `queryType` is `"filtersObj"`. Same filter structure as `recordMatchesConditions` trigger (see Card: input slot = filtersObj).
- `viewId` => `AIRTABLE_VIEW_ID`; required when `queryType` is `"viewId"`. Send a literal view ID string (e.g. `"viwAbc123"`).
- `limit` => `NUMBER`; optional, 1–1000, defaults to 1000. Use `limit: 1` when you only need a single record. If the user needs more records, create the automation with the default and tell them they can raise the limit in the Airtable UI. When updating an automation, keep an existing `limit` from get_automation as-is.

Output tokens: `{records: array<{id: text, url: text, cellValuesByFieldId: object}>}`. Always an array, even if zero or one record matches.

Referencing output in downstream nodes: use `{"$ref":"<key>","path":["records"]}` for the full array, where `<key>` is the `key` you assigned to this findRecords node (e.g. `node1`). To extract a field from each record use `{"fn":"map","args":[{"$ref":"<key>","path":["records"]},{"fn":"propertyGetter","args":["id"]}]}`. Even with `limit: 1`, output is still an array — use `map` + `propertyGetter` to extract values.
Do NOT use numeric indices like `["records","0","id"]` in paths — the expression type checker rejects array indexing.

Common mistakes:
- Providing both `filtersObj` and `viewId` (only provide the one matching your `queryType`).
- Omitting `queryType`.
- Treating output as a single record instead of an array.
- Using `{"$ref":"<key>","path":["id"]}` directly (must go through `records` first).
- Using findRecords when you already have the data from the trigger or a previous node's output.
- Using findRecords to get linked record IDs; instead reference `{"$ref":"trigger","path":["cellValuesByFieldId","fldLinkedRecords"]}` directly.

## Card: action = sort
Where it applies: reorder an array of records (almost always a `findRecords` result) before a downstream node reads them.
Canonical accepted shape:
```json
{"type":"sort","inputs":{"inputList":{"$ref":"node1","path":["records"]},"sortFields":[{"idSequence":["fldPriority"],"sortOrder":"desc"}]}}
```
Input slots:
- `inputList` => `ARRAY`; required; the records to sort. `sort` does not fetch records itself, so add a `findRecords` node first and reference its output: `{"$ref":"<findKey>","path":["records"]}`.
- `sortFields` => `CUSTOM`; required; an ordered array of sort keys, each `{"idSequence":["<fieldId>"],"sortOrder":"asc"|"desc"}`. Earlier entries take priority (first entry is the primary sort key, subsequent entries break ties). `idSequence` is a path into a record's `cellValuesByFieldId`: use a single field ID `["fld..."]` for a normal field, and only append a nested key (e.g. `["fldStatus","name"]` to sort a single-select by its option name) to drill into a structured cell value.
Output tokens: `{output: array<{id: text, url: text, cellValuesByFieldId: object}>}` — the same records, reordered. Reference the sorted array via `{"$ref":"<key>","path":["output"]}`.
Common mistakes:
- Sorting the trigger record (a single record, not an array) instead of a `findRecords` result;
- Using a field NAME instead of a field ID in `idSequence`;
- Wrapping `sortOrder` in a `template` (send the bare string `"asc"` or `"desc"`).

## Card: action = sendEmail
Where it applies: send an email from the automation.
Canonical accepted shape:
```json
{"type":"sendEmail","inputs":{"to":[{"template":["contact@example.invalid"]}],"subject":{"template":["Hello"]},"message":{"template":["Email body"]}}}
```
Input slots:
- `to` => `ARRAY` of `TEXT`; required; each item is a `{"template":[...]}` expression, just like `subject`; for sends with multiple recipients, each recipient receives a separate copy addressed to them, with the complete `to` list visible in CC
- `subject` => `TEXT`; required; template expression
- `message` => `TEXT`; required; template expression; supports Markdown (`**bold**`, `_italic_`, `# heading`, `* bullet`, `\
` for line breaks)
- `cc`, `bcc`, `replyTo` => `ARRAY` of `TEXT`; optional; same format as `to`
- `fromName` => `TEXT`; optional; sender display name
- `attachments` => `ARRAY` of `FILE`; optional; use `[{"spread":{"$ref":"trigger","path":["cellValuesByFieldId","fldFiles"]}}]` to pass an upstream attachment field
- `inReplyTo` => `TEXT`; optional; Message-ID for threading
Output tokens: none. Downstream nodes cannot reference sendEmail results.
Dynamic recipients from a multi-collaborator field: map the collaborators to their emails and place the result as a single `{"template":[...]}` element of the `to` array; the joined addresses are parsed into the recipient list:
```json
{"to":[{"template":[{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldTeam"]},{"fn":"propertyGetter","args":["email"]}]}]}]}
```
Rejected shape: a single string instead of an array for `to`; `subject`/`message` as a bare `{"fn":...}` or `{"$ref":...}` expression without the `{"template":[...]}` wrapper; raw object literals or plain values in `attachments` like `[{"url":"...","filename":"..."}]` — use `$ref`/`spread` to pass upstream attachment fields.

## Card: action = gmailSendEmail
Where it applies: send an email via a connected Gmail account.
Prerequisite: call `list_external_accounts` to get the `externalAccountId` for a Gmail account. Include it on the node.
Canonical accepted shape:
```json
{"type":"gmailSendEmail","externalAccountId":"eac...","inputs":{"to":[{"template":["contact@example.invalid"]}],"subject":{"template":["Hello"]},"message":{"template":["Email body"]}}}
```
Same input slots as `sendEmail`, plus:
- `fromAddress` => `TEXT`; optional; "Send mail as" alias address
Output tokens: none.

## Card: action = sendToSlack
Where it applies: send a Slack message to a channel or user.
Prerequisite: call `list_external_accounts` to get the `externalAccountId` for a Slack account, then call `fetch_automation_input_data` to get the `slackConversationId`. Include both on the node.
Canonical accepted shape:
```json
{"type":"sendToSlack","externalAccountId":"eac...","inputs":{"slackConversationId":"C12345ABC","notificationText":{"template":["..."]}}}
```
Input slots:
- `slackConversationId` => `TEXT`; the channel/user to send to. Use the `id` value returned by `fetch_automation_input_data`. Comma-separate up to 10 recipients.
- `notificationText` => `TEXT`; the message body in Slack mrkdwn format (not standard Markdown). Key syntax differences: `*bold*` (not `**bold**`), `_italic_`, `~strikethrough~`, `<url|link text>` (not `[text](url)`), `@username` for mentions.
- `username` => `TEXT`; optional bot display name. Default: "Airtable".
Output tokens: `{sentMessagePermalink: text}` — permalink to the sent message when sending to a single channel.
Common mistakes: using standard Markdown instead of Slack mrkdwn; omitting `externalAccountId`.

## Card: action = microsoftOutlookSendEmail
Where it applies: send an email via Microsoft Outlook.
Prerequisite: call `list_external_accounts` to get the `externalAccountId` for a Microsoft Outlook account. Include it on the node.
When to use: use this action only if the user explicitly requests "outlook" or "microsoft outlook." For general email sending, use `sendEmail` instead.
Same input slots as `sendEmail` (`to`, `subject`, `message`, `cc`, `bcc`, `replyTo`, `attachments`), except: no `fromName` or `inReplyTo`; adds `fromAddress` (optional TEXT).
Output tokens: none.

## Card: action = aiGenerate
Where it applies: generate text using an AI model.
Canonical accepted shape:
```json
{"type":"aiGenerate","inputs":{"prompt":{"template":["Summarize the following: ",{"$ref":"trigger","path":["cellValuesByFieldId","fldDescription"]}]},"model":"default"}}
```
Input slots:
- `prompt` => `TEXT`; required; the AI prompt. Include all relevant data via `$ref` expressions — the AI model has no access to your base data unless you pass it in the prompt.
- `model` => send `"default"` (the only documented value — automatically selects the best available model). To use a specific model, leave as `"default"` and change it in the Airtable UI after creation.
- `randomness` => `NUMBER`; optional; float 0.0–1.0 controlling output variability. 0 = deterministic (default), 1.0 = highly creative.
- `availableTools` => `ARRAY`; optional; to enable internet access, send `["brightDataSearch", "brightDataReadWebpage"]` (both required). Default is `[]` (no internet access).
Output tokens: `{response: text}` — the generated text. Reference via `{"$ref":"<key>","path":["response"]}`.
Common mistakes:
- Wrapping `model` in `{"template":["default"]}` — send a bare string literal like `"default"`, not a template expression.

## Card: action = aiGenerateStructuredOutput
Where it applies: generate structured data using an AI model — returns typed fields (strings, numbers, booleans, arrays, objects) instead of free-form text. Use when you need the AI response broken into individual properties (e.g. to write separate fields on a record).
Canonical accepted shape:
```json
{"type":"aiGenerateStructuredOutput","inputs":{"prompt":{"template":["Extract the following from this description:

",{"$ref":"trigger","path":["cellValuesByFieldId","fldDescription"]}]},"outputSchema":{"response":{"type":"object","properties":{"summary":{"type":"string"},"priority":{"type":"string","enum":["low","medium","high"]},"estimatedHours":{"type":"number"}}}},"model":"default"}}
```
Input slots — same as `aiGenerate` (`prompt`, `model`, `randomness`, `availableTools`), plus:
- `outputSchema` => required; a JSON object defining the shape of the structured response. Must be wrapped as `{"response": <schemaNode>}`. The `response` key is required — do not pass `<schemaNode>` directly. The root `<schemaNode>` must use `{"type":"object",...}` — other types (string, number, boolean, array) are only valid inside the root object's properties.
  Schema node types:
  - `{"type":"string"}` — a text value. Optionally constrain with `"enum":["a","b","c"]`.
  - `{"type":"number"}` — a numeric value.
  - `{"type":"boolean"}` — true or false.
  - `{"type":"array","items":<schemaNode>}` — a list; `items` defines the element shape.
  - `{"type":"object","properties":{"key1":<schemaNode>,"key2":<schemaNode>}}` — a nested object. By default all properties are required; to make some optional, add `"required":["key1"]` listing only the required ones.
Output tokens: `{response: <matches your outputSchema>}` — each property from your schema is a separate output. Reference individual properties via `{"$ref":"<key>","path":["response","<propertyName>"]}`.
Common mistakes:
- Referencing the whole response instead of individual properties — use `{"$ref":"<key>","path":["response","summary"]}` not `{"$ref":"<key>","path":["response"]}` when you need a specific field.

## Card: input slot = fields
Where it applies: `createRecord.inputs.fields` and `updateRecord.inputs.fields` when the write mode is `"customFields"`.
Value schema type: `AIRTABLE_RECORD_FIELDS`
Canonical accepted shape:
- `fields` is a structured object keyed by field ID
- each field value is its own expression
- the value shape depends on the destination field type
Minimal example:
```json
{
  "fields":{
    "fldName":{"template":["Archive - ", {"$ref":"trigger","path":["cellValuesByFieldId","fldName"]}]},
    "fldDone":true,
    "fldStage":{"id":"selDone"}
  }
}
```
Accepted but non-canonical: explicit `{"obj": {...}}` around the whole `fields` object.
Rejected shape:
- field names instead of field IDs
- arrays instead of an object map
- treating every visible field as writable
Why: `fields` is the object shell; the field-destination cards below define the allowed value shapes for each field family.

## Card: input slot = filtersObj
Where it applies: `recordMatchesConditions.inputs.filtersObj`.
Value schema type: `AIRTABLE_FILTERS`
Canonical accepted shape:
- `filtersObj` is a structured public-filter object
- the top-level shape is `{operator, operands}`
- top-level `operator` is a conjunction: `"and"` or `"or"`
- top-level `operands` uses `{"tuple":[...leaf filters...]}`
- each leaf filter is `{operator, operands[, operatorOptions]}`
- each leaf `operands` also uses `{"tuple":[fieldId, comparisonValue?]}`
Minimal example:
```json
{
  "filtersObj":{
    "operator":"and",
    "operands":{
      "tuple":[
        {"operator":"=","operands":{"tuple":["fldStage","selDone"]}},
        {"operator":"=","operands":{"tuple":["fldComplete",false]}}
      ]
    }
  }
}
```
Accepted but non-canonical: explicit `{"obj": ...}` wrappers around filter objects.
Rejected shape:
- formula strings
- plain arrays in either `operands` position
- internal/private filter shapes
Why: the automation filter editor serializes both conjunction operands and leaf operands as tuple expressions.

## Card: filter leaf rules
Where it applies: values inside `filtersObj` leaf filters after the slot shell is correct.
Shape reminder:
- each leaf is `{operator, operands[, operatorOptions]}`
- the leaf `operands` value uses `{"tuple":[fieldId, comparisonValue?]}`
Field-family rules:
- text-like (text, long text, rich text, phone):
  - operators: `=`, `!=`, `contains`, `doesNotContain`, `isEmpty`, `isNotEmpty`
  - comparison value: string
- number / rating:
  - operators: `=`, `!=`, `<`, `>`, `<=`, `>=`, `isEmpty`, `isNotEmpty`
  - comparison value: number
- checkbox:
  - operators: `=` (use `false` to match unchecked)
  - comparison value: boolean
- single select:
  - operators: `=`, `!=`, `isAnyOf`, `isNoneOf`, `isEmpty`, `isNotEmpty`
  - comparison value: a choice ID (preferred) or unambiguous choice name for `=`/`!=`; an array of them for `isAnyOf`/`isNoneOf`
- multi select:
  - operators: `hasAnyOf`, `hasAllOf`, `=` (is exactly), `doesNotContain` (has none of), `isEmpty`, `isNotEmpty`
  - comparison value: array of choice IDs and/or unambiguous choice names
- single collaborator:
  - operators: `=`, `!=`, `isAnyOf`, `isNoneOf`, `isEmpty`, `isNotEmpty`
  - comparison value: user ID, email, or unique collaborator name (array for `isAnyOf`/`isNoneOf`)
- multi collaborator:
  - operators: `hasAnyOf`, `hasAllOf`, `=` (is exactly), `doesNotContain` (has none of), `isEmpty`, `isNotEmpty`
  - comparison value: array of user IDs, emails, and/or unique collaborator names
- linked record:
  - operators: `hasAnyOf`, `hasAllOf`, `=` (is exactly), `isNoneOf`, `contains`, `doesNotContain`, `isEmpty`, `isNotEmpty`
  - comparison value: array of record IDs for membership operators; string for text operators
- attachment:
  - operators: `filename`, `fileType`, `isEmpty`, `isNotEmpty`
  - comparison value: string for `filename`; one file-type enum string for `fileType`
- date:
  - operators: `=`, `!=`, `<`, `>`, `<=`, `>=`, `isWithin`, `isEmpty`, `isNotEmpty`
  - comparison value: structured literal date object; do not model date filter RHS as a dynamic expression
Minimal examples:
```json
{"operator":"=","operands":{"tuple":["fldStage","selDone"]}}
{"operator":"=","operands":{"tuple":["fldComplete",false]}}
{"operator":"hasAnyOf","operands":{"tuple":["fldLinks",["recA","recB"]]}}
{"operator":"=","operands":{"tuple":["fldDue",{"mode":"exactDate","exactDate":"2026-04-23"}]}}
```
Dynamic values in filter operands:
You can reference upstream node outputs in filter values using `$ref` and `fn` expressions:
```json
{"operator":"hasAnyOf","operands":{"tuple":["fldChildTasks",{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLinkedTasks"]},{"fn":"propertyGetter","args":["id"]}]}]}}
```
This filters for records whose `fldChildTasks` linked record field contains any of the trigger's linked task IDs.

## Card: input slot = queryType
Where it applies: `findRecords.inputs.queryType`.
Value schema type: `SELECT`
Options: `"filtersObj"` (search by conditions) or `"viewId"` (search by view).

How to choose:
- Use `"filtersObj"` if the records to find can be described by filter conditions (e.g., "records where Status = Active", "records linked to the trigger").
- Use `"viewId"` if the user explicitly mentions a specific view by name, OR if no filter conditions can be reasonably inferred from the request.

The choice determines which other input is required:
- `"filtersObj"` => you must also provide `filtersObj` input (see Card: input slot = filtersObj)
- `"viewId"` => you must also provide `viewId` input

Send the literal string directly, not wrapped in a template.

## Card: input slot = viewId
Where it applies: `findRecords.inputs.viewId` when `queryType` is `"viewId"`.
Value schema type: `AIRTABLE_VIEW_ID`
Send a literal view ID string (e.g. `"viwAbc123"`).

Allowed view types: `grid`, `calendar`, `gallery`, `kanban`, `block`. Any other view type (e.g. `form`, `timeline`, or `list`) is rejected.
Avoid `form` views especially — they are input forms and do not contain records to search.

## Card: field destination = scalar
Where it applies: text, number, checkbox, date, phone, rating.
Literal write form: preferred when you already know the value.
- text-like: `{"template":["hello"]}`
- number/rating: literal number
- checkbox: literal boolean
- date/phone: literal string
Expression write form:
- preferred when copying from upstream output.
- ALWAYS wrap the expression in `{"template":[...]}`. Bare `$ref` / function
  expressions are rejected as field values even when the upstream type matches
  (e.g. a number-typed webhook field → a number column still needs `template`).
- Templates evaluate to strings and are coerced into the destination cell type at
  write time; do not try to preserve number/boolean types with a bare `$ref`.
- Dynamic examples:
  - number: `{"template":[{"$ref":"trigger","path":["body","durationSec"]}]}`
  - checkbox: `{"template":[{"$ref":"trigger","path":["body","isActive"]}]}`
  - text: `{"template":[{"$ref":"trigger","path":["body","name"]}]}`
Accepted but non-canonical: explicit `{"obj": ...}` wrappers around the `fields` map.
Rejected shape: display-name objects for scalar fields; bare `$ref` / function
expressions as field values.
Minimal example (static literals + one dynamic number):
```json
{"fields":{"fldCount":3,"fldDone":true,"fldDue":"2026-04-30","fldTitle":{"template":["Ready"]},"fldTeamSize":{"template":[{"$ref":"trigger","path":["body","teamSize"]}]}}}
```

## Card: field destination = single select
Where it applies: single-select fields.
Literal write form:
- preferred when you already know the choice ID: `{"id":"sel..."}`
Expression write form:
- preferred when copying from upstream select output: use the choice name string
- wrap dynamic values in `{"template":[...]}` — bare `$ref` is rejected (same rule as scalars)
- canonical example:
```json
{"template":[{"$ref":"trigger","path":["cellValuesByFieldId","fldStage","name"]}]}
```
Upstream read shape: `{id, name, color}`
Preferred transform: `.name`
Accepted but non-canonical: explicit `{"obj": ...}` wrappers around `fields`.
Rejected shape: defaulting to `.id` when copying from an upstream select object; bare `$ref` as the field value.
Minimal example:
```json
{"fields":{"fldStage":{"id":"selDone"}}}
```

## Card: field destination = multi select
Where it applies: multi-select fields.
Literal write form:
- preferred when you already know the choice IDs: `[{"id":"selA"},{"id":"selB"}]`
Expression write form:
- preferred when copying from upstream multi-select output: use the selected choice names as a comma-separated string
- wrap dynamic values in `{"template":[...]}` — bare `$ref` / `map` calls are rejected as field values
- canonical example:
```json
{"template":[{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldTags"]},{"fn":"propertyGetter","args":["name"]}]}]}
```
Upstream read shape: `[{id, name, color}]`
Preferred transform: map `.name`, then rely on the evaluator's comma-join behavior for array values inside `template`
Rejected shape: arrays of bare choice IDs or defaulting to mapped `.id` strings; bare `$ref` / unwrapped `map` as the field value
Minimal example:
```json
{"fields":{"fldTags":[{"id":"selA"},{"id":"selB"}]}}
```

## Card: field destination = single collaborator
Where it applies: single-collaborator fields.
Literal write form:
- preferred when you already know the user ID: `{"id":"usr..."}`
Expression write form:
- preferred when copying from upstream collaborator output: use email first, name as fallback text
- wrap dynamic values in `{"template":[...]}` — bare `$ref` is rejected (same rule as scalars)
- canonical example:
```json
{"template":[{"$ref":"trigger","path":["cellValuesByFieldId","fldOwner","email"]}]}
```
Upstream read shape: `{id, email, name, profilePicUrl}`
Preferred transform: `.email`
Rejected shape: defaulting to `.id` when the runtime expects stringcast collaborator identity; bare `$ref` as the field value
Minimal example:
```json
{"fields":{"fldOwner":{"id":"usrOwner"}}}
```

## Card: field destination = multi collaborator
Where it applies: multi-collaborator fields.
Literal write form:
- preferred when you already know the user IDs: `[{"id":"usrA"},{"id":"usrB"}]`
Expression write form:
- preferred when copying from upstream multi-collaborator output: use collaborator emails as a comma-separated string
- wrap dynamic values in `{"template":[...]}` — bare `$ref` / `map` calls are rejected as field values
- canonical example:
```json
{"template":[{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldAssignees"]},{"fn":"propertyGetter","args":["email"]}]}]}
```
Upstream read shape: `[{id, email, name, profilePicUrl}]`
Preferred transform: map `.email`, then rely on the evaluator's comma-join behavior for array values inside `template`
Rejected shape: arrays of bare user IDs or defaulting to mapped `.id` strings; bare `$ref` / unwrapped `map` as the field value
Minimal example:
```json
{"fields":{"fldAssignees":[{"id":"usrA"},{"id":"usrB"}]}}
```

## Card: field destination = linked record
Where it applies: linked-record fields.
Literal write form:
- there is no first-class MCP literal object shape documented for linked-record writes on this surface
Expression write form:
- preferred: record ID string inside `{"template":[...]}`
- fallback: primary field value string inside `{"template":[...]}`
- multi-value writes use comma-separated record IDs and/or primary field values in one template
- wrap dynamic values in `{"template":[...]}` — bare `$ref` / `map` calls are rejected as field values
Upstream read shape: `[{id, name}]`
Preferred transform: map `.id` when you already have linked record IDs; otherwise map `.name`
Rejected shape: assuming linked-record writes use the same `[{"id": ...}]` contract as multi select; bare `$ref` / unwrapped `map` as the field value.
Minimal example:
```json
{"template":[{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLinks"]},{"fn":"propertyGetter","args":["id"]}]}]}
```

## Card: read-only and computed field families
Where it applies: attachment writes, lookup writes, formula, rollup, autoNumber, barcode, button, createdTime, lastModifiedTime, createdBy, lastModifiedBy.
Canonical accepted shape:
- attachment and lookup are well-defined as upstream read/filter shapes
- computed/system fields must be omitted from create/update field maps
Rejected shape: sending explicit field values for computed/system fields.
Common mistakes: treating every visible field as writable.

## Card: upstream output = select or collaborator object
Where it applies: reading from `trigger` or any earlier node's output via `{"$ref":"<key>","path":[...]}` (use `"path":[]` for the whole output).
Output tokens:
- select: `{id: text, name: text, color: text}`
- collaborator: `{id: text, email: text, name: text, profilePicUrl: text}`
Upstream transform patterns:
- use `.name` or `.email` for text
- use `.id` when you need the identifier itself
Minimal examples:
```json
{"template":["Stage: ", {"$ref":"trigger","path":["cellValuesByFieldId","fldStage","name"]}]}
{"template":["Owner: ", {"$ref":"trigger","path":["cellValuesByFieldId","fldOwner","email"]}]}
```

## Card: upstream output = array of objects
Where it applies: multi select, multi collaborator, linked record, attachments.
Output tokens:
- multi select: `array<{id: text, name: text, color: text}>`
- multi collaborator: `array<{id: text, email: text, name: text, profilePicUrl: text}>`
- linked record: `array<{id: text, name: text}>`
- attachments: `array<{url: text, filename: text, type: text, thumbnails: object, ...}>`
Upstream transform patterns:
- `map(..., propertyGetter("name"))` for display text
- `map(..., propertyGetter("email"))` for collaborator stringcasts
- `map(..., propertyGetter("url"))` for attachment URLs
- `map(..., propertyGetter("id"))` gives string IDs and is mainly useful for linked-record stringcasts
Common mistakes: expecting `map(..., propertyGetter("id"))` to rebuild object arrays for select/collaborator field writes.

## Card: upstream output = lookup
Where it applies: lookup fields in trigger/node output.
Output tokens: `array<{linkedRecordId: text, value}>`
Upstream transform patterns:
- usually extract `value` first
- if `value` is itself array-valued, apply a second `map`
Minimal example:
```json
{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLookup"]},{"fn":"propertyGetter","args":["value"]}]}
```

## Card: upstream output = findRecords records array
Where it applies: downstream nodes referencing a `findRecords` node's output.
Output tokens: `{records: array<{id: text, url: text, cellValuesByFieldId: object}>}`
Unlike `createRecord`/`updateRecord` (which output a single record), `findRecords` outputs an object containing a `records` array.
Cell value shapes inside each record element follow the same patterns as trigger output — see the upstream output cards above for select, collaborator, linked record, lookup, and attachment shapes.
Upstream reference patterns (where `<key>` is the `key` you assigned to the upstream findRecords node, e.g. `node1`):
- full array: `{"$ref":"<key>","path":["records"]}`
- array of record IDs: `{"fn":"map","args":[{"$ref":"<key>","path":["records"]},{"fn":"propertyGetter","args":["id"]}]}`
- count of found records: `{"fn":"length","args":[{"$ref":"<key>","path":["records"]}]}`
- specific field values from found records: `{"template":[{"fn":"map","args":[{"fn":"map","args":[{"$ref":"<key>","path":["records"]},{"fn":"propertyGetter","args":["cellValuesByFieldId"]}]},{"fn":"propertyGetter","args":["fldEmail"]}]}]}`
Common mistakes:
- Using `{"$ref":"<key>","path":["id"]}` without going through `records` first.
- Forgetting that `cellValuesByFieldId` is nested inside each record element, not at the top level.

## Card: workflow functions reference
Where it applies: any expression slot that accepts a `{"fn":"name","args":[...]}` call (or a bare `{"fnRef":"name"}` reference passed as the predicate to `map`). Function names are case-sensitive and all of the functions below parse and validate today. When a function's result feeds a `TEXT` slot, wrap the call in `{"template":[ ... ]}` — the same rule as any other dynamic value.
Already covered elsewhere in this doc: `length` (array/string size), `map` (transform each element), and `propertyGetter` (extract a property, used inside `map`) — see the findRecords and upstream-output cards.
Static value getters: functions marked "static value getter" below read the run or the base rather than upstream data (the editor's "A specific time" and "Base structure" data sources). Pass one as a whole expression, never applied on top of another value; it is valid in every slot that accepts a dynamic value.

String — in: string, out: string; a null/undefined input coerces to `""`:
- `uppercase(s)` — locale uppercase
- `lowercase(s)` — locale lowercase
- `capitalize(s)` — uppercase the FIRST character only; the rest is unchanged
- `trim(s)` — strip leading and trailing whitespace
Example (lowercase a copied field):
```json
{"template":[{"fn":"lowercase","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldEmail"]}]}]}
```

Array:
- `first(array)` => element — the first element of an array, or null if the array is empty/missing. PRIMARY use case: unwrap a single-element array into a scalar so it can flow into single-value slots and comparisons. Airtable returns arrays even when a field holds at most one value — e.g. a link field limited to a single record, or a lookup/rollup over that single linked record — so `first` extracts the one value. This is also the only supported positional access: path-based indexing like `["0"]` is NOT supported (see the error-recovery card). Returns `T`, not `T | undefined`, so the result stays assignable to scalar slots and condition operands that compare against a single value.
- `last(array)` => element — the last element, or null if empty/missing; same single-value semantics as `first`. For a single-element array `first` and `last` are equivalent; prefer `first`.
Example (compare the single linked record's status against a literal): wrap the link-field lookup in `first` before the comparison so both sides are scalars.
To pull a NAMED property (e.g. name/status) off that single linked record, keep `first` on the OUTSIDE of `map(..., propertyGetter)`: `first(map(link, propertyGetter("name")))` — `map` extracts the property from each element, then `first` unwraps the one result into a scalar. Do NOT instead write `readProperty(first(link), "name")`: it computes the same value, but the expression builder cannot display or edit that shape (the field/property selection becomes unreachable in the UI), so the user is left unable to see or change what was selected.
- `flatten(arrayOfArrays)` — `T[][]` => `T[]`; concatenates exactly one level of nesting (null/undefined inner entries are skipped). Reach for it only when a value is genuinely an array-of-arrays — e.g. a `map` whose predicate returns an array per element, or a lookup whose `value` is itself array-valued. Most cell reads are already single-level, so `flatten` is rarely needed directly. In the Airtable UI it surfaces implicitly: the editor auto-applies it as a stepping stone before offering further transforms, rather than as its own menu item. Do NOT pass an array literal wrapping a single `$ref` (e.g. `flatten([$ref])`) — use the `$ref` directly; the extra nesting produces an expression the automation editor cannot display.
Example (first linked-record id from a single-element link field):
```json
{"template":[{"fn":"first","args":[{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLink"]},{"fn":"propertyGetter","args":["id"]}]}]}]}
```

Object:
- `readProperty(object, key)` => value — reads one property off a SINGLE object by name, e.g. `{"fn":"readProperty","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLookup"]},"value"]}`. This is the direct (non-curried) sibling of `propertyGetter`: use `readProperty` on one object, and `propertyGetter` inside `map` to pull the same property off every element of an array. For records you can usually use a `path` lookup (`{"$ref":...,"path":["cellValuesByFieldId","fld..."]}`) instead; reach for `readProperty` when the object is itself an expression result. EXCEPTION: do NOT stack `readProperty` on `first(linkField)` to read a linked record's property (e.g. `readProperty(first(link), "name")`) — use `first(map(link, propertyGetter("name")))` instead. Both compute the same value, but the builder can render yet not edit the readProperty-over-first shape, so keep `first` outside `map(..., propertyGetter)` (see the `first` notes above).

Time — no record input; reads the run clock. Both are static value getters:
- `getWorkflowExecutionTime(dateFormat, timeZone)` => string — `dateFormat` is one of `"Local"`, `"Friendly"`, `"US"`, `"European"`, `"ISO"`; `timeZone` is an IANA zone such as `"America/New_York"` (or `"utc"`). Formats the current time.
- `getWorkflowExecutionIsoDateTime()` => string — the current time as a full ISO 8601 timestamp; takes no arguments.

Base schema — no record input; resolves names/ids from the base schema. Also a static value getter:
- `getBaseMetadata(modelId, modelProperty)` => string — `modelId` is a literal table ID or field (column) ID; `modelProperty` is `"id"` or `"name"`. Returns that table's or field's id or display name; use it to print a human-readable table/field name.

URL:
- In-base record URL (the link that opens the record in the base grid) is NOT a function — it is the `url` property on any record reference. Read it with a path lookup: `{"$ref":"trigger","path":["url"]}`, or for an array of records map it: `{"fn":"map","args":[{"$ref":"node1","path":["records"]},{"fn":"propertyGetter","args":["url"]}]}`. Prefer this for "link to the record" in email/Slack bodies.
- `generateRowPageUrl(recordOrRecords, {"pageId":"pag...","tableId":"tbl..."})` => string[] — builds INTERFACE-page record URLs (a specific interface page, not the base grid) for one record or an array of records. ALWAYS returns an array of URL strings, even for a single record. It requires a valid interface `pageId`; omit this function unless you actually have one — for a plain link to the record use the `url` property above.

Record rendering — render a record or array of records into a formatted text block. First arg is a record or record array; second arg is options such as `{"fields":"all"}` or `{"fields":["fld...","fld..."]}`. `fields` must be `"all"` or a plain JSON array of literal field IDs — not a `{"tuple":[...]}`, `$ref`, or function result. A "list" renders one record after another (good for prose-like bodies); a "grid" renders a table with one row per record (good for comparing many records).
Each variant is gated to the destination channel whose text format it emits — they are NOT interchangeable. The destination determines which one to use:
- Email body (`sendEmail`, and Gmail / Outlook send-email actions): `renderRecordsAsListWithHtmlInMarkdown` (vertical list) or `renderRecordsAsGridWithHtmlInMarkdown` (table).
- Slack messages (Send to Slack / Slack actionable message): `renderRecordsAsListForSlack`.
- Microsoft Teams messages: `renderRecordsAsListWithHtml` / `renderRecordsAsGridWithHtml` (HTML body) or `renderRecordsAsListWithAfm` (rich-text body).
- Interface / document outputs: `renderRecordsAsListInDocument` / `renderRecordsAsGridInDocument`.
Example (email body listing found records):
```json
{"template":[{"fn":"renderRecordsAsListWithHtmlInMarkdown","args":[{"$ref":"node1","path":["records"]},{"obj":{"fields":"all"}}]}]}
```
To render the triggering record itself, pass the trigger reference with an empty path (an empty
`path` means "the whole record") as the first arg:
```json
{"template":[{"fn":"renderRecordsAsListWithHtmlInMarkdown","args":[{"$ref":"trigger","path":[]},{"obj":{"fields":"all"}}]}]}
```
Do NOT add a findRecords node to obtain a records array, and do NOT expand the record's fields by
hand — this function takes a single record or a record array directly.

Structured insertion — carry a non-scalar value through without stringifying it field by field:
- `insertAsJson(value)` => string — `JSON.stringify` of any value; use when a slot wants a JSON string of structured data
- `insertAsData(value)` => value — identity; preserves the structured value as-is when the destination accepts the structured shape directly
Both are meant for genuinely structured (object/array) values; in the UI they intentionally refuse Airtable record / cell-keyed shapes, which would leak internal ids.

# Examples

## Example A: record created -> update text field
```json
{
  "baseId":"app...",
  "name":"Auto-set status on create",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblTasks",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{"fldStatus":{"template":["In Progress"]}}
      }
    }
  ]
}
```

## Example B: record updated -> watch specific fields
```json
{
  "trigger":{
    "type":"recordUpdated",
    "inputs":{"tableId":"tblTasks","watchFields":["fldPriority","fldDue"]}
  }
}
```

## Example C: record matches conditions -> create record
```json
{
  "trigger":{
    "type":"recordMatchesConditions",
    "inputs":{
      "tableId":"tblTasks",
      "filtersObj":{
        "operator":"and",
        "operands":{
          "tuple":[
            {"operator":"=","operands":{"tuple":["fldStage","selBlocked"]}},
            {"operator":"=","operands":{"tuple":["fldComplete",false]}}
          ]
        }
      }
    }
  },
  "nodes":[
    {
      "key":"node1",
      "type":"createRecord",
      "inputs":{
        "tableId":"tblAlerts",
        "createRecordMethod":"customFields",
        "fields":{"fldMessage":{"template":["Blocked task: ", {"$ref":"trigger","path":["id"]}]}}
      }
    }
  ]
}
```

## Example D: text from attachment URLs
```json
{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldFiles"]},{"fn":"propertyGetter","args":["url"]}]}
```

## Example E: flatten lookup values
```json
{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldLookup"]},{"fn":"propertyGetter","args":["value"]}]}
```

## Example F: findRecords by filter + downstream createRecord
```json
{
  "baseId":"app...",
  "name":"Archive completed tasks",
  "trigger":{"type":"recordUpdated","inputs":{"tableId":"tblTasks","watchFields":["fldComplete"]}},
  "nodes":[
    {
      "key":"node1",
      "type":"findRecords",
      "inputs":{
        "tableId":"tblTasks",
        "queryType":"filtersObj",
        "filtersObj":{
          "operator":"and",
          "operands":{
            "tuple":[
              {"operator":"=","operands":{"tuple":["fldComplete",true]}},
              {"operator":"=","operands":{"tuple":["fldArchived",false]}}
            ]
          }
        },
        "limit":100
      }
    },
    {
      "key":"node2",
      "type":"createRecord",
      "inputs":{
        "tableId":"tblArchiveLog",
        "createRecordMethod":"customFields",
        "fields":{
          "fldCount":{"template":[{"fn":"length","args":[{"$ref":"node1","path":["records"]}]}]},
          "fldTimestamp":{"template":[{"$ref":"trigger","path":["lastModifiedTime"]}]}
        }
      }
    }
  ]
}
```

## Example G: findRecords by view
```json
{
  "baseId":"app...",
  "name":"Log active projects count",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblProjects"}},
  "nodes":[
    {
      "key":"node1",
      "type":"findRecords",
      "inputs":{
        "tableId":"tblProjects",
        "queryType":"viewId",
        "viewId":"viw39c7bf444fc2e6"
      }
    },
    {
      "key":"node2",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblProjects",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{
          "fldActiveCount":{"template":[{"fn":"length","args":[{"$ref":"node1","path":["records"]}]}]}
        }
      }
    }
  ]
}
```

## Example H: reverse-link lookup to copy a field value
Filter the Projects table where the reverse link field `fldTasks` contains the trigger's ID. Use the trigger's own record ID (a Task ID) — it matches the ID type stored in the reverse link field.
```json
{
  "baseId":"app...",
  "name":"Copy project code to new tasks",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"findRecords",
      "inputs":{
        "tableId":"tblProjects",
        "queryType":"filtersObj",
        "filtersObj":{
          "operator":"and",
          "operands":{
            "tuple":[
              {"operator":"hasAnyOf","operands":{"tuple":["fldTasks",[{"$ref":"trigger","path":["id"]}]]}}
            ]
          }
        },
        "limit":1
      }
    },
    {
      "key":"node2",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblTasks",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{
          "fldProjectCode":{"template":[{"fn":"map","args":[{"fn":"map","args":[{"$ref":"node1","path":["records"]},{"fn":"propertyGetter","args":["cellValuesByFieldId"]}]},{"fn":"propertyGetter","args":["fldProjectCode"]}]}]}
        }
      }
    }
  ]
}
```

## Example I: record created -> send notification email
```json
{
  "baseId":"app...",
  "name":"Notify assignee on task creation",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"sendEmail",
      "inputs":{
        "to":[{"template":[{"$ref":"trigger","path":["cellValuesByFieldId","fldAssignee","email"]}]}],
        "subject":{"template":["New task: ", {"$ref":"trigger","path":["cellValuesByFieldId","fldTaskName"]}]},
        "message":{"template":["Hello ", {"$ref":"trigger","path":["cellValuesByFieldId","fldAssignee","name"]}, ",\
\
A new task has been assigned to you:\
\
**", {"$ref":"trigger","path":["cellValuesByFieldId","fldTaskName"]}, "**\
\
", {"$ref":"trigger","path":["cellValuesByFieldId","fldDescription"]}]}
      }
    }
  ]
}
```

## Example J: record updated -> create log record then send confirmation email
```json
{
  "baseId":"app...",
  "name":"Log and confirm status change",
  "trigger":{"type":"recordUpdated","inputs":{"tableId":"tblOrders","watchFields":["fldStatus"]}},
  "nodes":[
    {
      "key":"node1",
      "type":"createRecord",
      "inputs":{
        "tableId":"tblAuditLog",
        "createRecordMethod":"customFields",
        "fields":{"fldNote":{"template":["Status changed to ", {"$ref":"trigger","path":["cellValuesByFieldId","fldStatus","name"]}]}}
      }
    },
    {
      "key":"node2",
      "type":"sendEmail",
      "inputs":{
        "to":[{"template":["contact@example.invalid"]}],
        "cc":[{"template":[{"$ref":"trigger","path":["cellValuesByFieldId","fldOwner","email"]}]}],
        "fromName":{"template":["Order Tracker"]},
        "subject":{"template":["Order ", {"$ref":"trigger","path":["cellValuesByFieldId","fldOrderId"]}, " status updated"]},
        "message":{"template":["Order **", {"$ref":"trigger","path":["cellValuesByFieldId","fldOrderId"]}, "** status changed to **", {"$ref":"trigger","path":["cellValuesByFieldId","fldStatus","name"]}, "**.\
\
Log record: ", {"$ref":"node1","path":["url"]}]}
      }
    }
  ]
}
```

## Example K: for-each loop reading the current item
Find all incomplete tasks, then loop over them; for each one, set its status using its own current cell values. Note how the inner `updateRecord` reads the current iteration's record id and a field via `pickBranchData(<loopKey>.sel7f656839ee1e19)`.
```json
{
  "baseId":"app...",
  "name":"Mark incomplete tasks in progress",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblBatches"}},
  "nodes":[
    {
      "key":"node1",
      "type":"findRecords",
      "inputs":{
        "tableId":"tblTasks",
        "queryType":"filtersObj",
        "filtersObj":{
          "operator":"and",
          "operands":{"tuple":[{"operator":"=","operands":{"tuple":["fldComplete",false]}}]}
        }
      }
    },
    {
      "key":"loop1",
      "type":"repeatingGroup",
      "name":"For each incomplete task",
      "inputs":{"items":{"$ref":"node1","path":["records"]}},
      "nodes":[
        {
          "key":"node2",
          "type":"updateRecord",
          "inputs":{
            "tableId":"tblTasks",
            "rowId":{"template":[{"fn":"readProperty","args":[{"fn":"pickBranchData","args":[{"$ref":"loop1","path":["sel7f656839ee1e19"]}]},"id"]}]},
            "updateRecordMethod":"customFields",
            "fields":{
              "fldStatus":{"template":["In progress"]},
              "fldPreviousName":{"template":[{"fn":"readProperty","args":[{"fn":"readProperty","args":[{"fn":"pickBranchData","args":[{"$ref":"loop1","path":["sel7f656839ee1e19"]}]},"cellValuesByFieldId"]},"fldName"]}]}
            }
          }
        }
      ]
    }
  ]
}
```

## Example L: record updated -> create record + send Slack
```json
{
  "baseId":"app...",
  "name":"Log and notify on status change",
  "trigger":{
    "type":"recordUpdated",
    "inputs":{"tableId":"tblTasks","watchFields":["fldStatus"]}
  },
  "nodes":[
    {
      "key":"node1",
      "type":"createRecord",
      "inputs":{
        "tableId":"tblAuditLog",
        "createRecordMethod":"customFields",
        "fields":{"fldDescription":{"template":["Status changed for ", {"$ref":"trigger","path":["cellValuesByFieldId","fldName"]}]}}
      }
    },
    {
      "key":"node2",
      "type":"sendToSlack",
      "externalAccountId":"eac...",
      "inputs":{
        "slackConversationId":"C0STATUS001",
        "notificationText":{
          "template":[
            "Status updated for *",
            {"$ref":"trigger","path":["cellValuesByFieldId","fldName"]},
            "* — <",
            {"$ref":"node1","path":["url"]},
            "|audit log>"
          ]
        }
      }
    }
  ]
}
```

## Example M: weekly schedule -> send a digest email
```json
{
  "baseId":"app...",
  "name":"Weekly task digest",
  "trigger":{
    "type":"cron",
    "inputs":{
      "type":"weeklyV2",
      "config":{"weekdays":[1],"triggerTimes":[{"hour":9,"minute":0,"second":0}],"width":1},
      "start":"2027-01-04T17:00:00.000Z"
    }
  },
  "nodes":[
    {
      "key":"node1",
      "type":"sendEmail",
      "inputs":{
        "to":[{"template":["contact@example.invalid"]}],
        "subject":{"template":["Weekly task digest"]},
        "message":{"template":["Your weekly task digest is ready."]}
      }
    }
  ]
}
```

## Example N: form submitted -> notify on new submission
```json
{
  "baseId":"app...",
  "name":"Acknowledge form submission",
  "trigger":{"type":"formSubmitted","inputs":{"tableId":"tblResponses","formId":"viw3fff2792ee4a8d"}},
  "nodes":[
    {
      "key":"node1",
      "type":"sendEmail",
      "inputs":{
        "to":[{"template":["contact@example.invalid"]}],
        "subject":{"template":["New form submission"]},
        "message":{"template":["A new response was submitted: ", {"$ref":"trigger","path":["cellValuesByFieldId","fldName"]}]}
      }
    }
  ]
}
```

## Example O: record enters view -> send email
```json
{
  "trigger":{
    "type":"recordEntersView",
    "inputs":{"tableId":"tblTasks","viewId":"viwHighPriority"}
  },
  "nodes":[
    {
      "key":"node1",
      "type":"sendEmail",
      "inputs":{
        "to":[{"template":["contact@example.invalid"]}],
        "subject":{"template":["Task entered High Priority view"]},
        "message":{"template":["Record ", {"$ref":"trigger","path":["id"]}, " entered the view."]}
      }
    }
  ]
}
```

## Example P: record created -> AI-generate and write back
```json
{
  "baseId":"app...",
  "name":"AI-summarize new tasks",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"aiGenerate",
      "inputs":{
        "prompt":{"template":["Summarize this task:\
\
",{"$ref":"trigger","path":["cellValuesByFieldId","fldDescription"]}]},
        "model":"default",
        "availableTools":["brightDataSearch","brightDataReadWebpage"]
      }
    },
    {
      "key":"node2",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblTasks",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{"fldSummary":{"template":[{"$ref":"node1","path":["response"]}]}}
      }
    }
  ]
}
```

## Example Q: record created -> AI-extract structured metadata and update record
```json
{
  "baseId":"app...",
  "name":"Extract task metadata with AI",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"aiGenerateStructuredOutput",
      "description":"Extract priority and category from task description",
      "inputs":{
        "prompt":{"template":["Analyze the following task and extract structured metadata.

Task: ",{"$ref":"trigger","path":["cellValuesByFieldId","fldName"]},"
Description: ",{"$ref":"trigger","path":["cellValuesByFieldId","fldDescription"]}]},
        "outputSchema":{"response":{"type":"object","properties":{"priority":{"type":"string","enum":["low","medium","high","critical"]},"category":{"type":"string"},"estimatedHours":{"type":"number"},"isBlocking":{"type":"boolean"}}}},
        "model":"default"
      }
    },
    {
      "key":"node2",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblTasks",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{
          "fldPriority":{"template":[{"$ref":"node1","path":["response","priority"]}]},
          "fldCategory":{"template":[{"$ref":"node1","path":["response","category"]}]},
          "fld632dc712940144":{"template":[{"$ref":"node1","path":["response","estimatedHours"]}]},
          "fldIsBlocking":{"template":[{"$ref":"node1","path":["response","isBlocking"]}]}
        }
      }
    }
  ]
}
```

## Example R: find records then sort them
```json
{
  "baseId":"app...",
  "name":"Sort open tasks by priority",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblTasks"}},
  "nodes":[
    {
      "key":"node1",
      "type":"findRecords",
      "inputs":{"tableId":"tblTasks","queryType":"viewId","viewId":"viwOpenTasks"}
    },
    {
      "key":"node2",
      "type":"sort",
      "inputs":{
        "inputList":{"$ref":"node1","path":["records"]},
        "sortFields":[
          {"idSequence":["fldPriority"],"sortOrder":"desc"},
          {"idSequence":["fldDueDate"],"sortOrder":"asc"}
        ]
      }
    }
  ]
}
```

# Error index

- If validation says `recordId` is unknown, read Example A and use `rowId`.
- If validation rejects a raw `$ref` in `rowId`, read the `updateRecord` card and wrap it in `{"template":[...]}`.
- `invalidInputExpression (inputKey: fields)` => see Card: field destination = scalar (and the other field-destination cards). One of the values in the `fields` map is a raw expression shape the slot does not accept — commonly a bare `$ref` or unwrapped `map`/`fn` where `{"template":[...]}` is required. This applies to every field type, including number/rating/checkbox; dynamic values always go through `template` (matching the Automations UI Dynamic mode). The error does not name which field ID failed — bisect the `fields` map if needed.
- If validation says a filter is not a valid object, read `input slot = filtersObj` and Example C.
- If validation rejects plain arrays inside `filtersObj.operands`, switch both `operands` positions to `{"tuple":[...]}`.
- If validation rejects `watchFields`, read the `recordUpdated` card and switch to `"all"` or a field ID array.
- If validation rejects a filter RHS value, read `filter leaf rules` and switch to the public value form for that field family.
- If validation rejects a copied select object, read the single-select card and switch to `.name` via `template`.
- If validation rejects a copied multi-select object array, read the multi-select card and switch to comma-separated choice names.
- If validation rejects a copied collaborator object, read the single-collaborator card and switch to `.email` or `.name`.
- If validation rejects `["usrA","usrB"]` for a multi collaborator field, read the multi-collaborator card and send either `[{"id":"usrA"},{"id":"usrB"}]` or comma-separated emails.
- If validation rejects a linked-record field write that was modeled like multi select, read the linked-record card and switch to record IDs or primary values as strings.
- If validation rejects a date filter string, read the date filter card and send a structured date object.
- If validation says "X is not a valid property of Y" where X is a numeric index like "0", you are trying to index into an array by position. The expression type checker does not support path-based array indexing. Use `map` + `propertyGetter` instead. See Card: upstream output = findRecords records array.
- `nodeSpecificError/missingExpressionForSelectedQueryType` => see Card: action = findRecords. You selected a queryType but did not provide the corresponding input; the reported `inputKey` (`filtersObj` or `viewId`) names the missing one.
- "Enter a whole number from 1 and <max>" => see Card: action = findRecords. The limit is above the base's maximum record limit. Send a limit from 1 to 1000, or omit it.
- "Invalid filter operator" => see Card: input slot = filtersObj (enhanced). Use a valid operator from the operators table.
- "Unsupported view type" => see Card: input slot = viewId. Avoid form views (they do not contain searchable records).
- If validation rejects `to`, read the `sendEmail` card — each item is a string or `{"template":[...]}`, and the array must be non-empty.
- If validation rejects an action node that uses an external provider or deployment fails with a missing external account, ensure `externalAccountId` is set on the node and any provider-specific IDs (e.g. `slackConversationId`) use real values from `fetch_automation_input_data`.
- If a node inside a loop body needs the current item, or a `pickBranchData`/`sel7f656839ee1e19` reference inside a loop body is rejected, read Card: per-iteration data inside a repeatingGroup and Example K — wrap `<loopKey>.sel7f656839ee1e19` in `pickBranchData` and drill in with `readProperty`. After a `repeatingGroup`, the current item and the loop body's nodes aren't available: use `{"$ref":"<loopKey>","path":["itemsProcessedCount"]}`, or move the step into the loop.
- `invalidConditionOperator` => see Card: condition expressions on conditionalGroup branches. The operator name did not resolve for the comparison's `dataType`; use an operator name Airtable filters use (e.g. `=`, `!=`, `contains`, `isEmpty`, `hasAnyOf`), and remember `"array"` dataType only accepts `contains`/`doesNotContain`/`isEmpty`/`isNotEmpty`.
- `invalidConditionShape` => see Card: condition expressions on conditionalGroup branches. A branch condition comparison was structurally invalid (e.g. missing its `left` operand).
- If a scheduled (`cron`) automation is rejected for a missing `start`, read Card: trigger = cron — every recurring `type` requires `start` (use the current time if the user did not name one).
- `invalidInputExpressionOperand/nonScalarTemplateToken` => a `$ref` in `inputObj` resolves to a non-scalar value (e.g. a bare select, collaborator, or linked-record field). See the `inputObj` slot rules in Card: action = customScript — drill the path to a string property (`"name"` or `"id"`), use `map` for multi-value fields, or wrap in `insertAsData` to pass the structured value as-is.
- `invalidInputExpressionOperand/notBuilderRenderable` => an `inputObj` value contains an expression the automation editor cannot render. `insertAsData` must wrap a `$ref` or a function call, not a literal object/array. Use a string, or a `$ref` (optionally wrapped in a function) to a field holding the value.
- `invalidInputExpressionOperand/templateNotAllowed` => a filter or condition operand contains a template expression. Use a single string literal or a single `$ref` instead.
- If you are about to list many of a record's fields in a message/email body — i.e. building a long `template` array with one `$ref`/`map` expression per field — STOP. That is the wrong approach even though it parses. Use a record-rendering function instead (`renderRecordsAsListWithHtmlInMarkdown` / `renderRecordsAsGridWithHtmlInMarkdown` for email; see the record-rendering card), passing the whole record (e.g. `{"$ref":"trigger","path":[]}`) with `{"obj":{"fields":"all"}}` (or `{"obj":{"fields":["fld...","fld..."]}}` for a subset). Never hand-expand a record's fields one by one.

## Card: action = customScript
Where it applies: execute custom JavaScript — external API calls, data transformations, multi-step record operations that built-in actions cannot handle.
Canonical accepted shape:
```json
{"type":"customScript","inputs":{"script":"const cfg = input.config();\
const record = await base.getTable(cfg.tableName).sel85afa145748c5a(cfg.recordId);\
output.set('name', record.getCellValueAsString('Name'));","inputObj":{"recordId":{"$ref":"trigger","path":["id"]},"tableName":"Projects"}},"outputSchema":[{"name":"name","type":"string"}],"secrets":{"MY_API_KEY":"eac..."}}
```
Input slots:
- `script` => required; JavaScript source as a bare string literal (not a template expression). See scripting API below.
- `inputObj` => optional; key-value pairs mapping variable names to expressions. Accessed via `input.config()` or `input.get(key)`. Each value must be a string literal (`"hello"`), a `$ref` expression, a function call (any from the workflow functions reference card, including static value getters), or a template expression. Static objects (like `{"id":"sel..."}`), arrays, numbers, booleans, and null are NOT accepted as literal values — use strings, or a `$ref` to a field holding the value. A `$ref` (or template token) must resolve to a scalar or an array of scalars unless wrapped in `insertAsData`:
  - Text / number / checkbox / date fields: the raw field value is already scalar, so `{"$ref":"trigger","path":["cellValuesByFieldId","fldXXX"]}` is fine.
  - Single select / single collaborator, when the script wants a string: drill to a property — `{"$ref":"trigger","path":["cellValuesByFieldId","fldXXX","name"]}` (or `"id"`). Do NOT stop at `["cellValuesByFieldId","fldXXX"]` — that is the whole object and is rejected.
  - Multi-value fields (multi-select, linked records, multi-collaborator), when the script wants strings: `{"fn":"map","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldXXX"]},{"fn":"propertyGetter","args":["name"]}]}`, or `length(...)` for the count.
  - When the script wants the object/array itself (e.g. to read several properties): wrap the ref — `{"fn":"insertAsData","args":[{"$ref":"trigger","path":["cellValuesByFieldId","fldXXX"]}]}`. This is what the UI's "As JSON data" option produces. `insertAsData` must wrap a `$ref` or a function call (e.g. `map`) — wrapping a literal array/object is rejected.
  - Static lists and objects cannot be passed through `inputObj`. Store the data in a field and `$ref` it, pass a delimited string (`"a,b,c"`) and split it in the script, or hardcode the data directly in the script source.
  Runtime note: `inputObj` values are template-rendered, so arrays of scalars (e.g. from `map`) are joined into a comma-separated string. `input.get("key")` returns `"Alice, Bob"`, not `["Alice", "Bob"]`. To receive structured data (arrays/objects), wrap the expression in `insertAsData`.
- `secrets` => optional; top-level field on the action node (not inside `inputs`) mapping secret names to ExternalAccountId references. Discover available IDs with the list_secrets tool. The script accesses secrets via `input.secret(name)`.
- `outputSchema` => optional; array of `{name, type?}` declaring properties set via `output.set()`. `type` is `"string"`, `"number"`, or `"boolean"` for scalars, or a recursive type descriptor (`{type: "object", properties: {...}}`, `{type: "array", items: ...}`) for nested structures. Without `outputSchema`, downstream nodes cannot `$ref` this action's output. When the output shape is uncertain (e.g. the script calls an external API via `fetch` without documentation for the response format), follow the "Uncertain output" procedure below instead of guessing.
Output shape: dynamic — reference declared properties via `{"$ref":"<key>","path":["<propertyName>"]}`.
Common mistakes:
- Wrapping `script` in `{"template":[...]}` — must be a bare string literal.
- Omitting `outputSchema` when downstream nodes need to `$ref` output properties.
- `input.config.key` (property access) instead of `input.config().key` (function call) — `config` is a function. Call once and store: `const cfg = input.config();`.
- Not calling `output.set()` for each output property — returning a value does not create outputs.
- Omitting `description` — always set a description for customScript nodes. Unlike other action types where a short phrase suffices, custom scripts contain opaque code that non-technical users cannot read. Write a readable natural-language summary that walks through the script's logic in enough detail so a user who does not know how to code can understand what actions the script takes, what data it reads or writes, and what it outputs. If the script calls external APIs, include the exact URL or endpoint from the code. For example: "Looks up the project record from the Projects table using the project ID from the trigger. Reads the project's status, deadline, and assigned team member fields. If the deadline is in the past and the status is not 'Complete', calls fetch('https://slack.com/api/chat.postMessage') to send a Slack message to the team member and sets the output to the response's ts field."
- Using field-destination literal formats (e.g. `{"id":"sel..."}` for select, `[{"id":"rec..."}]` for linked records) inside `inputObj` — those formats are for `fields` in createRecord/updateRecord only. In `inputObj`, use `$ref` expressions to reference field values dynamically, or pass the value as a plain string.
- A bare `$ref` to a select / collaborator / linked-record field in `inputObj` — see the `inputObj` slot rules above for the accepted patterns.
Scripting API reference (automation context):
Environment: Node.js 22 on AWS Lambda. Available globals: `base`, `input`, `output`, `fetch`, `console`, `setTimeout`, `clearTimeout`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `atob`, `btoa`, plus standard built-ins (`Promise`, `Map`, `Set`, `Date`, `JSON`, `Math`, `RegExp`, typed arrays).
input/output:
- `input.config()` => call once; returns `{[key]: value}` for all `inputObj` entries. A second call throws.
- `input.get(key)` => single `inputObj` value by key.
- `input.secret(name)` => returns the secret value for the given name (must match a key in `secrets`).
- `output.set(key, value)` => set a named output property (must be JSON-serializable).
- `console.log()`, `.warn()`, `.error()`, `.info()` => log to run history.
base:
- `base.id`, `base.name` => base metadata.
- `base.tables` => read-only array of all Table objects.
- `base.getTable(idOrName)` => Table by ID or name.
- `base.activeCollaborators` => read-only array of `{id, email, name}` objects.
- `base.getCollaborator(idOrNameOrEmail)` => single Collaborator.
table:
- `table.id`, `table.name`, `table.description` => table metadata.
- `table.fields` => read-only array of Field objects. `table.getField(idOrName)` => single Field.
- `table.views` => read-only array of View objects (`{id, name, type}`). `table.getView(idOrName)` => single View.
- `table.selectRecordsAsync({fields?})` => `{records: Record[]}`. Optional `fields` limits which fields are fetched.
- `table.sel85afa145748c5a(recordId)` => single Record or null.
- `table.createRecordAsync(fields)` => creates one record, returns its ID.
- `table.createRecordsAsync([{fields}, ...])` => batch create, max 50 per call.
- `table.updateRecordAsync(recordId, fields)` => updates one record.
- `table.updateRecordsAsync([{id, fields}, ...])` => batch update, max 50 per call.
- `table.deleteRecordAsync(recordId)` => deletes one record.
- `table.deleteRecordsAsync([recordId, ...])` => batch delete, max 50 per call.
- `table.createFieldAsync(name, type, options?, description?)` => creates a field, returns its ID.
record:
- `record.id` => record ID. `record.name` => primary field display value.
- `record.getCellValue(fieldIdOrName)` => raw cell value.
- `record.getCellValueAsString(fieldIdOrName)` => cell value as display string.
field:
- `field.id`, `field.name`, `field.type`, `field.description` => field metadata.
- `field.options` => type-specific config (e.g. choices for select fields). `field.isComputed` => true for formula/rollup/lookup.
fetch:
- `fetch(url, options?)` => standard Fetch API (GET, POST, PUT, DELETE, HEAD, OPTIONS). Returns Response with `.json()`, `.text()`, `.status`, etc.
Uncertain output — stop-and-test procedure:
When updating an existing automation, check the get_automation response first: if the custom script node already has a non-empty `outputSchema` and the script has not changed, preserve it — do not re-trigger this procedure.
When you cannot confidently determine the output property names and types, do NOT guess. Instead:
1. Call create_automation (or update_automation) with all nodes except those that directly or transitively depend on this action's output (i.e. omit any node that `$ref`s this action, and any node that `$ref`s an omitted node, recursively) — omit `outputSchema` on this custom script node. Do NOT ask the user to turn the automation on yet — it is incomplete until step 4.
2. Share the `automationUrl` from the response and ask the user to open the automation in the Airtable UI, navigate to this custom script action, and click "Test". Warn the user: testing executes the script, including any side effects.
3. After the user confirms testing is complete, call get_automation with the `automationId`. If the custom script node now has a non-empty `outputSchema`, proceed to step 4. If `outputSchema` is absent or empty, the test may have failed or the script may not have called `output.set()` — ask the user to check and retry.
4. Call update_automation with the full graph — preserve each node's `key` from the get_automation response, pass the test-derived `outputSchema` through verbatim on this node (it may contain nested object/array type descriptors — do not simplify or rewrite it), and add back the downstream nodes that were omitted in step 1.

## Example: record created -> custom script with external fetch -> write back result
```json
{
  "baseId":"app...",
  "name":"Enrich new contacts",
  "trigger":{"type":"recordCreated","inputs":{"tableId":"tblContacts"}},
  "nodes":[
    {
      "key":"node1",
      "type":"customScript",
      "inputs":{
        "script":"const cfg = input.config();\
const resp = await fetch(`https://api.example.com/lookup?email=${encodeURIComponent(cfg.email)}`);\
const data = await resp.json();\
output.set('company', data.company || 'Unknown');\
output.set('title', data.title || '');",
        "inputObj":{
          "email":{"$ref":"trigger","path":["cellValuesByFieldId","fldEmail"]}
        }
      },
      "outputSchema":[
        {"name":"company","type":"string"},
        {"name":"title","type":"string"}
      ]
    },
    {
      "key":"node2",
      "type":"updateRecord",
      "inputs":{
        "tableId":"tblContacts",
        "rowId":{"template":[{"$ref":"trigger","path":["id"]}]},
        "updateRecordMethod":"customFields",
        "fields":{
          "fldCompany":{"template":[{"$ref":"node1","path":["company"]}]},
          "fldTitle":{"template":[{"$ref":"node1","path":["title"]}]}
        }
      }
    }
  ]
}
```

## Card: trigger = cellValueChanged
Where it applies: the user names both a starting and an ending value for one field, e.g. "when Status goes from In progress to Done", "when a task is approved (checkbox goes from unchecked to checked)", "when Priority changes from 1 or 2 stars to 5 stars". It fires only when a record's value changes from any of `fromValues` to any of `toValues`. Records created with a To value never fire. If the user only names the end value ("when Status becomes Done"), use `recordMatchesConditions` instead.
Canonical accepted shape:
```json
{"type":"cellValueChanged","inputs":{"tableId":"tbl...","fieldId":"fld...","fromValues":{"fieldType":"select","choiceIds":["selInProgress"]},"toValues":{"fieldType":"select","choiceIds":["selDone"]}}}
```
Input slots:
- `tableId` => `AIRTABLE_TABLE_ID`; send a literal table ID string only
- `fieldId` => a literal field ID; the field must be a single select, checkbox, or rating field
- `fromValues` / `toValues` => an object tagged with the field's type, holding a non-empty array of literals:
  - single select: `{"fieldType":"select","choiceIds":["sel..."]}` with option IDs from the field's `options.choices` in get_table_schema. Option names are not recognized and never match, so always send IDs
  - checkbox: `{"fieldType":"checkbox","values":[false]}`; `false` means unchecked. Send one value per side, e.g. from `[false]` to `[true]`
  - rating: `{"fieldType":"rating","ratings":[1,2]}` with integers from 1 to the field's `options.max`
Rejected shape: field names instead of IDs, `$ref` or template values, untagged arrays, a `fieldType` that doesn't match the field, or an empty array. An unknown field, a field of another type, or values tagged with the wrong `fieldType` are reported as input errors on that input.
Output tokens: same record-like envelope as the other record triggers.

# Available but not yet fully supported nodes

The trigger and action types below are creatable by create_automation but are
NOT curated: there are no cards or examples. Each lists only the inputs you can fill — fields the
agent can't author are omitted from the node (they keep their defaults), so you won't see them
here:

- Provide every listed input as an expression, exactly like the supported nodes (see the Mental
  model section above) — the value-schema type tells you the expected shape.
- `select` / `multiSelect` inputs list their valid option keys inline (`one of: ...`).
- Inputs typed `dynamicSelect` / `dynamicMultiSelect` load their valid options at runtime from
  the external service. Call fetch_automation_input_data to list the option IDs
  for such an input (e.g. a Slack channel or Jira project). Ask the user for any other values
  you cannot infer.
- For nodes that require an external provider account, the catalog annotates
  `requires externalAccountId`. Call list_external_accounts to find a connected
  account and set `externalAccountId` on the node (works for both triggers and actions).
- Expect to iterate. If create_automation returns `isValid` false, use the
  per-node `errors` to correct the inputs and call again; after a couple of failed attempts,
  surface the errors to the user instead of looping.

A final section lists types that exist but are NOT creatable here (they require input the agent
can't supply). You can read them via get_automation, but to create one the user
must configure it in the Airtable UI.

## Triggers

### googleCalendarEventCreated (requires externalAccountId — Google Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  Output tokens: `{eventId: text, title: text, description: text, startTime: date, endTime: date, created: date, updated: date, location: text, attendees: array<text>, creator: text, status: text, eventType: text, hangoutLink: text, htmlLink: text}`

### googleCalendarEventChanged (requires externalAccountId — Google Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  Output tokens: `{eventId: text, title: text, description: text, startTime: date, endTime: date, created: date, updated: date, location: text, attendees: array<text>, creator: text, status: text, eventType: text, hangoutLink: text, htmlLink: text}`

### googleCalendarEventCancelled (requires externalAccountId — Google Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  Output tokens: `{eventId: text, title: text, description: text, startTime: date, endTime: date, created: date, updated: date, location: text, attendees: array<text>, creator: text, status: text, eventType: text, hangoutLink: text, htmlLink: text}`

### microsoftOutlookEventCreated (requires externalAccountId — Outlook Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  Output tokens: `{eventId: text, title: text, description: text, startTime: text, endTime: text, created: text, updated: text, location: text, attendees: array<text>, creator: object, importance: text, meetingLink: text, webLink: text}`

### microsoftOutlookEventChanged (requires externalAccountId — Outlook Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  Output tokens: `{eventId: text, title: text, description: text, startTime: text, endTime: text, created: text, updated: text, location: text, attendees: array<text>, creator: object, importance: text, meetingLink: text, webLink: text}`

### microsoftOutlookNewEmail (requires externalAccountId — Outlook Email; resolve via list_external_accounts)
  - folder (dynamicSelect, required)
  - isBodyFormatHtml (checkbox)
  Output tokens: `{emailId: text, subject: text, sender: object, toRecipients: array<text>, ccRecipients: array<text>, bccRecipients: array<text>, replyTo: array<text>, body: text, receivedDate: text, importance: text, webLink: text}`

### emailReceived
  - prefix (text)
  Output tokens: `{messageId: text, inReplyTo: text, subject: text, sender: {address: text, name: text, nameWithAddress: text}, toRecipients: array<{address: text, name: text, nameWithAddress: text}>, ccRecipients: array<{address: text, name: text, nameWithAddress: text}>, replyTo: array<{address: text, name: text, nameWithAddress: text}>, body: text, bodyHtml: text, receivedDate: text, attachments: array<{filename: text, contentType: text, expiringDownloadUrl: text}>}`

### inputReceivedFromConnection
  (not agent-editable)
  Output tokens: `{id: text, url: text, cellValuesByFieldId: object, actingUser: {originatingUserType: text, id: text, email: text, name: text, profilePicUrl: text}}`

### rowCommentCreated
  - tableId (airtableTableId, required)
  - commentScope (select (one of: topLevelOnly, topLevelAndReplies, repliesOnly))
  Output tokens: `{id: text, url: text, cellValuesByFieldId: object, comment: {text: text, authorUserId: text, authorName: text, authorEmail: text, createdTime: text, mentioned: array<object>, subscribers: array<object>, id: text, isReply: boolean, threadRootCommentId: text | null}}`

## Actions

### deleteRecord
  - tableId (airtableTableId, required)
  - rowId (text, required)
  Output tokens: `{id: text}`

### customScript
  (no agent-fillable inputs)
  Output tokens: dynamic (inferred from test output).

### aiGenerateImage
  - prompt (text, required)
  - tableId (airtableTableId, required)
  - rowId (text, required)
  - attachmentFields (airtableFields, required)
  - inputFidelity (select (one of: high, low))
  - numberOfOutputImages (number)
  - size (select (one of: auto, 1024x1024, 1536x1024, 1024x1536))
  - quality (select (one of: auto, high, medium, low))
  - outputFilename (text)
  - outputImageType (select (one of: image/png, image/jpeg, image/webp))
  Output tokens: `{id: text, url: text, cellValuesByFieldId: object}`

### sendToMsTeams (requires externalAccountId — Microsoft Teams; resolve via list_external_accounts)
  - msTeamsTeamId (dynamicSelect, required when applicable)
  - msTeamsChannelId (dynamicSelect, required when applicable)
  - messageContent (text, required when applicable)
  Output tokens: none.

### googleCalendarCreateEvent (requires externalAccountId — Google Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  - startDateTime (date, required)
  - endDateTime (date, required)
  - isAllDay (checkbox)
  - title (text)
  - description (text)
  - location (text)
  - attendeeEmails (array<text>)
  - disableEventNotifications (checkbox)
  - videoConferencing (dynamicSelect)
  - guestsCanModify (checkbox)
  - guestsCanInviteOthers (checkbox)
  - guestsCanSeeOtherGuests (checkbox)
  Output tokens: `{eventId: text}`

### googleCalendarUpdateEvent (requires externalAccountId — Google Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  - eventId (text, required)
  - disableEventNotifications (checkbox)
  Output tokens: none.

### atlassianJiraCreateIssue (requires externalAccountId — Jira Cloud; resolve via list_external_accounts)
  - siteId (dynamicSelect, required)
  - projectId (dynamicSelect, required)
  - issueTypeId (dynamicSelect, required)
  - summary (text, required)
  - description (text)
  - reporterUserId (dynamicSelect)
  - assigneeUserId (dynamicSelect)
  - status (dynamicSelect)
  - labels (array<text>)
  Output tokens: `{issueId: text, issueKey: text}`

### atlassianJiraUpdateIssue (requires externalAccountId — Jira Cloud; resolve via list_external_accounts)
  - siteId (dynamicSelect, required)
  - projectId (dynamicSelect, required)
  - issueIdOrKey (text, required)
  - issueTypeId (dynamicSelect)
  Output tokens: none.

### atlassianJiraServerCreateIssue (requires externalAccountId — Jira Data Center; resolve via list_external_accounts)
  - projectId (dynamicSelect, required)
  - issueTypeId (dynamicSelect, required)
  - summary (text, required)
  - description (text)
  - reporterUserId (dynamicSelect)
  - assigneeUserId (dynamicSelect)
  - status (dynamicSelect)
  - labels (array<text>)
  Output tokens: `{issueId: text, issueKey: text}`

### atlassianJiraServerUpdateIssue (requires externalAccountId — Jira Data Center; resolve via list_external_accounts)
  - projectId (dynamicSelect, required)
  - issueIdOrKey (text, required)
  - issueTypeId (dynamicSelect)
  Output tokens: none.

### azureDevOpsCreateWorkItem (requires externalAccountId — Azure DevOps; resolve via list_external_accounts)
  - organizationName (dynamicSelect, required)
  - project (dynamicSelect, required)
  - workItemType (dynamicSelect, required)
  Output tokens: `{id: text}`

### azureDevOpsUpdateWorkItem (requires externalAccountId — Azure DevOps; resolve via list_external_accounts)
  - organizationName (dynamicSelect, required)
  - project (dynamicSelect, required)
  - workItemType (dynamicSelect, required)
  - workItemId (text, required)
  Output tokens: `{id: text}`

### twitterPostTweet (requires externalAccountId — Twitter; resolve via list_external_accounts)
  - message (text, required)
  Output tokens: none.

### facebookPagesCreatePost (requires externalAccountId — Facebook Pages; resolve via list_external_accounts)
  - pageId (dynamicSelect, required)
  - message (text)
  - link (text)
  Output tokens: `{postId: text}`

### microsoftOutlookCreateEvent (requires externalAccountId — Outlook Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  - startDateTime (date, required)
  - endDateTime (date, required)
  - isAllDay (checkbox)
  - title (text)
  - description (text)
  - location (text)
  - attendeeEmails (array<text>)
  - videoConferencing (dynamicSelect)
  Output tokens: `{eventId: text}`

### microsoftOutlookUpdateEvent (requires externalAccountId — Outlook Calendar; resolve via list_external_accounts)
  - calendarId (dynamicSelect, required)
  - eventId (text, required)
  Output tokens: none.

### hootsuiteSchedulePost (requires externalAccountId — Hootsuite; resolve via list_external_accounts)
  - socialProfileIds (dynamicMultiSelect, required)
  - scheduledTime (date, required)
  - message (text)
  - tags (array<text>)
  Output tokens: `{postId: text, scheduledTime: text}`

### githubCreateIssue (requires externalAccountId — GitHub Issues; resolve via list_external_accounts)
  - repoId (dynamicSelect, required)
  - title (text, required)
  - body (text)
  - milestone (dynamicSelect)
  - labels (dynamicMultiSelect)
  - assignees (dynamicMultiSelect)
  Output tokens: `{issueNumber: number, issueLink: text}`

### githubUpdateIssue (requires externalAccountId — GitHub Issues; resolve via list_external_accounts)
  - repoId (dynamicSelect, required)
  - issueNumber (text, required)
  Output tokens: none.

### googleDocsCreateDoc (requires externalAccountId — Google Docs; resolve via list_external_accounts)
  - title (text, required)
  Output tokens: `{fileURL: text}`

## Triggers that only buttons create
You can't create these with create_automation. A button in an interface, or a button field for the single-record trigger, creates the automation. To change the steps of one, use update_automation and pass the trigger back unchanged: its inputs keep their current values.

### recordsReceivedFromConnection
  (not agent-editable)
  Output tokens: `{records: array<{id: text, url: text, cellValuesByFieldId: object}>, actingUser: {id: text, email: text, name: text}}`

## Exists but not creatable here
These types exist and can be read via get_automation, but cannot be created through MCP automation tools because they require input the agent cannot supply. To use one, the user must configure it in the Airtable UI.
Triggers: googleSheetsRowCreated, googleFormsNewResponse
Actions: slackSendActionableMessage, googleSheetsCreateRow, googleFormsCreateResponse, salesforceCreateRecord, salesforceUpdateRecord, googleDocsUpdateDoc
