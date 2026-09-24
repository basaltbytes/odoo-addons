Add the `confirm_change` attribute to a `<field>` of a form view. Its value is a Python
expression, evaluated on the record like `readonly` or `invisible`:

```xml
<!-- Always ask -->
<field name="partner_id" confirm_change="1"/>

<!-- Ask only once the order is confirmed -->
<field name="partner_id" confirm_change="state in ('sale', 'done')"/>
```

On an existing view, set it through inheritance:

```xml
<xpath expr="//field[@name='partner_id']" position="attributes">
    <attribute name="confirm_change">state in ('sale', 'done')</attribute>
</xpath>
```

Fields read by the expression are added to the view automatically when missing, and an
invalid expression is rejected when the view is saved, as for `readonly`.
