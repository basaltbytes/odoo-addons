import {describe, expect, test} from "@odoo/hoot";
import {unload} from "@odoo/hoot-dom";
import {animationFrame, mockSendBeacon} from "@odoo/hoot-mock";
import {
    contains,
    defineActions,
    defineModels,
    fields,
    getService,
    hideTab,
    models,
    mountView,
    mountWithCleanup,
    onRpc,
} from "@web/../tests/web_test_helpers";
import {WebClient} from "@web/webclient/webclient";

describe.current.tags("desktop");

class Partner extends models.Model {
    name = fields.Char();
    city = fields.Char();
    state = fields.Selection({
        selection: [
            ["draft", "Draft"],
            ["confirmed", "Confirmed"],
        ],
        default: "draft",
    });
    manager_id = fields.Many2one({relation: "manager"});
    _records = [
        {id: 1, name: "Xavier Lancer", city: "Lyon", state: "draft", manager_id: 1},
        {id: 2, name: "Keth MacBeat", city: "Paris", state: "confirmed", manager_id: 2},
    ];
}

class Manager extends models.Model {
    name = fields.Char();
    _records = [
        {id: 1, name: "Alice"},
        {id: 2, name: "Bob"},
    ];
}

defineModels([Partner, Manager]);

const ARCH = /* xml */ `
    <form>
        <header>
            <field name="state" widget="statusbar" options="{'clickable': '1'}" confirm_change="1"/>
        </header>
        <field name="name" confirm_change="1"/>
        <field name="city"/>
        <field name="manager_id" confirm_change="1"/>
    </form>
`;

const DIALOG_ROWS = ".o_field_change_confirm_table tbody tr";

function stepOnSave() {
    onRpc("web_save", () => {
        expect.step("web_save");
    });
}

function mountPartnerForm(params = {}) {
    return mountView({
        type: "form",
        resModel: "partner",
        resId: 1,
        arch: ARCH,
        ...params,
    });
}

test("saving a risky change shows it with its before and after values", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(1);
    expect("tr[data-field='name'] td:first").toHaveText("Name");
    expect("tr[data-field='name'] .o_field_change_confirm_before").toHaveText(
        "Xavier Lancer"
    );
    expect("tr[data-field='name'] .o_field_change_confirm_after").toHaveText("Yvonne");
    expect.verifySteps([]);

    await contains(".o_field_change_confirm_save").click();
    expect.verifySteps(["web_save"]);
    expect(DIALOG_ROWS).toHaveCount(0);
    expect(".o_form_status_indicator_buttons:not(.invisible)").toHaveCount(0);
});

test("going back to the form keeps the change, unsaved", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();
    await contains(".o_field_change_confirm_back").click();

    expect.verifySteps([]);
    expect(DIALOG_ROWS).toHaveCount(0);
    expect(".o_field_widget[name='name'] input").toHaveValue("Yvonne");
    expect(".o_form_status_indicator_buttons:not(.invisible)").toHaveCount(1);
});

test("closing the dialog cancels the save", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();
    await contains(".modal-header .btn-close").click();

    expect.verifySteps([]);
    expect(".o_field_widget[name='name'] input").toHaveValue("Yvonne");
});

test("a change to a field without the attribute saves directly", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='city'] input").edit("Grenoble");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(0);
    expect.verifySteps(["web_save"]);
});

test("a form without the attribute saves as usual", async () => {
    stepOnSave();
    await mountPartnerForm({arch: `<form><field name="name"/></form>`});
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(0);
    expect.verifySteps(["web_save"]);
});

test("the expression is evaluated on the record, like readonly", async () => {
    stepOnSave();
    await mountPartnerForm({
        arch: `<form><field name="state"/><field name="name" confirm_change="state == 'confirmed'"/></form>`,
    });
    // Record 1 is a draft: no confirmation.
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();
    expect(DIALOG_ROWS).toHaveCount(0);
    expect.verifySteps(["web_save"]);
});

test("the expression gates confirmed records", async () => {
    stepOnSave();
    await mountPartnerForm({
        resId: 2,
        arch: `<form><field name="state"/><field name="name" confirm_change="state == 'confirmed'"/></form>`,
    });
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();
    expect(DIALOG_ROWS).toHaveCount(1);
    expect.verifySteps([]);
});

test("a value set back to the saved one is not a change", async () => {
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_field_widget[name='name'] input").edit("Xavier Lancer");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(0);
});

test("a risky change made by an onchange is listed, by display name", async () => {
    Partner._onChanges = {
        city(record) {
            record.manager_id = 2;
        },
    };
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='city'] input").edit("Grenoble");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(1);
    expect("tr[data-field='manager_id'] .o_field_change_confirm_before").toHaveText(
        "Alice"
    );
    expect("tr[data-field='manager_id'] .o_field_change_confirm_after").toHaveText(
        "Bob"
    );
    expect.verifySteps([]);
});

test("creating a record asks nothing", async () => {
    stepOnSave();
    await mountPartnerForm({resId: undefined});
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_form_button_save").click();

    expect(DIALOG_ROWS).toHaveCount(0);
    expect.verifySteps(["web_save"]);
});

test("a statusbar click on a risky field asks first, with selection labels", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_statusbar_status button[data-value='confirmed']").click();

    expect("tr[data-field='state'] .o_field_change_confirm_before").toHaveText("Draft");
    expect("tr[data-field='state'] .o_field_change_confirm_after").toHaveText(
        "Confirmed"
    );
    expect.verifySteps([]);

    await contains(".o_field_change_confirm_save").click();
    expect.verifySteps(["web_save"]);
});

test("going back on a pager move stays on the record", async () => {
    stepOnSave();
    await mountPartnerForm({resIds: [1, 2]});
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await contains(".o_pager_next").click();
    expect(DIALOG_ROWS).toHaveCount(1);

    await contains(".o_field_change_confirm_back").click();
    expect.verifySteps([]);
    expect(".o_pager_value").toHaveText("1");
    expect(".o_field_widget[name='name'] input").toHaveValue("Yvonne");
});

test("leaving by the breadcrumb waits for the confirmation", async () => {
    onRpc("has_group", () => true);
    stepOnSave();
    defineActions([
        {
            id: 1,
            name: "Partners",
            res_model: "partner",
            views: [
                [false, "list"],
                [false, "form"],
            ],
        },
    ]);
    Partner._views = {list: `<list><field name="name"/></list>`, form: ARCH};

    await mountWithCleanup(WebClient);
    await getService("action").doAction(1);
    await contains(".o_data_row td.o_data_cell").click();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");

    await contains(".breadcrumb-item.o_back_button").click();
    await contains(".o_field_change_confirm_back").click();
    expect.verifySteps([]);
    expect(".o_form_view").toHaveCount(1);

    await contains(".breadcrumb-item.o_back_button").click();
    await contains(".o_field_change_confirm_save").click();
    expect.verifySteps(["web_save"]);
    expect(".o_list_view").toHaveCount(1);
    expect(".o_data_row:first .o_data_cell").toHaveText("Yvonne");
});

test("hiding the tab does not autosave a risky change", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");
    await hideTab();

    expect.verifySteps([]);
    expect(DIALOG_ROWS).toHaveCount(0);
    expect(".o_field_widget[name='name'] input").toHaveValue("Yvonne");
});

test("hiding the tab still autosaves other changes", async () => {
    stepOnSave();
    await mountPartnerForm();
    await contains(".o_field_widget[name='city'] input").edit("Grenoble");
    await hideTab();

    expect.verifySteps(["web_save"]);
});

test("closing the tab with a risky change saves nothing and lets the browser ask", async () => {
    mockSendBeacon(() => {
        expect.step("sendBeacon");
        return true;
    });
    await mountPartnerForm();
    await contains(".o_field_widget[name='name'] input").edit("Yvonne");

    const [event] = await unload();
    await animationFrame();
    expect(event.defaultPrevented).toBe(true);
    expect.verifySteps([]);
});

test("closing the tab while typing a risky value saves nothing", async () => {
    mockSendBeacon(() => {
        expect.step("sendBeacon");
        return true;
    });
    await mountPartnerForm();
    // Not confirmed: the value is still only in the input when the tab closes.
    await contains(".o_field_widget[name='name'] input").edit("Yvonne", {
        confirm: false,
    });

    const [event] = await unload();
    await animationFrame();
    expect(event.defaultPrevented).toBe(true);
    expect.verifySteps([]);
});

test("closing the tab with other changes still saves them urgently", async () => {
    mockSendBeacon(() => {
        expect.step("sendBeacon");
        return true;
    });
    await mountPartnerForm();
    await contains(".o_field_widget[name='city'] input").edit("Grenoble");

    const [event] = await unload();
    await animationFrame();
    expect(event.defaultPrevented).toBe(false);
    expect.verifySteps(["sendBeacon"]);
});
