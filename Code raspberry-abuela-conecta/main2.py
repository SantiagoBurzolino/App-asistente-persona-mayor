import paho.mqtt.client as mqtt
import os
import json
import hashlib
import shutil
import sys
import RPi.GPIO as GPIO
import time
from datetime import datetime
import threading
import subprocess
from pathlib import Path
from piper import PiperVoice
import wave

# --- 1. CONFIGURACIÓN GENERAL ---
BROKER = "10.56.31.31"
PORT = 1883
TOPIC_MENSAJE = "abuela/mensaje"
TOPIC_NUEVA_RECETA = "abuela/receta"
TOPIC_ESTADO_RECETA = "abuela/receta/estado"
TOPIC_CONFIRMACION = "abuela/confirmacion"
TOPIC_HISTORIAL_CONFIRMACIONES = "abuela/confirmaciones/historial"
TOPIC_ALERTA = "abuela/alerta"
DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

DIRECTORIO_APP = Path(__file__).resolve().parent
ARCHIVO_ALERTAS = DIRECTORIO_APP / "alertas.json"
ARCHIVO_CONFIRMACIONES = DIRECTORIO_APP / "confirmaciones.json"
DIRECTORIO_AUDIO = DIRECTORIO_APP / "audio_recordatorios"
MODELO_PIPER = DIRECTORIO_APP / "voices" / "es_ES-carlfm-x_low.onnx"
CONFIG_PIPER = Path(f"{MODELO_PIPER}.json")
voz_piper = None

# --- CONFIGURACIÓN PIPER ---
PIPER_BINARIO = str(DIRECTORIO_APP / ".venv" / "bin" / "piper")

if not os.path.isfile(PIPER_BINARIO):
    raise RuntimeError(f"No se encontró Piper: {PIPER_BINARIO}")

COMANDO_PIPER = [PIPER_BINARIO]

print(f"🔊 Piper encontrado en: {PIPER_BINARIO}")
# --- CONFIGURACIÓN DE AUDIO ---
REPRODUCTOR_AUDIO = shutil.which("aplay")
DISPOSITIVO_AUDIO = "plughw:1,0"

if not REPRODUCTOR_AUDIO:
    raise RuntimeError("No se encontró aplay. Instala alsa-utils.")

print(f"🔊 Reproductor: {REPRODUCTOR_AUDIO}")
print(f"🔊 Salida de audio: {DISPOSITIVO_AUDIO}")
# Pines físicos (20 y 21 en modo BCM)
BOTON_CONFIRMACION = 20  
BOTON_ALERTA = 21        

# --- 2. CONFIGURACIÓN GPIO ---
print("DEBUG: Iniciando configuración GPIO", flush=True)
GPIO.setmode(GPIO.BCM)
GPIO.setup(BOTON_ALERTA, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(BOTON_CONFIRMACION, GPIO.IN, pull_up_down=GPIO.PUD_UP)
print("DEBUG: GPIO configurado correctamente", flush=True)
# --- 3. VARIABLES GLOBALES ---
lock = threading.Lock()
alerta_activa = False
mensaje_actual = ""
ultimo_replay = 0
medicamento_actual = ""
hora_inicio_alerta = 0
proceso_audio = None
audio_lock = threading.Lock()
sintesis_lock = threading.Lock()

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

    dias_recibidos = alerta.get("dias")
    if dias_recibidos is None:
        dia_anterior = str(alerta.get("dia") or "").strip()
        dias_recibidos = [dia_anterior] if dia_anterior else DIAS_SEMANA
    elif isinstance(dias_recibidos, str):
        dias_recibidos = [dias_recibidos]
    if not isinstance(dias_recibidos, list):
        return None

    dias_por_nombre = {dia.casefold(): dia for dia in DIAS_SEMANA}
    dias = []
    for dia_recibido in dias_recibidos:
        dia = dias_por_nombre.get(str(dia_recibido).strip().casefold())
        if dia is None:
            return None
        if dia not in dias:
            dias.append(dia)
    if not dias:
        dias = DIAS_SEMANA.copy()

    return {
        "hora": hora,
        "dias": dias,
        "tipo": str(alerta.get("tipo") or alerta.get("medicamento") or "").strip(),
        "mensaje": str(alerta.get("mensaje") or "").strip(),
    }


def cargar_alertas():
    if not os.path.exists(ARCHIVO_ALERTAS):
        alertas_base = [{
            "hora": "08:00",
            "dias": DIAS_SEMANA.copy(),
            "tipo": "Pastilla para la presión",
            "mensaje": "Hola, es hora de tomar tu medicamento para la presión.",
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

print("DEBUG: Cargando alertas", flush=True)
lista_alertas = cargar_alertas()


def cargar_confirmaciones():
    if not ARCHIVO_CONFIRMACIONES.exists():
        with open(ARCHIVO_CONFIRMACIONES, "w", encoding="utf-8") as archivo:
            json.dump([], archivo)
        return []

    try:
        with open(ARCHIVO_CONFIRMACIONES, "r", encoding="utf-8") as archivo:
            datos = json.load(archivo)
    except (json.JSONDecodeError, OSError) as error:
        print(f"⚠️ No se pudo leer el historial local: {error}")
        return []

    return datos if isinstance(datos, list) else []

print("DEBUG: Cargando confirmaciones", flush=True)
lista_confirmaciones = cargar_confirmaciones()
print("DEBUG: Confirmaciones cargadas correctamente", flush=True)

def publicar_historial_confirmaciones(cliente):
    try:
        cliente.publish(
            TOPIC_HISTORIAL_CONFIRMACIONES,
            json.dumps(lista_confirmaciones, ensure_ascii=False),
            qos=1,
            retain=True,
        )
    except Exception as error:
        print(f"⚠️ No se pudo sincronizar el historial MQTT: {error}")


def publicar_estado_receta(cliente, solicitud_id, ok, error=""):
    if not solicitud_id:
        return
    cliente.publish(
        TOPIC_ESTADO_RECETA,
        json.dumps({"id": solicitud_id, "ok": ok, "error": error}, ensure_ascii=False),
        qos=1,
    )


def guardar_confirmaciones():
    with open(ARCHIVO_CONFIRMACIONES, "w", encoding="utf-8") as archivo:
        json.dump(lista_confirmaciones, archivo, indent=2, ensure_ascii=False)


def ruta_audio_recordatorio(texto):
    nombre = hashlib.sha256(texto.encode("utf-8")).hexdigest()
    return DIRECTORIO_AUDIO / f"{nombre}.wav"

def cargar_audio():
    global voz_piper

    if not MODELO_PIPER.is_file() or not CONFIG_PIPER.is_file():
        raise FileNotFoundError(
            f"Falta el modelo Piper o su configuración: {MODELO_PIPER}"
        )

    print("🔊 Cargando modelo Piper en memoria...", flush=True)

    inicio = time.time()

    voz_piper = PiperVoice.load(
        str(MODELO_PIPER),
        config_path=str(CONFIG_PIPER)
    )

    print(
        f"✅ Modelo Piper cargado en {time.time() - inicio:.2f} segundos.",
        flush=True
    )

def generar_audio(texto, destino):
    global voz_piper

    if voz_piper is None:
        raise RuntimeError("El modelo Piper no está cargado.")

    if not texto or not texto.strip():
        raise ValueError("No se puede generar audio vacío.")

    DIRECTORIO_AUDIO.mkdir(parents=True, exist_ok=True)

    temporal = destino.with_name(
        f".{destino.stem}.{threading.get_ident()}.wav"
    )

    try:
        with sintesis_lock:
            with wave.open(str(temporal), "wb") as archivo:
                voz_piper.synthesize_wav(
                    texto.strip(),
                    archivo
                )

        if not temporal.is_file() or temporal.stat().st_size <= 44:
            raise RuntimeError("Piper no generó un WAV válido.")

        os.replace(temporal, destino)

    finally:
        if temporal.exists():
            temporal.unlink()

def detener_audio_actual():
    global proceso_audio

    if proceso_audio is not None:
        if proceso_audio.poll() is None:
            print("⏹️ Deteniendo audio anterior...", flush=True)
            proceso_audio.terminate()

            try:
                proceso_audio.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proceso_audio.kill()
                proceso_audio.wait()

        proceso_audio = None

def reproducir_archivo_asincrono(ruta):
    global proceso_audio

    if not REPRODUCTOR_AUDIO:
        print("❌ No se encontró aplay.")
        return

    if not ruta.is_file():
        print(f"❌ No existe el audio: {ruta}")
        return

    with audio_lock:
        detener_audio_actual()

        print(f"🔊 Reproduciendo: {ruta}", flush=True)

        proceso_audio = subprocess.Popen(
            [
                REPRODUCTOR_AUDIO,
                "-D", DISPOSITIVO_AUDIO,
                "-q",
                str(ruta)
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )

def preparar_audios_recordatorios(alertas):
    for alerta in alertas:
        texto = alerta["mensaje"]
        if not texto:
            continue
        ruta = ruta_audio_recordatorio(texto)
        if not ruta.exists():
            try:
                generar_audio(texto, ruta)
            except (OSError, RuntimeError, subprocess.SubprocessError) as error:
                print(f"⚠️ No se pudo preparar el audio offline: {error}")


def registrar_confirmacion(cliente, medicamento):
    ahora = datetime.now().astimezone()
    registro = {
        "medicamento": medicamento,
        "fecha_hora": ahora.isoformat(timespec="seconds"),
    }
    with lock:
        lista_confirmaciones.append(registro)
        try:
            guardar_confirmaciones()
        except OSError as error:
            print(f"⚠️ No se pudo guardar la confirmación local: {error}")
        historial = json.dumps(lista_confirmaciones, ensure_ascii=False)

    try:
        cliente.publish(TOPIC_CONFIRMACION, json.dumps(registro, ensure_ascii=False), qos=1)
        cliente.publish(TOPIC_HISTORIAL_CONFIRMACIONES, historial, qos=1, retain=True)
    except Exception as error:
        print(f"⚠️ Confirmación guardada localmente; no se pudo publicar: {error}")



def reproducir_audio_asincrono(texto):
    global proceso_audio

    if not texto.strip():
        return

    def tarea_audio():
        global proceso_audio

        try:
            ruta = ruta_audio_recordatorio(texto)

            with audio_lock:
                detener_audio_actual()

                # Si el audio ya existe, no usamos Piper nuevamente.
                if not ruta.exists():
                    print("🔊 Generando audio por primera vez...", flush=True)
                    generar_audio(texto, ruta)
                else:
                    print("⚡ Usando audio guardado en caché...", flush=True)

                print("🔊 Reproduciendo...", flush=True)

                proceso_audio = subprocess.Popen(
                    [
                        REPRODUCTOR_AUDIO,
                        "-D", DISPOSITIVO_AUDIO,
                        "-q",
                        str(ruta)
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE
                )

                _, error = proceso_audio.communicate(timeout=120)

                if proceso_audio.returncode != 0:
                    print(
                        f"❌ Error ALSA: {error.decode(errors='replace')}",
                        flush=True
                    )
                else:
                    print("✅ Audio reproducido.", flush=True)

                proceso_audio = None

        except Exception as error:
            print(f"❌ Error de audio: {error}", flush=True)

    threading.Thread(target=tarea_audio, daemon=True).start()

# --- 5. FUNCIONES DE BOTONES ---
def enviar_confirmacion(cliente):
    global alerta_activa, medicamento_actual, proceso_audio
    with lock:
        if not alerta_activa:
            return
        alerta_activa = False
        if proceso_audio and proceso_audio.poll() is None:
            proceso_audio.terminate()
        medicamento_confirmado = medicamento_actual
        fecha_confirmacion = datetime.now().astimezone()
        mensaje_confirmacion = (
            f"La medicación {medicamento_confirmado} fue confirmada "
            f"el {fecha_confirmacion.strftime('%d/%m/%Y a las %H:%M')}."
        )
        medicamento_actual = "" 

    print("🟢 " + mensaje_confirmacion)
    registrar_confirmacion(cliente, medicamento_confirmado)
    reproducir_audio_asincrono("Confirmado. Que tengas un buen día.")

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
        client.subscribe([
            (TOPIC_MENSAJE, 0),
            (TOPIC_NUEVA_RECETA, 0),
        ])
        publicar_historial_confirmaciones(client)
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
        solicitud_id = None
        try:
            recibidas = json.loads(payload)
            if isinstance(recibidas, dict):
                solicitud_id = str(recibidas.get("id") or "")
            reemplazar_lista = isinstance(recibidas, list)
            if isinstance(recibidas, dict):
                recibidas = [recibidas]
            elif not reemplazar_lista:
                raise ValueError("La receta debe ser un objeto o una lista de objetos.")

            alertas_recibidas = [normalizar_alerta(item) for item in recibidas]
            if not alertas_recibidas or any(alerta is None for alerta in alertas_recibidas):
                raise ValueError("La receta contiene datos inválidos.")

            for alerta in alertas_recibidas:
                if alerta["mensaje"]:
                    ruta_audio = ruta_audio_recordatorio(alerta["mensaje"])
                    if not ruta_audio.exists():
                        generar_audio(alerta["mensaje"], ruta_audio)

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
            publicar_estado_receta(client, solicitud_id, True)
            if hubo_novedad:
                print("📝 Nuevo recordatorio recibido y guardado.")
                reproducir_audio_asincrono("Llegó un nuevo recordatorio.")
            else:
                print("ℹ️ El recordatorio recibido ya estaba guardado.")
        except (json.JSONDecodeError, ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
            print(f"❌ No se pudo guardar la receta: {error}")
            publicar_estado_receta(client, solicitud_id, False, str(error))

# --- 7. INICIO MQTT ---

# Cargar Piper una sola vez al iniciar el programa
cargar_audio()

print("DEBUG: Entrando en sección MQTT", flush=True)

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1)
client.on_connect = on_connect
client.on_message = on_message

print("🔌 Conectando al broker MQTT...", flush=True)

try:
    client.connect(BROKER, PORT, 60)
    print("✅ Conexión inicial con el broker realizada.", flush=True)

    client.loop_start()
    print("✅ Cliente MQTT iniciado.", flush=True)

except Exception as e:
    print(f"❌ Error de conexión MQTT: {repr(e)}", flush=True)

# Preparar audios en segundo plano para no bloquear MQTT
print("🔊 Iniciando preparación de audios...", flush=True)

hilo_audio = threading.Thread(
    target=preparar_audios_recordatorios,
    args=(lista_alertas,),
    daemon=True
)
hilo_audio.start()
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
                    if alerta["hora"] == hora_actual and dia_actual in alerta["dias"]:
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
                    reproducir_archivo_asincrono(
                        ruta_audio_recordatorio(mensaje_actual)
                    )
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
