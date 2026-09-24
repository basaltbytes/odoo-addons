Edit a flagged field on a form, then save it in any way: the Save button, the breadcrumb
or a menu, the pager, the "New" button, an action button, or a click on the status bar.
A dialog lists every flagged field whose value is about to change, with the value before
and after:

- **Save** saves the record and carries on (for example, follows the breadcrumb).
- **Back to the form**, the × button or Escape cancels the save. The changes stay on the
  form, unsaved, and you remain on the record.

Changes made by Odoo itself count too: if editing one field makes an onchange rewrite a
flagged one, the dialog lists the flagged field.

## Automatic saves without a dialog

- **Switching browser tabs** normally saves the form. When a flagged field changed,
  nothing is saved; the dialog appears when you leave the record.
- **Closing or reloading the tab** cannot show a dialog. When a flagged field changed,
  nothing is saved and the browser asks whether to leave the page. Other changes are
  saved as usual.

## What is not asked

- Creating a record: there is no previous value.
- A field set back to its saved value.
- Values computed by the server while saving: the dialog only knows what the form holds
  before the save.
