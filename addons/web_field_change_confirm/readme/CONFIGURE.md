Add the `confirm_change` attribute to a field of a form view. Its value is a Python
expression, like `readonly`. The dialog opens only when the expression is true.

```xml
<!-- Always ask -->
<field name="partner_id" confirm_change="1"/>

<!-- Ask only on confirmed orders -->
<field name="partner_id" confirm_change="state == 'sale'"/>
```

In an inherited view:

```xml
<xpath expr="//field[@name='partner_id']" position="attributes">
    <attribute name="confirm_change">state == 'sale'</attribute>
</xpath>
```
