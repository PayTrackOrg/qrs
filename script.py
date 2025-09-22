import qrcode
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

nombre="General"
idDisco="licoexpressla45"
mesas=15 # Cambia este número para generar QR para mesas, ej: mesas=10

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

# Lista de links y otros datos
links = [
    f"https://users.pay-track.app/?idDisco={idDisco}"
]
for i in range(1, mesas + 1, 1):
    links.append(f"https://users.pay-track.app/?idDisco={idDisco}&table={i}")

logo_path = "./Background.png"  # Ruta del fondo
output_folder = "./images/"     # Carpeta de salida

# Generar un QR para cada link
for i, link in enumerate(links):
    if i != 0:
        title = f"Mesa {i}"
        output_path = f"{output_folder}{idDisco}-mesa-{i}.png"
        generate_qr_with_logo_and_text(link, logo_path, title, output_path)
    else:
        title = f"{nombre}"
        output_path = f"{output_folder}{idDisco}-general.png"
        generate_qr_with_logo_and_text(link, logo_path, title, output_path)

print("¡Códigos QR generados!")