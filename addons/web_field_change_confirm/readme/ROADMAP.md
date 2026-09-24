- The attribute is ignored on one2many and many2many fields: their lines have no
  readable before and after value.
- Form views only. Inline edits in list views and kanban drag and drop save without
  confirmation.
- Records opened from a one2many or many2many line (the line's own dialog) are saved
  with their parent and do not ask.
- The dialog is a guard against inattention, not an access control: imports, RPC calls
  and server actions write without it. Enforce hard business rules on the server.
