- Only form views ask for confirmation. Inline editing in a list view and drag and drop
  in a kanban view save without a dialog.
- The attribute has no effect on one2many and many2many fields, because the dialog can't
  show a list of lines before and after the change.
- A line of a one2many or many2many field opened in its own dialog is saved with its
  parent record, without confirmation.
- The dialog is a check for the user, not a security feature. Imports, RPC calls and
  server actions write without it. Use constraints or access rights on the server for
  rules that must always apply.
