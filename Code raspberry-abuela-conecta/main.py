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
def cargar_alertas():
    if not os.path.exists(ARCHIVO_ALERTAS):
        alertas_base = [{"medicamento": "Pastilla para la presión", "hora": "08:00"}]
        with open(ARCHIVO_ALERTAS, 'w') as archivo:
            json.dump(alertas_base, archivo, indent=4)
        return alertas_base
    with open(ARCHIVO_ALERTAS, 'r') as archivo:
        return json.load(archivo)

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
        with lock:
            mensaje_actual = payload
            alerta_activa = True
            ultimo_replay = 0
            hora_inicio_alerta = time.time()
        reproducir_audio_asincrono(mensaje_actual)
        
    elif tema == TOPIC_NUEVA_RECETA:
        try:
            nuevas_alertas = json.loads(payload)
            with open(ARCHIVO_ALERTAS, 'w') as archivo:
                json.dump(nuevas_alertas, archivo, indent=4)
            with lock:
                lista_alertas = cargar_alertas()
            print("📝 Nueva receta recibida y guardada.")
            reproducir_audio_asincrono("La receta médica ha sido actualizada.")
        except json.JSONDecodeError:
            print("❌ Error: La aplicación no envió un JSON válido.")

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
        hora_actual = datetime.now().strftime("%H:%M")

        if hora_actual != ultimo_minuto_revisado:
            with lock:
                for alerta in lista_alertas:
                    if alerta["hora"] == hora_actual:
                        medicamento_actual = alerta["medicamento"]
                        mensaje_actual = f"Hola, es hora de tomar tu medicamento: {medicamento_actual}."
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
