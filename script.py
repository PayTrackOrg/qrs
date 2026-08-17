import base64
import json
import os
import qrcode
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
from urllib.parse import urlencode

nombre="PayTrack"
idDisco="paytrack"
mesas=3 # Cambia este número para generar QR para mesas, ej: mesas=10
base_url="https://users.paytrack.com.co/"

def build_access_link(base_url, id_disco, table=None, message=None):
    payload = {
        "idDisco": id_disco,
        "v": 1,
    }

    if table is not None and str(table).strip():
        payload["table"] = str(table).strip()

    if message is not None and str(message).strip():
        payload["message"] = str(message).strip()

    session = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("utf-8")

    return f"{base_url}?{urlencode({'session': session})}"

def load_header_font(size):
    # Prioriza fuentes compactas y en negrita para parecerse al ejemplo.
    candidate_fonts = [
        "Anton-Regular.ttf",
        "BebasNeue-Regular.ttf",
        "C:/Windows/Fonts/impact.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "BreathingRegular.ttf",
    ]
    for font_path in candidate_fonts:
        try:
            return ImageFont.truetype(font=font_path, size=size)
        except IOError:
            continue

    print("Advertencia: No se pudo cargar una fuente de encabezado. Usando la fuente predeterminada.")
    return ImageFont.load_default()

def draw_corner_frames(base_img, left, top, right, bottom):
    corner_size = 140
    line_width = 4
    radius = 20
    scale = 6
    cyan = (111, 230, 255)
    purple = (166, 102, 222)

    def draw_joint(draw_obj, x, y, color, width):
        half = max(1, width // 2)
        draw_obj.ellipse((x - half, y - half, x + half, y + half), fill=color)

    # Se dibuja en alta resolución y luego se reduce para suavizar curvas.
    width, height = base_img.size
    overlay = Image.new("RGBA", (width * scale, height * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    left *= scale
    top *= scale
    right *= scale
    bottom *= scale
    corner_size *= scale
    line_width *= scale
    radius *= scale

    tl_start = left + radius
    tl_end = left + corner_size
    tl_split = tl_start + int((tl_end - tl_start) * 0.50)

    tr_start = right - corner_size
    tr_end = right - radius
    tr_split = tr_start + int((tr_end - tr_start) * 0.50)

    br_start = right - corner_size
    br_end = right - radius
    br_split = br_start + int((br_end - br_start) * 0.50)

    bl_start = left + radius
    bl_end = left + corner_size
    bl_split = bl_start + int((bl_end - bl_start) * 0.50)

    # Superior izquierda
    draw.line([(left, top + corner_size), (left, top + radius)], fill=purple, width=line_width)
    draw.line([(tl_start, top), (tl_split, top)], fill=cyan, width=line_width)
    draw.line([(tl_split, top), (tl_end, top)], fill=purple, width=line_width)
    draw.arc((left, top, left + (2 * radius), top + (2 * radius)), 180, 225, fill=purple, width=line_width)
    draw.arc((left, top, left + (2 * radius), top + (2 * radius)), 225, 270, fill=cyan, width=line_width)
    draw_joint(draw, left, top + radius, purple, line_width)
    draw_joint(draw, left + radius, top, cyan, line_width)
    draw_joint(draw, tl_split, top, purple, line_width)

    # Superior derecha
    draw.line([(tr_start, top), (tr_split, top)], fill=purple, width=line_width)
    draw.line([(tr_split, top), (tr_end, top)], fill=cyan, width=line_width)
    draw.line([(right, top + radius), (right, top + corner_size)], fill=cyan, width=line_width)
    draw.arc((right - (2 * radius), top, right, top + (2 * radius)), 270, 360, fill=cyan, width=line_width)
    draw_joint(draw, tr_split, top, cyan, line_width)
    draw_joint(draw, right - radius, top, cyan, line_width)
    draw_joint(draw, right, top + radius, cyan, line_width)

    # Inferior izquierda
    draw.line([(left, bottom - corner_size), (left, bottom - radius)], fill=purple, width=line_width)
    draw.line([(bl_start, bottom), (bl_split, bottom)], fill=purple, width=line_width)
    draw.line([(bl_split, bottom), (bl_end, bottom)], fill=cyan, width=line_width)
    draw.arc((left, bottom - (2 * radius), left + (2 * radius), bottom), 90, 135, fill=purple, width=line_width)
    draw.arc((left, bottom - (2 * radius), left + (2 * radius), bottom), 135, 180, fill=cyan, width=line_width)
    draw_joint(draw, left, bottom - radius, purple, line_width)
    draw_joint(draw, bl_split, bottom, cyan, line_width)

    # Inferior derecha
    draw.line([(br_start, bottom), (br_split, bottom)], fill=purple, width=line_width)
    draw.line([(br_split, bottom), (br_end, bottom)], fill=cyan, width=line_width)
    draw.line([(right, bottom - corner_size), (right, bottom - radius)], fill=cyan, width=line_width)
    draw.arc((right - (2 * radius), bottom - (2 * radius), right, bottom), 0, 90, fill=cyan, width=line_width)
    draw_joint(draw, br_split, bottom, cyan, line_width)
    draw_joint(draw, right - radius, bottom, cyan, line_width)
    draw_joint(draw, right, bottom - radius, cyan, line_width)

    overlay = overlay.resize((width, height), Image.LANCZOS)
    base_img.paste(overlay, (0, 0), overlay)

def generate_plain_qr(link, output_path, header_text="PIDE TU CANCIÓN"):
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(link)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

    # Crear un lienzo blanco para mantener el diseño con encabezado arriba.
    qr_width, qr_height = qr_img.size

    header_font = load_header_font(size=60)

    header = header_text.upper()
    temp_img = Image.new("RGB", (1, 1), "white")
    temp_draw = ImageDraw.Draw(temp_img)
    header_bbox = temp_draw.textbbox((0, 0), header, font=header_font)
    header_width = header_bbox[2] - header_bbox[0]
    header_height = header_bbox[3] - header_bbox[1]

    frame_padding = 6
    canvas_width = max(qr_width + (frame_padding * 2) + 120, header_width + 90)
    canvas_height = qr_height + (frame_padding * 2) + header_height + 66
    final_img = Image.new("RGB", (canvas_width, canvas_height), "white")
    draw = ImageDraw.Draw(final_img)

    header_bbox = draw.textbbox((0, 0), header, font=header_font)
    header_width = header_bbox[2] - header_bbox[0]
    header_height = header_bbox[3] - header_bbox[1]

    header_x = (canvas_width - header_width) // 2
    header_y = 8
    qr_x = (canvas_width - qr_width) // 2
    qr_y = header_y + header_height + 16 + frame_padding

    draw.text((header_x, header_y), header, font=header_font, fill="black")
    final_img.paste(qr_img, (qr_x, qr_y))

    frame_left = qr_x - frame_padding
    frame_top = qr_y - frame_padding
    frame_right = qr_x + qr_width + frame_padding
    frame_bottom = qr_y + qr_height + frame_padding
    draw_corner_frames(final_img, frame_left, frame_top, frame_right, frame_bottom)

    final_img.save(output_path)

def generate_qr_with_logo_and_general(link, background_path, title, output_path):
    # 1. Crear el objeto QR (sin cambios aquí)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(link)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

    # 2. Abrir la imagen de fondo y preparar para dibujar
    try:
        final_img = Image.open(background_path).convert("RGB")
        draw = ImageDraw.Draw(final_img)
    except FileNotFoundError:
        print(f"Error: No se encontró la imagen de fondo en {background_path}")
        return

    # 3. Cargar la fuente y medir el tamaño del texto
    font_path = "BreathingRegular.ttf"
    try:
        font = ImageFont.truetype(font=font_path, size=65)
    except IOError:
        print(f"Advertencia: No se pudo cargar la fuente '{font_path}'. Usando la fuente predeterminada.")
        font = ImageFont.load_default()

    text_bbox = draw.textbbox((0, 0), title, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    # 4. Calcular posiciones para centrar el QR y el texto como un solo bloque
    qr_width, qr_height = qr_img.size
    bg_width, bg_height = final_img.size
    
    spacing = 30

    total_content_width = qr_width + spacing + text_width
    
    # Posición 'x' inicial para que el bloque completo quede centrado matemáticamente
    start_x_calculado = (bg_width - total_content_width) // 3

    # --- ✨ LÍNEA NUEVA PARA EL AJUSTE MANUAL ✨ ---
    # Restamos un valor para mover todo el bloque hacia la izquierda.
    # ¡Puedes cambiar este número hasta que quede perfecto!
    manual_offset = -190
    start_x = start_x_calculado - manual_offset
    
    # Coordenadas para el QR (centrado verticalmente)
    qr_pos = (start_x, (bg_height - qr_height) // 2)

    # Coordenadas para el Texto (alineado verticalmente con el QR)
    text_pos = (start_x + qr_width + spacing, (bg_height - text_height) // 2)

    # 5. Pegar el código QR en su posición calculada
    final_img.paste(qr_img, qr_pos)
    
    # 6. Dibujar el texto en su posición calculada
    draw.text(text_pos, title, font=font, fill="black")

    # 7. Guardar la imagen final
    final_img.save(output_path)
    
def generate_qr_with_logo_and_text(link, background_path, title, output_path):
    # 1. Crear el objeto QR (sin cambios aquí)
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=2,
    )
    qr.add_data(link)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white").convert('RGB')

    # 2. Abrir la imagen de fondo y preparar para dibujar
    try:
        final_img = Image.open(background_path).convert("RGB")
        draw = ImageDraw.Draw(final_img)
    except FileNotFoundError:
        print(f"Error: No se encontró la imagen de fondo en {background_path}")
        return

    # 3. Cargar la fuente y medir el tamaño del texto
    font_path = "BreathingRegular.ttf"
    try:
        font = ImageFont.truetype(font=font_path, size=65)
    except IOError:
        print(f"Advertencia: No se pudo cargar la fuente '{font_path}'. Usando la fuente predeterminada.")
        font = ImageFont.load_default()

    text_bbox = draw.textbbox((0, 0), title, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]

    # 4. Calcular posiciones para centrar el QR y el texto como un solo bloque
    qr_width, qr_height = qr_img.size
    bg_width, bg_height = final_img.size
    
    spacing = 30

    total_content_width = qr_width + spacing + text_width
    
    # Posición 'x' inicial para que el bloque completo quede centrado matemáticamente
    start_x_calculado = (bg_width - total_content_width) // 3

    # --- ✨ LÍNEA NUEVA PARA EL AJUSTE MANUAL ✨ ---
    # Restamos un valor para mover todo el bloque hacia la izquierda.
    # ¡Puedes cambiar este número hasta que quede perfecto!
    manual_offset = -115
    start_x = start_x_calculado - manual_offset
    
    # Coordenadas para el QR (centrado verticalmente)
    qr_pos = (start_x, (bg_height - qr_height) // 2)
    
    # Coordenadas para el Texto (alineado verticalmente con el QR)
    text_pos = (start_x + qr_width + spacing+10, (bg_height - (text_height+130)) // 2)
    
    # Coordenadas para el Texto (alineado verticalmente con el QR)
    text_pos_2 = (start_x + qr_width + spacing + 60, (bg_height - (text_height - 40)) // 2)

    # 5. Pegar el código QR en su posición calculada
    final_img.paste(qr_img, qr_pos)
    
    # 6. Dibujar el texto en su posición calculada
    draw.text(text_pos, "Mesa", font=font, fill="black")

    draw.text(text_pos_2, title, font=font, fill="black")

    # 7. Guardar la imagen final
    final_img.save(output_path)

logo_path = "./Background.png"  # Ruta del fondo
output_folder = "./images/"     # Carpeta de salida
os.makedirs(output_folder, exist_ok=True)

# Lista de links y otros datos
links = [
    build_access_link(base_url, idDisco)
]
for i in range(1, mesas + 1, 1):
    links.append(build_access_link(base_url, idDisco, table=i))

# Generar un QR para cada link
for i, link in enumerate(links):
    if i != 0:
        title = f"{i}"
        output_path_with_bg = f"{output_folder}{idDisco}-mesa-{i}.png"
        output_path_plain = f"{output_folder}{idDisco}-mesa-{i}-sin-fondo.png"

        generate_qr_with_logo_and_text(link, logo_path, title, output_path_with_bg)
        generate_plain_qr(link, output_path_plain)

        print(f"Mesa {i}: con fondo -> {output_path_with_bg} | sin fondo -> {output_path_plain}")
    else:
        title = f"{nombre}"
        output_path_with_bg = f"{output_folder}{idDisco}-general.png"
        output_path_plain = f"{output_folder}{idDisco}-general-sin-fondo.png"

        generate_qr_with_logo_and_general(link, logo_path, title, output_path_with_bg)
        generate_plain_qr(link, output_path_plain)

        print(f"General: con fondo -> {output_path_with_bg} | sin fondo -> {output_path_plain}")

print("¡Códigos QR generados (con fondo y sin fondo)!")
