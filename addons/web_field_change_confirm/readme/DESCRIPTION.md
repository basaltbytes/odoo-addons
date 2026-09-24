Odoo saves a form on its own: when you leave it through the breadcrumb or a menu, move
to the next record, click a button or a status, or switch browser tabs. That is handy,
until a change to an important field (a customer, a price, a stage) is saved without
anyone noticing it, sometimes because an onchange rewrote it after another edit.

This module lets a view flag such fields. Before any save that changes one of them, the
user sees a confirmation dialog listing each flagged field with its value before and
after the change, and chooses between saving and going back to the form.

Fields without the flag, and forms without any flagged field, keep Odoo's standard
behavior.
