/** @odoo-module */

import {Component} from "@odoo/owl";
import {Dialog} from "@web/core/dialog/dialog";

/**
 * Lists the sensitive fields a save is about to change, each with its previous and
 * new value, and lets the user save or go back to the form.
 */
export class FieldChangeConfirmDialog extends Component {
    static template = "web_field_change_confirm.FieldChangeConfirmDialog";
    static components = {Dialog};
    static props = {
        changes: Array,
        confirm: Function,
        cancel: Function,
        close: Function,
    };

    onConfirm() {
        this.props.confirm();
        this.props.close();
    }

    onCancel() {
        this.props.cancel();
        this.props.close();
    }
}
