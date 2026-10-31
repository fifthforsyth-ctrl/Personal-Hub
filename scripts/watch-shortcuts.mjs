#!/usr/bin/env node
//
// Writes the Apple Watch Shortcuts as .shortcut files (XML plists), ready
// to be signed on a Mac and opened in Shortcuts:
//
//   node scripts/watch-shortcuts.mjs <out-dir>
//   shortcuts sign --mode anyone --input <out-dir>/Hub.shortcut --output Hub-signed.shortcut
//
// iPhone only opens signed Shortcuts, and only macOS can sign them, so the
// files written here aren't usable until that step. Each asks for your
// watch address (More > On your watch) when it's added, so no key is in
// the file.
//
//   Hub       the menu: Win, Loss, Start/Switch/Stop timer, Task done, Note,
//             Today. A loop that does whatever the `watch` function says
//             next (see supabase/functions/watch/index.ts).
//   Win       the same loop, starting at Win: a one-tap complication.
//   Hub Wake  one call, { go: "woke" }, for the "Waking Up" automation.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const BASE = "https://bfednxteqhjljqdfdvsq.supabase.co/functions/v1/watch?key=";
const OBJ = "￼";

// --- A tiny plist writer -----------------------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function plist(v, pad = "") {
  const next = pad + "\t";
  if (v === true) return `${pad}<true/>`;
  if (v === false) return `${pad}<false/>`;
  if (typeof v === "number") return Number.isInteger(v) ? `${pad}<integer>${v}</integer>` : `${pad}<real>${v}</real>`;
  if (typeof v === "string") return `${pad}<string>${esc(v)}</string>`;
  if (Array.isArray(v)) return v.length ? `${pad}<array>\n${v.map((x) => plist(x, next)).join("\n")}\n${pad}</array>` : `${pad}<array/>`;
  const keys = Object.keys(v);
  if (!keys.length) return `${pad}<dict/>`;
  return `${pad}<dict>\n${keys.map((k) => `${next}<key>${esc(k)}</key>\n${plist(v[k], next)}`).join("\n")}\n${pad}</dict>`;
}
const doc = (v) => `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n${plist(v)}\n</plist>\n`;

// --- Shortcuts' building blocks ----------------------------------------------------------------

const uuid = () => randomUUID().toUpperCase();
const act = (id, params = {}) => ({ WFWorkflowActionIdentifier: `is.workflow.actions.${id}`, WFWorkflowActionParameters: params });
const output = (name, from) => ({ OutputName: name, OutputUUID: from, Type: "ActionOutput" });
const variable = (name) => ({ Type: "Variable", VariableName: name });
const attach = (ref) => ({ Value: ref, WFSerializationType: "WFTextTokenAttachment" });
const tokens = (ref) => ({ Value: { string: OBJ, attachmentsByRange: { "{0, 1}": ref } }, WFSerializationType: "WFTextTokenString" });
const plain = (s) => ({ Value: { string: s, attachmentsByRange: {} }, WFSerializationType: "WFTextTokenString" });
const field = (key, value) => ({ WFItemType: 0, WFKey: plain(key), WFValue: value });
const jsonBody = (items) => ({ Value: { WFDictionaryFieldValueItems: items }, WFSerializationType: "WFDictionaryFieldValue" });

function text(value) {
  const id = uuid();
  return { id, action: act("gettext", { UUID: id, WFTextActionText: value }) };
}
const setVar = (name, ref) => act("setvariable", { WFVariableName: name, WFInput: attach(ref) });
function dictValue(key, from) {
  const id = uuid();
  return { id, action: act("getvalueforkey", { UUID: id, WFGetDictionaryValueType: "Value", WFDictionaryKey: key, WFInput: attach(output("Contents of URL", from)) }) };
}
function post(items) {
  const id = uuid();
  return {
    id,
    action: act("downloadurl", {
      UUID: id,
      WFURL: BASE,
      WFHTTPMethod: "POST",
      WFHTTPBodyType: "JSON",
      ShowHeaders: false,
      WFJSONValues: jsonBody(items),
    }),
  };
}
// If <variable> is <text> … [Otherwise …] End If. WFCondition 4 is "is".
function ifIs(name, value, then, otherwise = null) {
  const g = uuid();
  return [
    act("conditional", { GroupingIdentifier: g, WFControlFlowMode: 0, WFCondition: 4, WFConditionalActionString: value, WFInput: { Type: "Variable", Variable: attach(variable(name)) } }),
    ...then,
    ...(otherwise ? [act("conditional", { GroupingIdentifier: g, WFControlFlowMode: 1 }), ...otherwise] : []),
    act("conditional", { GroupingIdentifier: g, WFControlFlowMode: 2, UUID: uuid() }),
  ];
}
function repeat(times, body) {
  const g = uuid();
  return [act("repeat.count", { GroupingIdentifier: g, WFControlFlowMode: 0, WFRepeatCount: times }), ...body, act("repeat.count", { GroupingIdentifier: g, WFControlFlowMode: 2, UUID: uuid() })];
}

const INPUT_CLASSES = [
  "WFAppStoreAppContentItem",
  "WFArticleContentItem",
  "WFContactContentItem",
  "WFDateContentItem",
  "WFEmailAddressContentItem",
  "WFGenericFileContentItem",
  "WFImageContentItem",
  "WFiTunesProductContentItem",
  "WFLocationContentItem",
  "WFDCMapsLinkContentItem",
  "WFAVAssetContentItem",
  "WFPDFContentItem",
  "WFPhoneNumberContentItem",
  "WFRichTextContentItem",
  "WFSafariWebPageContentItem",
  "WFStringContentItem",
  "WFURLContentItem",
];

function shortcut(actions, { watch, glyph, color }) {
  const at = actions.findIndex((a) => a.WFWorkflowActionIdentifier === "is.workflow.actions.downloadurl");
  return {
    WFWorkflowClientVersion: "2302.0.4",
    WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: "900",
    WFWorkflowIcon: { WFWorkflowIconStartColor: color, WFWorkflowIconGlyphNumber: glyph },
    WFWorkflowImportQuestions: [
      {
        ActionIndex: at,
        Category: "Parameter",
        ParameterKey: "WFURL",
        DefaultValue: BASE,
        Text: "Paste your watch address from the Hub (More, On your watch).",
      },
    ],
    WFWorkflowTypes: watch ? ["WatchKit"] : [],
    WFWorkflowInputContentItemClasses: INPUT_CLASSES,
    WFWorkflowOutputContentItemClasses: [],
    WFWorkflowHasOutputFallback: false,
    WFWorkflowHasShortcutInputVariables: false,
    WFQuickActionSurfaces: [],
    WFWorkflowActions: actions,
  };
}

// The loop: send { step, answer }, then show a list, ask, or finish.
function hubActions(startAt) {
  const first = text(startAt);
  const blank = text("");
  const req = post([field("step", tokens(variable("Step"))), field("answer", tokens(variable("Answer")))]);
  const kind = dictValue("kind", req.id);
  const say = dictValue("say", req.id);
  const step = dictValue("step", req.id);
  const prompt = dictValue("prompt", req.id);
  const options = dictValue("options", req.id);
  const choose = uuid();
  const ask = uuid();
  return [
    first.action,
    setVar("Step", output("Text", first.id)),
    blank.action,
    setVar("Answer", output("Text", blank.id)),
    ...repeat(6, [
      req.action,
      kind.action,
      setVar("Kind", output("Dictionary Value", kind.id)),
      ...ifIs("Kind", "done", [say.action, act("showresult", { Text: tokens(output("Dictionary Value", say.id)) }), act("exit")]),
      step.action,
      setVar("Step", output("Dictionary Value", step.id)),
      prompt.action,
      setVar("Prompt", output("Dictionary Value", prompt.id)),
      ...ifIs(
        "Kind",
        "list",
        [
          options.action,
          act("choosefromlist", { UUID: choose, WFInput: attach(output("Dictionary Value", options.id)), WFChooseFromListActionPrompt: tokens(variable("Prompt")) }),
          setVar("Answer", output("Chosen Item", choose)),
        ],
        [act("ask", { UUID: ask, WFInputType: "Text", WFAskActionPrompt: tokens(variable("Prompt")) }), setVar("Answer", output("Provided Input", ask))]
      ),
    ]),
  ];
}

function wakeActions() {
  return [post([field("go", plain("woke"))]).action];
}

export function watchShortcuts() {
  return {
    "Hub.shortcut": doc(shortcut(hubActions(""), { watch: true, glyph: 59511, color: 4251333119 })),
    "Win.shortcut": doc(shortcut(hubActions("win"), { watch: true, glyph: 59446, color: 4271458815 })),
    "Hub Wake.shortcut": doc(shortcut(wakeActions(), { watch: false, glyph: 59777, color: 463140863 })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2];
  if (!out) {
    console.error("Usage: node scripts/watch-shortcuts.mjs <out-dir>");
    process.exit(1);
  }
  mkdirSync(out, { recursive: true });
  for (const [name, xml] of Object.entries(watchShortcuts())) {
    writeFileSync(join(out, name), xml);
    console.log(`wrote ${join(out, name)}`);
  }
}
