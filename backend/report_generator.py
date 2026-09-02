import os
import tempfile
import qrcode

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors


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
    Creates a GeoTrack PDF report.
    """

    # A4 page
    page_width, page_height = A4

    c = canvas.Canvas(output_path, pagesize=A4)

    # Margins
    margin = 40

    # ==================================================
    # HEADER
    # ==================================================

    c.setStrokeColor(colors.black)
    c.setLineWidth(2)

    c.rect(
        margin,
        page_height - 100,
        page_width - (margin * 2),
        60
    )

    c.setFont("Helvetica-Bold", 16)

    c.drawCentredString(
        page_width / 2,
        page_height - 70,
        "GEOTRACK"
    )

    c.setFont("Helvetica", 9)

    c.drawCentredString(
        page_width / 2,
        page_height - 85,
        f"Iteration Report | Job ID: {job_id}"
    )


    # ==================================================
    # ORIGINAL IMAGE
    # ==================================================

    image_y = page_height - 320

    box_width = 230
    box_height = 180

    left_x = margin
    right_x = page_width - margin - box_width

    # Original image box
    c.rect(
        left_x,
        image_y,
        box_width,
        box_height
    )

    c.setFont("Helvetica-Bold", 11)

    c.drawString(
        left_x + 10,
        image_y + box_height - 20,
        "Original Image"
    )

    # Add original image
    try:
        c.drawImage(
            original_image_path,
            left_x + 10,
            image_y + 10,
            box_width - 20,
            box_height - 40,
            preserveAspectRatio=True,
            anchor="c"
        )
    except Exception as e:
        print("Original image error:", e)


    # ==================================================
    # MASK IMAGE
    # ==================================================

    c.rect(
        right_x,
        image_y,
        box_width,
        box_height
    )

    c.setFont("Helvetica-Bold", 11)

    c.drawString(
        right_x + 10,
        image_y + box_height - 20,
        "Predicted Mask"
    )

    try:
        c.drawImage(
            mask_image_path,
            right_x + 10,
            image_y + 10,
            box_width - 20,
            box_height - 40,
            preserveAspectRatio=True,
            anchor="c"
        )
    except Exception as e:
        print("Mask image error:", e)


    # ==================================================
    # DETAILS EXTRACTED FROM GEOJSON
    # ==================================================

    details_y = image_y - 150
    details_height = 110

    c.rect(
        margin,
        details_y,
        page_width - (margin * 2),
        details_height
    )

    c.setFont("Helvetica-Bold", 12)

    c.drawCentredString(
        page_width / 2,
        details_y + details_height - 25,
        "DETAILS EXTRACTED FROM GEOJSON"
    )

    c.setFont("Helvetica", 10)

    y_position = details_y + details_height - 50

    for class_name, percentage in class_breakdown.items():

        readable_name = class_name.replace("_", " ").title()

        text = f"{readable_name}: {percentage}%"

        c.drawString(
            margin + 20,
            y_position,
            text
        )

        y_position -= 16


    # ==================================================
    # QR CODE
    # ==================================================

    qr_y = 130
    qr_size = 150

    # Generate QR
    qr = qrcode.QRCode(
        version=1,
        box_size=10,
        border=4
    )

    qr.add_data(geojson_url)
    qr.make(fit=True)

    qr_image = qr.make_image(
        fill_color="black",
        back_color="white"
    )

    # Temporary QR image
    temp_qr_path = os.path.join(
        tempfile.gettempdir(),
        f"{job_id}_qr.png"
    )

    qr_image.save(temp_qr_path)

    # QR box
    c.rect(
        margin,
        qr_y,
        220,
        180
    )

    c.setFont("Helvetica-Bold", 11)

    c.drawString(
        margin + 10,
        qr_y + 160,
        "RAW DATA QR CODE"
    )

    c.drawImage(
        temp_qr_path,
        margin + 35,
        qr_y + 10,
        qr_size,
        qr_size
    )


    # ==================================================
    # CONFIDENCE METRICS
    # ==================================================

    confidence_x = 300

    c.rect(
        confidence_x,
        qr_y,
        page_width - margin - confidence_x,
        180
    )

    c.setFont("Helvetica-Bold", 12)

    c.drawCentredString(
        confidence_x + 110,
        qr_y + 150,
        "CONFIDENCE METRICS"
    )

    c.setFont("Helvetica", 14)

    confidence_percent = confidence * 100

    c.drawCentredString(
        confidence_x + 110,
        qr_y + 105,
        f"{confidence_percent:.2f}%"
    )

    # Confidence label

    if confidence >= 0.80:
        confidence_label = "HIGH CONFIDENCE"

    elif confidence >= 0.65:
        confidence_label = "MODERATE CONFIDENCE"

    else:
        confidence_label = "REVIEW REQUIRED"

    c.setFont("Helvetica-Bold", 10)

    c.drawCentredString(
        confidence_x + 110,
        qr_y + 75,
        confidence_label
    )


    # ==================================================
    # FOOTER
    # ==================================================

    c.setFont("Helvetica", 8)

    c.drawCentredString(
        page_width / 2,
        40,
        f"GeoTrack • Job ID: {job_id}"
    )

    c.save()

    # Remove temporary QR image
    if os.path.exists(temp_qr_path):
        os.remove(temp_qr_path)

    print(f"PDF report created → {output_path}")

    return output_path