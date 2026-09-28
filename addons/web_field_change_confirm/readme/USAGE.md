To use this module, you need to:

1. Open a record whose form view has a field with `confirm_change`.
2. Change that field.
3. Save the record in any way: the Save button, the breadcrumb or a menu, the pager, the
   New button, an action button or the status bar.

Before the save, a dialog lists each of these fields whose value changed, with its value
before and after the change. Binary, HTML, JSON and properties fields show "Modified"
instead of their values.

- **Save** saves the record, then does what you asked for, such as opening the next
  record.
- **Keep editing**, the × button and Escape cancel the save. You stay on the record, and
  your changes remain on the form without being saved.

The dialog also lists a field that an onchange changed after you edited another field.

## Automatic saves

Odoo also saves the form in two cases where the dialog can't wait for an answer:

- When you switch to another browser tab. If one of these fields changed, Odoo doesn't
  save, and the dialog opens at the next save, for example when you leave the record.
- When you close or reload the browser tab. If one of these fields changed, Odoo doesn't
  save and the browser asks whether you want to leave the page. Otherwise Odoo saves the
  form as usual.

## Cases without a dialog

- A new record, because there's no previous value.
- A field set back to its saved value.
- A value that the server computes during the save. The dialog only compares the values
  on the form.
