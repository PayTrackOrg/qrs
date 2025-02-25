import qrcode
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

nombre="Licoexpress la 45"
idDisco="licoexpressla45"
mesas=0

# Función para generar el código QR con logo y texto debajo
def generate_qr_with_logo_and_text(link, logo_path, title, output_path):
    # Crear el código QR
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(link)
    qr.make(fit=True)

    # Convertir a imagen
    qr_img = qr.make_image(fill="black", back_color="white").convert('RGB')

    # Abrir el logo
    logo = Image.open(logo_path)
    logo.thumbnail(((qr_img.size[0] // 3) , (qr_img.size[1] // 3) ), Image.LANCZOS)

    # Pegar el logo en el centro del QR
    pos = ((qr_img.size[0] - logo.size[0]) // 2, (qr_img.size[1] - logo.size[1]) // 2)
    qr_img.paste(logo, pos, mask=logo)

    # Crear una nueva imagen con espacio para el texto
    font = ImageFont.truetype(font="MTCORSVA.ttf", size=25)  # Usa una fuente predeterminada
    total_height = qr_img.size[1] + 20
    new_img = Image.new("RGB", (qr_img.size[0], total_height), "white")
    new_img.paste(qr_img, (0, 10))

    # Crear objeto draw
    draw = ImageDraw.Draw(new_img)
    
   # Dibujar el título superior
    # text_width_top, _ = draw.textbbox((0, 0), "HOLA", font=font)[2:4]
    # text_position_top = ((new_img.size[0] - text_width_top) // 2, 5)
    # draw.text(text_position_top, "Hola", font=font, fill="black")

    # Obtener tamaño del texto
    text_width, text_height = draw.textbbox((0, 0), title, font=font)[2:4]

    # Dibujar el texto debajo del código QR
    text_position = ((new_img.size[0] - text_width) // 2, qr_img.size[1] - 15)
    draw.text(text_position, title, font=font, fill="black")

    # Guardar la imagen final
    new_img.save(output_path)

# Lista de links y otros datos
links = [
    f"https://users.pay-track.app/?idDisco={idDisco}"
]
for i in range(1,mesas+1,1):
    links.append(f"https://users.pay-track.app/?idDisco={idDisco}&table={i}")
logo_path = "./icono.png"  # Ruta del logo
output_folder = "./images/"  # Carpeta de salida

# Generar un QR para cada link
for i, link in enumerate(links):
    if i != 0:
        title = f"{nombre} - Mesa {i}"
        output_path = f"{output_folder}mesa-{i}.png"
        generate_qr_with_logo_and_text(link, logo_path, title, output_path)
    else:
        title = f"{nombre}"
        output_path = f"{output_folder}general.png"
        generate_qr_with_logo_and_text(link, logo_path, title, output_path)

print("¡Códigos QR generados!")