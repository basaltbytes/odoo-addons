/** @odoo-module */

import {toRaw} from "@odoo/owl";
import {FormController} from "@web/views/form/form_controller";
import {patch} from "@web/core/utils/patch";
import {collectRiskyChanges, getConfirmChangeNodes} from "./field_change_confirm";
import {FieldChangeConfirmDialog} from "./field_change_confirm_dialog";

// Every save of a form record (Save button, breadcrumb, menu, pager, "New", action
// buttons, statusbar clicks, autosave on tab hide) runs Record._save(), which asks
// the controller's onWillSaveRecord() hook first: returning false cancels the save
// and keeps the user on the record. Forms without the attribute are left untouched.
patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.confirmChangeNodes = getConfirmChangeNodes(this.archInfo.fieldNodes);
    },

    async onWillSaveRecord(record, changes) {
        const proceed = await super.onWillSaveRecord(...arguments);
        if (
            proceed === false ||
            !this.confirmChangeNodes.length ||
            // The controller reads the root through a reactive proxy; fields such as
            // the statusbar hand over another view of the same record.
            toRaw(record) !== toRaw(this.model.root) ||
            record.isNew
        ) {
            return proceed;
        }
        const riskyChanges = collectRiskyChanges(
            record,
            this.confirmChangeNodes,
            Object.keys(changes)
        );
        if (!riskyChanges.length) {
            return proceed;
        }
        // An autosave while the tab is hidden has nobody to ask: keep the changes
        // pending; the user is asked when leaving the record.
        if (document.visibilityState === "hidden") {
            return false;
        }
        return this.confirmRiskyChanges(riskyChanges);
    },

    /**
     * @param {import("./field_change_confirm").RiskyChange[]} riskyChanges
     * @returns {Promise<boolean>} whether the user chose to save
     */
    confirmRiskyChanges(riskyChanges) {
        return new Promise((resolve) => {
            this.dialogService.add(
                FieldChangeConfirmDialog,
                {
                    changes: riskyChanges,
                    confirm: () => resolve(true),
                    cancel: () => resolve(false),
                },
                // Closing the dialog any other way (Escape, the × button) cancels.
                {onClose: () => resolve(false)}
            );
        });
    },

    // Closing or reloading the tab saves urgently through sendBeacon, which runs
    // before onWillSaveRecord() and cannot wait for a dialog. With a risky change
    // pending, save nothing and let the browser ask "Leave site?" instead.
    async beforeUnload(ev) {
        if (this.confirmChangeNodes.length && this.hasPendingRiskyChanges()) {
            ev.preventDefault();
            ev.returnValue = "";
            return;
        }
        return super.beforeUnload(ev);
    },

    /**
     * Whether leaving now would save a risky change, including one still being
     * typed in an input. Must stay synchronous: it runs in a beforeunload handler.
     *
     * @returns {boolean}
     */
    hasPendingRiskyChanges() {
        const record = this.model.root;
        if (record.isNew) {
            return false;
        }
        // Commit values still pending in inputs, exactly as Record.urgentSave()
        // does: the urgent flag makes the field updates apply synchronously and
        // skip onchanges.
        this.model._urgentSave = true;
        this.model.bus.trigger("WILL_SAVE_URGENTLY");
        this.model._urgentSave = false;
        const changedFieldNames = Object.keys(record._getChanges());
        return (
            collectRiskyChanges(record, this.confirmChangeNodes, changedFieldNames)
                .length > 0
        );
    },
});
