/** @odoo-module */

import {expect, test} from "@odoo/hoot";
import {session} from "@web/session";

test("module test harness boots a module-scoped suite", () => {
    expect(window.location.pathname).toBe("/web/module_tests/web_module_test_harness");
    expect(Boolean(session.view_info)).toBe(true);
});
