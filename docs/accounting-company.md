# Company accounting and hauling equipment

Dashboard totals, financial reports, load accounting filters, and per-load invoices belong to the carrier named on the load. A DC load stays with DC even when an RD truck moves it. Fleet, truck, trailer, driver, maintenance, and IFTA assignments continue to describe the operation.

The database derives `loads.accounting_company` from `carrier_company`. It preserves the original carrier text and normalizes known historical names:

| Carrier text | Accounting company |
| --- | --- |
| DC GEMS CORP / DC | DC |
| RD FREIGH / RD FREIGHT LOGISTICS / RD | RD |
| J S / JS | JS |

Other names are trimmed and uppercased. Missing or blank carriers remain Unassigned; they never inherit the truck's fleet. Correcting the carrier automatically recalculates its accounting company. Company choices include carriers without equipment records.

Financial pages use `?company=DC`. Existing `?fleet=DC` bookmarks on dashboard, reports, and invoices resolve to the carrier selection. The operational dispatch, maintenance, IFTA, and equipment filters keep their fleet meaning. The load list and detailed load CSV can additionally accept an explicit operational fleet filter.

Accounting exports retain hauling details where appropriate. Bookkeeping downloads launched from Reports use `basis=carrier`: load-linked expenses follow the carrier, and equipment-only expenses retain the equipment company. The Bookkeeping screen's existing equipment filters remain available. Maintenance exports always describe the equipment fleet.

Invoices remain one record per load, with their accounting company inherited from the load. Combined multi-load invoices are outside this release.

## Deployment and verification

Apply migration 040 before releasing the application. It adds a generated column, a tenant/company index, and a column on the security-invoker load-list view. Existing carrier and equipment values are preserved; the prior application remains compatible with the added fields.

The SQL tests cover aliases, missing carriers, both crossover directions, carrier corrections, equipment reassignment, totals, and tenant isolation. Browser tests use fictional local-only crossover loads to verify dashboard totals, load navigation, reports, CSV/PDF exports, invoice choices, and invoice creation. Application tests also check complete reads beyond the API row limit.
