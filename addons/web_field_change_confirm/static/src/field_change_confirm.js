/** @odoo-module */

import {_t} from "@web/core/l10n/translation";
import {evaluateBooleanExpr} from "@web/core/py_js/py";
import {registry} from "@web/core/registry";

// Form-field attribute holding a Python expression, evaluated like `readonly`.
// Mirrored in models/ir_ui_view.py, which validates it and adds the fields it reads.
export const CONFIRM_CHANGE_ATTR = "confirm_change";

// A before/after pair of lines cannot be shown readably for these types: the
// attribute is ignored on them.
const UNSUPPORTED_TYPES = new Set(["one2many", "many2many"]);
// These have a value but no short rendering: the dialog only says they changed.
const OPAQUE_TYPES = new Set([
    "binary",
    "html",
    "json",
    "properties",
    "properties_definition",
]);

/**
 * @typedef {Object} FieldNode
 * @property {string} name
 * @property {string} [string]
 * @property {string} type
 * @property {Record<string, string>} attrs
 */

/**
 * @typedef {Object} RiskyChange
 * @property {string} name
 * @property {string} label
 * @property {string | null} before Formatted previous value; null for opaque types.
 * @property {string | null} after Formatted new value; null for opaque types.
 */

/**
 * Keep the form's field nodes that carry the attribute on a supported field type.
 *
 * @param {Record<string, FieldNode>} fieldNodes `archInfo.fieldNodes` of a form view
 * @returns {FieldNode[]}
 */
export function getConfirmChangeNodes(fieldNodes) {
    return Object.values(fieldNodes).filter(
        (node) => node.attrs[CONFIRM_CHANGE_ATTR] && !UNSUPPORTED_TYPES.has(node.type)
    );
}

/**
 * Reduce a field value to something comparable with `===`.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function toComparable(value) {
    if (value && typeof value === "object") {
        if ("toMillis" in value && typeof value.toMillis === "function") {
            return value.toMillis();
        }
        if ("id" in value) {
            return value.id;
        }
        return JSON.stringify(value);
    }
    return value;
}

/**
 * Format one value of `data` the way Odoo displays it in a read-only cell.
 *
 * @param {any} record
 * @param {FieldNode} node
 * @param {Record<string, any>} data the record's saved values or its current ones
 * @returns {string}
 */
function formatValue(record, node, data) {
    const field = record.fields[node.name];
    const value = data[node.name];
    if (field.type === "boolean") {
        return value ? _t("Yes") : _t("No");
    }
    const formatter = registry.category("formatters").get(field.type, null);
    if (!formatter) {
        return value ? String(value) : "";
    }
    const options = {...formatter.extractOptions?.(node), data, field};
    return String(formatter(value, options) ?? "");
}

/**
 * List the changes about to be saved on fields whose `confirm_change` expression
 * is true for the record's current values. A field set back to its saved value is
 * not a change.
 *
 * @param {any} record the form's root record
 * @param {FieldNode[]} nodes result of getConfirmChangeNodes()
 * @param {Iterable<string>} changedFieldNames fields the save will write
 * @returns {RiskyChange[]}
 */
export function collectRiskyChanges(record, nodes, changedFieldNames) {
    const changed = new Set(changedFieldNames);
    /** @type {Map<string, RiskyChange>} */
    const riskyChanges = new Map();
    for (const node of nodes) {
        const {name} = node;
        if (riskyChanges.has(name) || !changed.has(name)) {
            continue;
        }
        const expr = node.attrs[CONFIRM_CHANGE_ATTR];
        if (!evaluateBooleanExpr(expr, record.evalContextWithVirtualIds)) {
            continue;
        }
        // `_values` holds the last values read from the server. It is private, but
        // it is the only place the web client keeps them; Odoo's own
        // account.CurrencyFormController reads it the same way.
        const saved = record._values;
        if (toComparable(saved[name]) === toComparable(record.data[name])) {
            continue;
        }
        const field = record.fields[name];
        const opaque = OPAQUE_TYPES.has(field.type);
        riskyChanges.set(name, {
            name,
            label: node.string || field.string,
            before: opaque ? null : formatValue(record, node, saved),
            after: opaque ? null : formatValue(record, node, record.data),
        });
    }
    return [...riskyChanges.values()];
}
