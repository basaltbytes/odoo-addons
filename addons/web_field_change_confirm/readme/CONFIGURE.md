Add `confirm_change` to a `<field>` of a form view. The value is a Python expression,
like the value of `readonly` or `invisible`. Odoo evaluates it with the values on the
form at the moment the user saves, and asks for confirmation only if it's true.

```xml
<!-- Always ask -->
<field name="partner_id" confirm_change="1"/>

<!-- Ask only on confirmed orders -->
<field name="partner_id" confirm_change="state == 'sale'"/>
```

To set it on a field of an existing view, inherit the view:

```xml
<xpath expr="//field[@name='partner_id']" position="attributes">
    <attribute name="confirm_change">state == 'sale'</attribute>
</xpath>
```

Odoo checks the expression when it saves the view and rejects an invalid one. If the
expression uses a field that isn't in the view, Odoo adds that field to the view as an
invisible field.
