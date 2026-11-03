import paho.mqtt.client as mqtt
import os
import json
import RPi.GPIO as GPIO
import time
from datetime import datetime
import threading
import subprocess

# --- 1. CONFIGURACIÓN GENERAL ---
BROKER = "10.56.31.31"
PORT = 1883
TOPIC_MENSAJE = "abuela/mensaje"
TOPIC_NUEVA_RECETA = "abuela/receta"
TOPIC_CONFIRMACION = "abuela/confirmacion"
TOPIC_ALERTA = "abuela/alerta"
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

ARCHIVO_ALERTAS = "alertas.json"

# Pines físicos (20 y 21 en modo BCM)
BOTON_CONFIRMACION = 20  
BOTON_ALERTA = 21        

# --- 2. CONFIGURACIÓN GPIO ---
GPIO.setmode(GPIO.BCM)
GPIO.setup(BOTON_ALERTA, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(BOTON_CONFIRMACION, GPIO.IN, pull_up_down=GPIO.PUD_UP)

# --- 3. VARIABLES GLOBALES ---
lock = threading.Lock()
alerta_activa = False
mensaje_actual = ""
ultimo_replay = 0
medicamento_actual = ""
hora_inicio_alerta = 0
proceso_audio = None

# --- 4. MANEJO DE DATOS Y AUDIO OFFLINE ---
def normalizar_alerta(alerta):
    if not isinstance(alerta, dict):
        return None

    hora = alerta.get("hora")
    if not isinstance(hora, str):
        return None
    try:
        hora = datetime.strptime(hora, "%H:%M").strftime("%H:%M")
    except ValueError:
        return None

    dia_recibido = str(alerta.get("dia") or "").strip()
    dias_por_nombre = {dia.casefold(): dia for dia in DIAS_SEMANA}
    dia = dias_por_nombre.get(dia_recibido.casefold())
    if dia_recibido and dia is None:
        return None

    return {
        "hora": hora,
        "dia": dia or "",
        "tipo": str(alerta.get("tipo") or alerta.get("medicamento") or "").strip(),
        "mensaje": str(alerta.get("mensaje") or "").strip(),
    }


def cargar_alertas():
    if not os.path.exists(ARCHIVO_ALERTAS):
        alertas_base = [{
            "hora": "08:00",
            "dia": "",
            "tipo": "Pastilla para la presión",
            "mensaje": "",
        }]
        with open(ARCHIVO_ALERTAS, 'w') as archivo:
            json.dump(alertas_base, archivo, indent=4)
        return alertas_base
    with open(ARCHIVO_ALERTAS, 'r') as archivo:
        datos = json.load(archivo)

    if isinstance(datos, dict):
        datos = [datos]
    if not isinstance(datos, list):
        print("⚠️ alertas.json no contiene una lista de recordatorios.")
        return []

    alertas = [normalizada for item in datos if (normalizada := normalizar_alerta(item))]
    if datos != alertas:
        with open(ARCHIVO_ALERTAS, 'w') as archivo:
            json.dump(alertas, archivo, indent=4, ensure_ascii=False)
    return alertas

lista_alertas = cargar_alertas()

def reproducir_audio_asincrono(texto):
    global proceso_audio
    if proceso_audio and proceso_audio.poll() is None:
        proceso_audio.terminate()
    try:
        # Llama a espeak-ng de forma local
        proceso_audio = subprocess.Popen(['espeak-ng', '-v', 'es-la', '-s', '140', texto])
    except Exception as e:
        print(f"⚠️ Error al ejecutar espeak: {e}")

# --- 5. FUNCIONES DE BOTONES ---
def enviar_confirmacion(cliente):
    global alerta_activa, medicamento_actual, proceso_audio
    with lock:
        if not alerta_activa:
            return
        alerta_activa = False
        if proceso_audio and proceso_audio.poll() is None:
            proceso_audio.terminate()
        hora_confirmacion = datetime.now().strftime('%H:%M')
        mensaje_confirmacion = f"La pastilla {medicamento_actual} fue tomada a las {hora_confirmacion}."
        medicamento_actual = "" 

    print("🟢 " + mensaje_confirmacion)
    reproducir_audio_asincrono("Confirmado. Que tengas un buen día.")
    cliente.publish(TOPIC_CONFIRMACION, mensaje_confirmacion)

def enviar_alerta_sos(cliente):
    global proceso_audio
    print("🔴 ¡ALERTA SOS ENVIADA!")
    if proceso_audio and proceso_audio.poll() is None:
        proceso_audio.terminate()
    reproducir_audio_asincrono("Alarma de emergencia activada. Solicitando ayuda.")
    cliente.publish(TOPIC_ALERTA, "¡EMERGENCIA! Botón SOS presionado.")

# --- 6. CALLBACKS MQTT ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("✅ Conectado al broker MQTT")
        client.subscribe([(TOPIC_MENSAJE, 0), (TOPIC_NUEVA_RECETA, 0)])
    else:
        print(f"❌ Error de conexión: {rc}")

def on_message(client, userdata, msg):
    global alerta_activa, mensaje_actual, ultimo_replay, lista_alertas, hora_inicio_alerta
    tema = msg.topic
    payload = msg.payload.decode()

    if tema == TOPIC_MENSAJE:
        if payload.strip():
            print("📨 Mensaje recibido para reproducir.")
            reproducir_audio_asincrono(payload)
        
    elif tema == TOPIC_NUEVA_RECETA:
        try:
            recibidas = json.loads(payload)
            reemplazar_lista = isinstance(recibidas, list)
            if isinstance(recibidas, dict):
                recibidas = [recibidas]
            elif not reemplazar_lista:
                raise ValueError("La receta debe ser un objeto o una lista de objetos.")

            alertas_recibidas = [normalizar_alerta(item) for item in recibidas]
            if not alertas_recibidas or any(alerta is None for alerta in alertas_recibidas):
                raise ValueError("La receta contiene datos inválidos.")

            with lock:
                if reemplazar_lista:
                    nuevas_alertas = alertas_recibidas
                    hubo_novedad = nuevas_alertas != lista_alertas
                else:
                    nuevas_alertas = list(lista_alertas)
                    hubo_novedad = False
                    for alerta in alertas_recibidas:
                        if alerta not in nuevas_alertas:
                            nuevas_alertas.append(alerta)
                            hubo_novedad = True

                with open(ARCHIVO_ALERTAS, 'w') as archivo:
                    json.dump(nuevas_alertas, archivo, indent=4, ensure_ascii=False)
                lista_alertas = nuevas_alertas
            if hubo_novedad:
                print("📝 Nuevo recordatorio recibido y guardado.")
                reproducir_audio_asincrono("Llegó un nuevo recordatorio.")
            else:
                print("ℹ️ El recordatorio recibido ya estaba guardado.")
        except (json.JSONDecodeError, ValueError, OSError) as error:
            print(f"❌ No se pudo guardar la receta: {error}")

# --- 7. INICIO MQTT ---
client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
client.on_connect = on_connect
client.on_message = on_message

print("🔌 Conectando al broker MQTT...")
try:
    client.connect(BROKER, PORT, 60)
    client.loop_start()
except Exception as e:
    print("⚠️ Falló conexión al broker. Ejecutando offline.")

# --- 8. LOOP PRINCIPAL ---
try:
    ultimo_minuto_revisado = ""
    while True:
        ahora = time.time()
        fecha_actual = datetime.now()
        hora_actual = fecha_actual.strftime("%H:%M")
        dia_actual = DIAS_SEMANA[fecha_actual.weekday()]

        if hora_actual != ultimo_minuto_revisado:
            with lock:
                for alerta in lista_alertas:
                    if alerta["hora"] == hora_actual and alerta["dia"] in ("", dia_actual):
                        mensaje_recordatorio = alerta["mensaje"].strip()
                        if not mensaje_recordatorio:
                            print("⚠️ Recordatorio sin texto en el campo mensaje; se omite el TTS.")
                            continue

                        medicamento_actual = alerta["tipo"] or "recordatorio"
                        mensaje_actual = mensaje_recordatorio
                        alerta_activa = True
                        ultimo_replay = 0
                        hora_inicio_alerta = ahora
                        print(f"⏰ ¡HORA DE PASTILLA! ({hora_actual})")
            ultimo_minuto_revisado = hora_actual

        with lock:
            if alerta_activa:
                if ahora - hora_inicio_alerta > 3600: 
                    alerta_activa = False
                    medicamento_actual = ""
                    print("⌛ Tiempo expirado. Alarma cancelada.")
                elif ahora - ultimo_replay > 20:
                    print("🔁 Repitiendo recordatorio…")
                    reproducir_audio_asincrono(mensaje_actual)
                    ultimo_replay = ahora

        if GPIO.input(BOTON_CONFIRMACION) == GPIO.LOW:
            enviar_confirmacion(client)
            time.sleep(1.0) 

        if GPIO.input(BOTON_ALERTA) == GPIO.LOW:
            enviar_alerta_sos(client)
            time.sleep(1.5) 

        time.sleep(0.05) 

except KeyboardInterrupt:
    print("\n👋 Saliendo...")
finally:
    client.loop_stop()
    GPIO.cleanup()
