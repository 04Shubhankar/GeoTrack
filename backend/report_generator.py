import os
import tempfile
from datetime import datetime

import qrcode

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors


# =========================================================
# CONFIGURATION
# =========================================================

CLASS_COLORS = {
    0: (0,   255, 255),   # urban_land
    1: (255, 255,   0),   # agriculture_land
    2: (255,   0, 255),   # rangeland
    3: (0,   255,   0),   # forest_land
    4: (0,     0, 255),   # water
    5: (255, 255, 255),   # barren_land
}


CLASS_NAMES = {
    0: "Urban Land",
    1: "Agriculture Land",
    2: "Rangeland",
    3: "Forest Land",
    4: "Water",
    5: "Barren Land",
}


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def rgb_color(rgb):
    """
    Convert RGB tuple from 0-255 to ReportLab color.
    """
    return colors.Color(
        rgb[0] / 255,
        rgb[1] / 255,
        rgb[2] / 255
    )


def draw_image_contain(
    c,
    image_path,
    x,
    y,
    width,
    height
):
    """
    Draw image while preserving aspect ratio and centering it.
    """

    try:

        from PIL import Image

        image = Image.open(image_path)

        img_width, img_height = image.size

        scale = min(
            width / img_width,
            height / img_height
        )

        new_width = img_width * scale
        new_height = img_height * scale

        image_x = x + (width - new_width) / 2
        image_y = y + (height - new_height) / 2

        c.drawImage(
            image_path,
            image_x,
            image_y,
            new_width,
            new_height,
            preserveAspectRatio=True,
            mask="auto"
        )

    except Exception as e:

        print(
            f"Image drawing error for {image_path}:",
            e
        )


def draw_header(
    c,
    page_width,
    page_height,
    job_id,
    logo_path
):
    """
    Draw professional report header.
    """

    header_height = 75

    # Header background
    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.rect(
        0,
        page_height - header_height,
        page_width,
        header_height,
        stroke=0,
        fill=1
    )

    # Logo
    if os.path.exists(logo_path):

        try:

            c.drawImage(
                logo_path,
                35,
                page_height - 62,
                width=40,
                height=40,
                preserveAspectRatio=True,
                mask="auto"
            )

        except Exception as e:

            print("Logo loading error:", e)

    # Title
    c.setFillColor(colors.white)

    c.setFont(
        "Helvetica-Bold",
        19
    )

    c.drawString(
        90,
        page_height - 38,
        "GEOTRACK"
    )

    # Subtitle
    c.setFont(
        "Helvetica",
        9
    )

    c.drawString(
        90,
        page_height - 55,
        "Land Use / Land Cover Classification System"
    )

    # Job ID
    c.setFont(
        "Helvetica",
        8
    )

    c.drawRightString(
        page_width - 35,
        page_height - 48,
        f"Report ID: {job_id}"
    )


def draw_footer(
    c,
    page_width,
    page_number,
    job_id
):
    """
    Draw professional GIS-style footer.
    """

    footer_y = 35

    # Separator line
    c.setStrokeColor(
        colors.HexColor("#B7C9D6")
    )

    c.setLineWidth(0.7)

    c.line(
        35,
        footer_y + 15,
        page_width - 35,
        footer_y + 15
    )

    # Footer text
    c.setFillColor(
        colors.HexColor("#555555")
    )

    c.setFont(
        "Helvetica",
        7.5
    )

    c.drawString(
        35,
        footer_y,
        "GeoTrack | Automated Land Use / Land Cover Analysis"
    )

    c.drawCentredString(
        page_width / 2,
        footer_y,
        f"Report ID: {job_id}"
    )

    c.drawRightString(
        page_width - 35,
        footer_y,
        f"Page {page_number}"
    )


# =========================================================
# MAIN REPORT FUNCTION
# =========================================================

def create_report(
    output_path,
    job_id,
    original_image_path,
    mask_image_path,
    confidence,
    class_breakdown,
    geojson_url
):
    """
    Creates a professional GeoTrack
    Land Use / Land Cover GIS report.
    """

    # =====================================================
    # PAGE SETUP
    # =====================================================

    page_width, page_height = A4

    c = canvas.Canvas(
        output_path,
        pagesize=A4
    )

    margin = 35

    # Logo is in same folder as this Python file
    current_dir = os.path.dirname(
        os.path.abspath(__file__)
    )

    logo_path = os.path.join(
        current_dir,
        "logo.png"
    )

    # =====================================================
    # HEADER
    # =====================================================

    draw_header(
        c,
        page_width,
        page_height,
        job_id,
        logo_path
    )

    # =====================================================
    # REPORT TITLE
    # =====================================================

    title_y = page_height - 105

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        17
    )

    c.drawCentredString(
        page_width / 2,
        title_y,
        "LAND USE / LAND COVER"
    )

    c.setFont(
        "Helvetica-Bold",
        17
    )

    c.drawCentredString(
        page_width / 2,
        title_y - 22,
        "CLASSIFICATION REPORT"
    )

    # Report information

    report_date = datetime.now().strftime(
        "%d %B %Y | %H:%M"
    )

    c.setFillColor(
        colors.HexColor("#555555")
    )

    c.setFont(
        "Helvetica",
        8
    )

    c.drawCentredString(
        page_width / 2,
        title_y - 42,
        f"Generated: {report_date}"
    )

    # =====================================================
    # MAP SECTION
    # =====================================================

    section_y = page_height - 190

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        11
    )

    c.drawString(
        margin,
        section_y,
        "CLASSIFICATION OUTPUT"
    )

    c.setStrokeColor(
        colors.HexColor("#17365D")
    )

    c.setLineWidth(1)

    c.line(
        margin,
        section_y - 5,
        page_width - margin,
        section_y - 5
    )

    # Image boxes

    image_y = section_y - 220

    box_width = 245
    box_height = 190

    left_x = margin

    right_x = (
        page_width
        - margin
        - box_width
    )

    # -----------------------------------------------------
    # ORIGINAL IMAGE BOX
    # -----------------------------------------------------

    c.setFillColor(colors.white)

    c.setStrokeColor(
        colors.HexColor("#AAB7C4")
    )

    c.setLineWidth(0.8)

    c.rect(
        left_x,
        image_y,
        box_width,
        box_height,
        fill=0,
        stroke=1
    )

    # Box title

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawCentredString(
        left_x + box_width / 2,
        image_y + box_height - 18,
        "INPUT SATELLITE IMAGE"
    )

    # Image

    draw_image_contain(
        c,
        original_image_path,
        left_x + 10,
        image_y + 10,
        box_width - 20,
        box_height - 38
    )

    # -----------------------------------------------------
    # CLASSIFICATION MAP BOX
    # -----------------------------------------------------

    c.setStrokeColor(
        colors.HexColor("#AAB7C4")
    )

    c.rect(
        right_x,
        image_y,
        box_width,
        box_height,
        fill=0,
        stroke=1
    )

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawCentredString(
        right_x + box_width / 2,
        image_y + box_height - 18,
        "LULC CLASSIFICATION MAP"
    )

    draw_image_contain(
        c,
        mask_image_path,
        right_x + 10,
        image_y + 10,
        box_width - 20,
        box_height - 38
    )

    # =====================================================
    # LEGEND
    # =====================================================

    legend_y = image_y - 130

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        11
    )

    c.drawString(
        margin,
        legend_y + 105,
        "MAP LEGEND"
    )

    c.setStrokeColor(
        colors.HexColor("#17365D")
    )

    c.line(
        margin,
        legend_y + 100,
        page_width - margin,
        legend_y + 100
    )

    # Legend background box

    c.setFillColor(
        colors.HexColor("#F5F7F9")
    )

    c.rect(
        margin,
        legend_y,
        page_width - (margin * 2),
        85,
        stroke=0,
        fill=1
    )

    legend_start_x = margin + 20
    legend_start_y = legend_y + 60

    column_width = 250

    for class_id, class_name in CLASS_NAMES.items():

        index = class_id

        if index < 3:

            x = legend_start_x
            y = legend_start_y - (index * 22)

        else:

            x = legend_start_x + column_width
            y = legend_start_y - ((index - 3) * 22)

        rgb = CLASS_COLORS[class_id]

        # Color square

        c.setFillColor(
            rgb_color(rgb)
        )

        c.setStrokeColor(colors.black)

        c.rect(
            x,
            y,
            12,
            12,
            fill=1,
            stroke=1
        )

        # Text

        c.setFillColor(colors.black)

        c.setFont(
            "Helvetica",
            9
        )

        c.drawString(
            x + 20,
            y + 2,
            class_name
        )

    # =====================================================
    # LAND COVER DISTRIBUTION
    # =====================================================

    distribution_y = legend_y - 160

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        11
    )

    c.drawString(
        margin,
        distribution_y + 135,
        "LAND COVER DISTRIBUTION"
    )

    c.setStrokeColor(
        colors.HexColor("#17365D")
    )

    c.line(
        margin,
        distribution_y + 130,
        page_width - margin,
        distribution_y + 130
    )

    # Table settings

    table_x = margin
    table_width = page_width - (margin * 2)

    row_height = 18

    header_y = distribution_y + 105

    # Table header

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.rect(
        table_x,
        header_y,
        table_width,
        row_height,
        stroke=0,
        fill=1
    )

    c.setFillColor(colors.white)

    c.setFont(
        "Helvetica-Bold",
        9
    )

    c.drawString(
        table_x + 15,
        header_y + 5,
        "Land Cover Class"
    )

    c.drawRightString(
        table_x + table_width - 15,
        header_y + 5,
        "Coverage (%)"
    )

    # Table rows

    current_y = header_y - row_height

    sorted_classes = sorted(
        class_breakdown.items(),
        key=lambda x: x[1],
        reverse=True
    )

    for class_name, percentage in sorted_classes:

        readable_name = (
            class_name
            .replace("_", " ")
            .title()
        )

        c.setFillColor(
            colors.HexColor("#F5F7F9")
        )

        c.rect(
            table_x,
            current_y,
            table_width,
            row_height,
            stroke=0,
            fill=1
        )

        c.setFillColor(colors.black)

        c.setFont(
            "Helvetica",
            8.5
        )

        c.drawString(
            table_x + 15,
            current_y + 5,
            readable_name
        )

        c.drawRightString(
            table_x + table_width - 15,
            current_y + 5,
            f"{percentage:.2f}%"
        )

        current_y -= row_height

    # =====================================================
    # CONFIDENCE AND QR CODE
    # =====================================================

    # Keep the lower panels below the land-cover table. The final row
    # position is dynamic, so calculate the gap from the table's actual
    # bottom and add a wider breathing space so the panels do not feel
    # cramped or overlap the table.
    table_bottom = current_y + row_height
    lower_y = max(25, table_bottom - 135)

    # QR section

    qr_box_width = 210
    qr_box_height = 120

    c.setStrokeColor(
        colors.HexColor("#AAB7C4")
    )

    c.rect(
        margin,
        lower_y,
        qr_box_width,
        qr_box_height,
        fill=0,
        stroke=1
    )

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawString(
        margin + 12,
        lower_y + 100,
        "RAW GIS DATA ACCESS"
    )

    # Generate QR code

    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=4
    )

    qr.add_data(geojson_url)

    qr.make(
        fit=True
    )

    qr_image = qr.make_image(
        fill_color="black",
        back_color="white"
    )

    temp_qr_path = os.path.join(
        tempfile.gettempdir(),
        f"{job_id}_qr.png"
    )

    qr_image.save(
        temp_qr_path
    )

    # Draw QR

    c.drawImage(
        temp_qr_path,
        margin + 15,
        lower_y + 12,
        85,
        85
    )

    c.setFillColor(
        colors.HexColor("#555555")
    )

    c.setFont(
        "Helvetica",
        8
    )

    c.drawString(
        margin + 110,
        lower_y + 70,
        "Scan to access"
    )

    c.drawString(
        margin + 110,
        lower_y + 55,
        "raw GeoJSON data"
    )

    c.drawString(
        margin + 110,
        lower_y + 40,
        "and GIS outputs."
    )

    # =====================================================
    # CONFIDENCE SECTION
    # =====================================================

    confidence_x = margin + qr_box_width + 20

    confidence_width = (
        page_width
        - margin
        - confidence_x
    )

    c.setStrokeColor(
        colors.HexColor("#AAB7C4")
    )

    c.rect(
        confidence_x,
        lower_y,
        confidence_width,
        qr_box_height,
        fill=0,
        stroke=1
    )

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawCentredString(
        confidence_x + confidence_width / 2,
        lower_y + 100,
        "MODEL CONFIDENCE ASSESSMENT"
    )

    confidence_percent = confidence * 100

    # Confidence value

    c.setFillColor(
        colors.HexColor("#17365D")
    )

    c.setFont(
        "Helvetica-Bold",
        22
    )

    c.drawCentredString(
        confidence_x + confidence_width / 2,
        lower_y + 60,
        f"{confidence_percent:.2f}%"
    )

    # Confidence label

    if confidence >= 0.80:

        confidence_label = "HIGH CONFIDENCE"

        confidence_color = colors.HexColor("#2E7D32")

    elif confidence >= 0.65:

        confidence_label = "MODERATE CONFIDENCE"

        confidence_color = colors.HexColor("#F57C00")

    else:

        confidence_label = "REVIEW REQUIRED"

        confidence_color = colors.HexColor("#C62828")

    c.setFillColor(
        confidence_color
    )

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawCentredString(
        confidence_x + confidence_width / 2,
        lower_y + 32,
        confidence_label
    )

    # =====================================================
    # FOOTER
    # =====================================================

    draw_footer(
        c,
        page_width,
        page_number=1,
        job_id=job_id
    )

    # =====================================================
    # SAVE REPORT
    # =====================================================

    c.save()

    # Remove temporary QR file

    if os.path.exists(temp_qr_path):

        os.remove(
            temp_qr_path
        )

    print(
        f"Professional PDF report created → {output_path}"
    )

    return output_path