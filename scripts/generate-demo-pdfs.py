#!/usr/bin/env python3
"""Generate the fictional PDFs referenced by the Supabase demo seed."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
LOAD_ID = "14000000-0000-4000-8000-000000000001"

NAVY = colors.HexColor("#172554")
BLUE = colors.HexColor("#2563EB")
PALE = colors.HexColor("#EFF6FF")
INK = colors.HexColor("#18181B")
MUTED = colors.HexColor("#71717A")
LINE = colors.HexColor("#D4D4D8")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Brand", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=NAVY, spaceAfter=2))
styles.add(ParagraphStyle(name="DocType", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=BLUE, spaceAfter=14))
styles.add(ParagraphStyle(name="SmallMuted", parent=styles["Normal"], fontName="Helvetica", fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="Label", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=MUTED))
styles.add(ParagraphStyle(name="Value", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14, textColor=INK))
styles.add(ParagraphStyle(name="Right", parent=styles["Value"], alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="CenterSmall", parent=styles["SmallMuted"], alignment=TA_CENTER))


def money(value: float) -> str:
    return f"${value:,.2f}"


def make_pdf(path: Path, brand: str, document_type: str, reference: str, fields: list[tuple[str, str]], rows: list[list[str]], total_label: str | None = None, total: float | None = None, notes: str | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, rightMargin=0.65 * inch, leftMargin=0.65 * inch, topMargin=0.55 * inch, bottomMargin=0.55 * inch, title=document_type, author=brand)
    story = [
        Paragraph(brand, styles["Brand"]),
        Paragraph(document_type.upper(), styles["DocType"]),
        HRFlowable(width="100%", thickness=1, color=BLUE, spaceAfter=14),
    ]

    field_cells = []
    for label, value in fields:
        field_cells.append([Paragraph(label.upper(), styles["Label"]), Paragraph(value, styles["Value"])])
    midpoint = (len(field_cells) + 1) // 2
    left, right = field_cells[:midpoint], field_cells[midpoint:]
    while len(right) < len(left):
        right.append([Paragraph("", styles["Label"]), Paragraph("", styles["Value"])])
    paired = [[left[i][0], left[i][1], right[i][0], right[i][1]] for i in range(len(left))]
    info = Table(paired, colWidths=[0.9 * inch, 2.25 * inch, 0.9 * inch, 2.25 * inch])
    info.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 9)]))
    story.extend([info, Spacer(1, 8)])

    if rows:
        table_data = [[Paragraph(str(cell), styles["Label"]) for cell in rows[0]]]
        table_data.extend([[Paragraph(str(cell), styles["Value"]) for cell in row] for row in rows[1:]])
        widths = [6.2 * inch / len(rows[0])] * len(rows[0])
        table = Table(table_data, colWidths=widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PALE),
            ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
            ("GRID", (0, 0), (-1, -1), 0.5, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.extend([table, Spacer(1, 12)])

    if total_label and total is not None:
        total_table = Table([[Paragraph(total_label.upper(), styles["Label"]), Paragraph(f"<b>{money(total)}</b>", styles["Right"])]], colWidths=[4.9 * inch, 1.3 * inch])
        total_table.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1, NAVY), ("TOPPADDING", (0, 0), (-1, -1), 9)]))
        story.extend([total_table, Spacer(1, 14)])

    if notes:
        story.extend([Paragraph("NOTES", styles["Label"]), Spacer(1, 3), Paragraph(notes, styles["Value"]), Spacer(1, 14)])

    story.extend([
        Spacer(1, 10),
        HRFlowable(width="100%", thickness=0.5, color=LINE, spaceBefore=8, spaceAfter=8),
        Paragraph(f"Fictional demo document - Reference {reference} - Generated for DispatchDesk product demonstration", styles["CenterSmall"]),
    ])
    doc.build(story)


def load_document(file_id: str, filename: str, *args, **kwargs) -> None:
    make_pdf(OUTPUT / "load-documents" / LOAD_ID / f"{file_id}-{filename}", *args, **kwargs)


def receipt(group_id: str, file_id: str, filename: str, *args, **kwargs) -> None:
    make_pdf(OUTPUT / "bookkeeping-receipts" / group_id / f"{file_id}-{filename}", *args, **kwargs)


def main() -> None:
    load_document("19000000-0000-4000-8000-000000000001", "rate-confirmation.pdf", "Camino Freight Partners", "Rate Confirmation", "CFP-77841", [("Load", "RD-260717-01"), ("Date", "July 17, 2026"), ("Carrier", "RD"), ("Driver", "Carlos Ramirez"), ("Pickup", "Ontario, CA"), ("Delivery", "Phoenix, AZ")], [["Stop", "Appointment", "Details"], ["Pickup", "07/17/2026 09:00", "Golden State Foods - 12 pallets"], ["Delivery", "07/18/2026 08:00", "Desert Market DC - dock 14"]], "Agreed linehaul", 2850.00, "Driver assist prohibited. Tracking required every four hours.")
    load_document("19000000-0000-4000-8000-000000000002", "invoice.pdf", "RD", "Carrier Invoice", "INV-RD-1048", [("Bill to", "Camino Freight Partners"), ("Invoice date", "July 18, 2026"), ("Load", "RD-260717-01"), ("Terms", "Net 30"), ("Origin", "Ontario, CA"), ("Destination", "Phoenix, AZ")], [["Description", "Quantity", "Amount"], ["Linehaul transportation", "1", "$2,850.00"]], "Amount due", 2850.00, "Please reference INV-RD-1048 with remittance.")
    load_document("19000000-0000-4000-8000-000000000003", "bill-of-lading.pdf", "Golden State Foods", "Bill of Lading", "BOL-GSF-55291", [("Load", "RD-260717-01"), ("Ship date", "July 17, 2026"), ("Shipper", "Golden State Foods"), ("Consignee", "Desert Market DC"), ("Driver", "Carlos Ramirez"), ("Trailer", "RD-501")], [["Handling units", "Commodity", "Weight"], ["12 pallets", "Packaged dry goods", "21,480 lb"]], None, None, "Received in apparent good order. Seal 884219 intact at pickup.")
    load_document("19000000-0000-4000-8000-000000000004", "fuel-receipt.pdf", "Estrella Travel Center", "Fuel Receipt", "ETC-981744", [("Date", "July 17, 2026 14:22"), ("Location", "Blythe, CA"), ("Driver", "Carlos Ramirez"), ("Truck", "RD-101"), ("Pump", "12"), ("Payment", "Fleet card ending 3107")], [["Product", "Gallons", "Unit price", "Amount"], ["Diesel #2", "82.4", "$4.319", "$355.88"], ["DEF", "2.0", "$4.199", "$8.40"]], "Total", 364.28, "Demo receipt - no real payment instrument.")
    load_document("19000000-0000-4000-8000-000000000005", "lumper-receipt.pdf", "Desert Market DC", "Lumper Receipt", "LMP-20418", [("Date", "July 18, 2026"), ("Facility", "Phoenix, AZ"), ("Load", "RD-260717-01"), ("Driver", "Carlos Ramirez"), ("Door", "14"), ("Payment", "Comchek demo 6841")], [["Service", "Amount"], ["Unload and pallet sort", "$185.00"]], "Paid", 185.00, "Fictional accessorial receipt for demonstration.")
    load_document("19000000-0000-4000-8000-000000000006", "insurance-certificate.pdf", "Sierra Commercial Insurance", "Certificate of Insurance", "COI-RD-2026", [("Insured", "RD"), ("Effective", "January 1, 2026"), ("Expires", "January 1, 2027"), ("Producer", "Raul Mendoza"), ("Auto liability", "$1,000,000"), ("Cargo", "$100,000")], [["Coverage", "Policy", "Limit"], ["Commercial auto", "SCI-RD-81042", "$1,000,000"], ["Motor truck cargo", "SCI-RD-77419", "$100,000"]], None, None, "Sample certificate only. This document confers no rights and is not valid insurance evidence.")
    load_document("19000000-0000-4000-8000-000000000007", "carrier-packet.pdf", "RD", "Carrier Packet", "RD-PACKET-2026", [("Legal name", "RD"), ("SCAC", "RDDM"), ("Primary contact", "Andres Castillo"), ("Phone", "(909) 555-0142"), ("Email", "andres.castillo@example.test"), ("Status", "Demo approved")], [["Document", "Status"], ["Operating authority", "On file"], ["W-9", "On file"], ["Insurance certificate", "On file"], ["ACH authorization", "Demo only"]], None, None, "All companies and contact details in this packet are fictional.")
    load_document("19000000-0000-4000-8000-000000000008", "detention-approval.pdf", "Camino Freight Partners", "Accessorial Approval", "ACC-77841-1", [("Load", "RD-260717-01"), ("Date", "July 18, 2026"), ("Approved by", "Javier Morales"), ("Carrier", "RD"), ("Reason", "Detention at receiver"), ("Approved time", "2.0 hours")], [["Accessorial", "Rate", "Approved"], ["Receiver detention", "$75.00/hr", "$150.00"]], "Approved amount", 150.00, "Approval applies only to the referenced demo load.")

    receipt("18000000-0000-4000-8000-000000000001", "18200000-0000-4000-8000-000000000001", "diesel-receipt.pdf", "Estrella Travel Center", "Fuel Receipt", "ETC-981744", [("Date", "July 17, 2026"), ("Truck", "RD-101"), ("Driver", "Carlos Ramirez"), ("Location", "Blythe, CA")], [["Product", "Gallons", "Amount"], ["Diesel #2", "82.4", "$355.88"]], "Total", 355.88)
    receipt("18000000-0000-4000-8000-000000000002", "18200000-0000-4000-8000-000000000002", "maintenance-invoice.pdf", "Taller Mendoza Diesel", "Repair Invoice", "TMD-6194", [("Date", "July 9, 2026"), ("Truck", "RD-102"), ("Technician", "Hector Mendoza"), ("Approved by", "Andres Castillo")], [["Item", "Type", "Amount"], ["Air line diagnostic and labor", "Labor", "$420.00"], ["Gladhand seals and fittings", "Parts", "$186.75"]], "Invoice total", 606.75)
    receipt("18000000-0000-4000-8000-000000000003", "18200000-0000-4000-8000-000000000003", "toll-statement.pdf", "South Bay Express Lanes", "Toll Statement", "SBEL-44821", [("Period", "July 2026"), ("Truck", "RC-201"), ("Driver", "Javier Morales"), ("Account", "Demo 201")], [["Date", "Plaza", "Amount"], ["07/14/2026", "SR-125 Mainline", "$18.50"], ["07/15/2026", "SR-125 Mainline", "$18.50"]], "Total", 37.00)
    receipt("18000000-0000-4000-8000-000000000004", "18200000-0000-4000-8000-000000000004", "insurance-premium.pdf", "Sierra Commercial Insurance", "Premium Receipt", "SCI-PMT-1098", [("Date", "July 1, 2026"), ("Fleet", "RC"), ("Representative", "Raul Mendoza"), ("Method", "Demo ACH")], [["Coverage period", "Description", "Amount"], ["July 2026", "Commercial auto premium", "$1,480.00"]], "Paid", 1480.00)
    receipt("18000000-0000-4000-8000-000000000005", "18200000-0000-4000-8000-000000000005", "permit-receipt.pdf", "Arizona Motor Carrier Services", "Permit Receipt", "AZMCS-7716", [("Date", "July 11, 2026"), ("Truck", "RD-103"), ("Driver", "Luis Garcia"), ("Permit", "Oversize demo")], [["Permit type", "Route", "Amount"], ["Single trip", "I-10 corridor", "$75.00"]], "Paid", 75.00)
    receipt("18000000-0000-4000-8000-000000000006", "18200000-0000-4000-8000-000000000006", "parking-receipt.pdf", "Border City Secure Parking", "Parking Receipt", "BCSP-22014", [("Date", "July 13, 2026"), ("Truck", "RC-202"), ("Driver", "Diego Salazar"), ("Location", "Otay Mesa, CA")], [["Service", "Duration", "Amount"], ["Secure truck parking", "1 night", "$32.00"]], "Paid", 32.00)
    receipt("18000000-0000-4000-8000-000000000007", "18200000-0000-4000-8000-000000000007", "parts-receipt.pdf", "Valle Truck Parts", "Parts Receipt", "VTP-55208", [("Date", "July 8, 2026"), ("Trailer", "RC-601"), ("Customer", "RC"), ("Salesperson", "Miguel Torres")], [["Part", "Quantity", "Amount"], ["LED marker lamp", "4", "$51.80"], ["Weatherproof connectors", "1 pack", "$14.95"]], "Total", 66.75)
    receipt("18000000-0000-4000-8000-000000000008", "18200000-0000-4000-8000-000000000008", "supplies-receipt.pdf", "Mercado Fleet Supply", "Supply Receipt", "MFS-90418", [("Date", "July 6, 2026"), ("Fleet", "RD"), ("Purchased by", "Andres Castillo"), ("Location", "Fontana, CA")], [["Item", "Quantity", "Amount"], ["Load locks", "2", "$89.90"], ["Safety vests", "6", "$53.94"], ["Seal pack", "1", "$24.50"]], "Total", 168.34)
    receipt("18000000-0000-4000-8000-000000000009", "18200000-0000-4000-8000-000000000009", "truck-wash-receipt.pdf", "El Camino Truck Wash", "Service Receipt", "ECTW-11842", [("Date", "July 5, 2026"), ("Truck", "RC-203"), ("Driver", "Raul Mendoza"), ("Bay", "3")], [["Service", "Amount"], ["Tractor and trailer wash", "$92.00"]], "Total", 92.00)

    generated = sorted(OUTPUT.rglob("*.pdf"))
    print(f"Generated {len(generated)} demo PDFs under {OUTPUT}")


if __name__ == "__main__":
    main()
