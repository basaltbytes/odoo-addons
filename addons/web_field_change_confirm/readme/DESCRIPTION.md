Odoo saves a form without asking when you leave it, open the next record, click an
action button or a status, or switch to another browser tab. A change to a field such as
the customer of an order can get saved without anyone noticing, for example when an
onchange rewrites it after the user edits another field.

This module adds a `confirm_change` attribute for fields in form views. Before a save
that changes one of these fields, Odoo opens a dialog with the old and new value of each
of them, and the user chooses to save or to keep editing.

Forms that don't use the attribute work as in standard Odoo.
