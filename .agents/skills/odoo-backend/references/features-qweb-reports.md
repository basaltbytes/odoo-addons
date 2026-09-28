---
name: features-qweb-reports
description: QWeb HTML/PDF reports, translation patterns, custom `_get_report_values`, paper formats, and the asset rules that make report styling actually render.
---

# QWeb Reports

Use this for report details that regularly break output: `report_name`, translation rebrowse, custom context, and report assets.

## Minimal report flow

You need an `ir.actions.report` and a QWeb template whose external ID matches `report_name`.

```xml
<template id="report_business_trip">
    <t t-call="web.html_container">
        <t t-foreach="docs" t-as="o">
            <t t-call="web.external_layout">
                <div class="page">
                    <h2>Business Trip</h2>
                    <p><span t-field="o.name"/></p>
                </div>
            </t>
        </t>
    </t>
</template>
```

```xml
<record id="action_report_business_trip" model="ir.actions.report">
    <field name="name">Business Trip</field>
    <field name="model">business.trip</field>
    <field name="report_type">qweb-pdf</field>
    <field name="report_name">my_module.report_business_trip</field>
    <field name="binding_model_id" ref="model_business_trip"/>
</record>
```

## Translation

Use a main template plus a translatable sub-template and set `t-lang` on the `t-call`.

```xml
<template id="report_business_trip_main">
    <t t-call="web.html_container">
        <t t-foreach="docs" t-as="doc">
            <t t-call="my_module.report_business_trip_document" t-lang="doc.partner_id.lang"/>
        </t>
    </t>
</template>
```

If you need translatable fields, re-browse in the target language inside the translatable template:

```xml
<t t-set="doc" t-value="doc.with_context(lang=doc.partner_id.lang)"/>
```

Do not re-browse in another language unless you actually need translated fields.

## Custom report models

Once you customize `_get_report_values`, `doc_ids`, `doc_model`, and `docs` are not injected automatically. Add them yourself if the template expects them.

```python
from odoo import models


class ReportBusinessTrip(models.AbstractModel):
    _name = "report.my_module.report_business_trip"

    def _get_report_values(self, docids, data=None):
        docs = self.env["business.trip"].browse(docids)
        return {
            "doc_ids": docids,
            "doc_model": "business.trip",
            "docs": docs,
            "lines": docs.mapped("expense_ids"),
        }
```

## Paper formats

Use `report.paperformat` when the company default format is wrong.

## Report assets and fonts

Custom fonts must be loaded through `web.report_assets_common`, not backend/common web bundles.

```xml
<template id="report_assets_common_custom_fonts" inherit_id="web.report_assets_common">
    <xpath expr="." position="inside">
        <link href="/my_module/static/src/less/fonts.less" rel="stylesheet" type="text/less"/>
    </xpath>
</template>
```

## Reports are URL-addressable

Use `/report/html/<report_name>/<id>` before `/report/pdf/<report_name>/<id>` when debugging; HTML isolates template issues from PDF conversion issues.
