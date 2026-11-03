import mqtt from 'mqtt';
import { Alert } from 'react-native';
import Constants from 'expo-constants';
import { guardarHistorialConfirmaciones } from '@/services/confirmationsStorage';

// ============================================================
// CONFIGURACIÓN
// ============================================================

// Detectamos si la aplicación está ejecutándose dentro de Expo Go.
const usandoExpoGo = Constants.appOwnership === 'expo';

// expo-notifications se carga solamente cuando NO estamos
// usando Expo Go.
let Notifications: typeof import('expo-notifications') | null = null;

async function cargarNotificaciones() {
  if (usandoExpoGo) {
    return false;
  }

  if (!Notifications) {
    Notifications = await import('expo-notifications');
  }

  return true;
}

// ============================================================
// CONFIGURACIÓN MQTTs
// ============================================================

const BROKER = '10.56.31.31';
const PORT_WS = 9015;

const TOPIC_MENSAJE = 'abuela/mensaje';
const TOPIC_RECETA = 'abuela/receta';
const TOPIC_ESTADO_RECETA = 'abuela/receta/estado';
const TOPIC_CONFIRMACION = 'abuela/confirmacion';
const TOPIC_HISTORIAL_CONFIRMACIONES = 'abuela/confirmaciones/historial';
const TOPIC_ALERTA = 'abuela/alerta';

let escuchasRegistradas = false;

export interface PayloadReceta {
  id: string;
  hora: string;
  dias: string[];
  tipo: string;
  mensaje: string;
}

// Conexión mediante WebSockets
const client = mqtt.connect({ protocol: 'ws', host: BROKER, port: PORT_WS });

export { client };

export const isConnected = () => client.connected;

// ============================================================
// NOTIFICACIONES
// ============================================================

async function scheduleLocalNotification(
  title: string,
  body: string
) {
  // ----------------------------------------------------------
  // EXPO GO
  // ----------------------------------------------------------

  // Expo Go no permite utilizar expo-notifications
  // para este funcionamiento.
  //
  // Por eso mostramos una alerta normal.
  if (usandoExpoGo) {
    Alert.alert(title, body);
    return;
  }

  // ----------------------------------------------------------
  // DEVELOPMENT BUILD
  // ----------------------------------------------------------

  try {
    const disponible = await cargarNotificaciones();

    if (!disponible || !Notifications) {
      Alert.alert(title, body);
      return;
    }

    // Pedimos permiso para mostrar notificaciones.
    const { status } =
      await Notifications.requestPermissionsAsync();

    if (status !== 'granted') {
      console.log(
        'Permiso de notificación no concedido.'
      );

      Alert.alert(title, body);
      return;
    }

    // Configuramos el canal de Android.
    await Notifications.setNotificationChannelAsync(
      'mqtt-alerts',
      {
        name: 'Alertas MQTT de Abuela',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }
    );

    // Configuramos cómo se muestra la notificación.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Programamos la notificación.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: 'mqtt-alerts',
      },
    });

  } catch (error) {
    console.log(
      'No se pudo mostrar la notificación:',
      error
    );

    // Si falla la notificación, mostramos una alerta.
    Alert.alert(title, body);
  }
}

// ============================================================
// CONEXIÓN MQTT
// ============================================================

client.on('connect', () => {
  console.log(
    '✅ Conectado al broker MQTT via WebSockets'
  );

  client.subscribe(
    [
      TOPIC_CONFIRMACION,
      TOPIC_ALERTA,
      TOPIC_HISTORIAL_CONFIRMACIONES,
      TOPIC_ESTADO_RECETA,
    ],
    (err) => {
      if (err) {
        console.log(
          '❌ Error al suscribirse:',
          err
        );
      } else {
        console.log(
          '📡 Suscripción exitosa a los topics'
        );
      }
    }
  );
});

// ============================================================
// ERROR DE MQTT
// ============================================================

client.on('error', (err) => {
  console.log(
    '❌ Error de conexión MQTT:',
    err
  );
});

// ============================================================
// DESCONEXIÓN
// ============================================================

client.on('close', () => {
  console.log(
    '🔌 Desconectado del broker MQTT'
  );
});

// ============================================================
// ENVIAR MENSAJE
// ============================================================

export function enviarMensaje(mensaje: string): Promise<void> {
  if (!client.connected) {
    return Promise.reject(
      new Error('No estás conectado al servidor MQTT')
    );
  }

  return new Promise((resolve, reject) => {
    client.publish(
      TOPIC_MENSAJE,
      mensaje,
      { qos: 1 },
      (error) => {
        if (error) {
          console.log('❌ Error al enviar mensaje:', error);
          reject(error);
        } else {
          console.log('✅ Mensaje enviado:', mensaje);
          resolve();
        }
      }
    );
  });
}

export function enviarReceta(receta: PayloadReceta): Promise<void> {
  if (!client.connected) {
    return Promise.reject(
      new Error('No estás conectado al servidor MQTT')
    );
  }

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timeout);
      client.removeListener('message', onEstadoReceta);
    };
    const onEstadoReceta = (topic: string, payload: Buffer) => {
      if (topic !== TOPIC_ESTADO_RECETA) return;

      try {
        const status = JSON.parse(payload.toString()) as {
          id?: string;
          ok?: boolean;
          error?: string;
        };
        if (status.id !== receta.id) return;

        cleanup();
        if (status.ok) {
          resolve();
        } else {
          reject(new Error(status.error || 'La Raspberry no pudo guardar el recordatorio.'));
        }
      } catch (error) {
        console.log('Acuse de receta MQTT inválido:', error);
      }
    };

    client.on('message', onEstadoReceta);
    timeout = setTimeout(() => {
      cleanup();
      reject(new Error('La Raspberry no confirmó el recordatorio. Verificá que main2.py esté activo.'));
    }, 60000);

    client.publish(
      TOPIC_RECETA,
      JSON.stringify(receta),
      { qos: 1 },
      (error) => {
        if (error) {
          cleanup();
          reject(error);
        }
      }
    );
  });
}

// ============================================================
// ESCUCHAR MENSAJES
// ============================================================

export function escucharMensajes() {
  if (escuchasRegistradas) return;
  escuchasRegistradas = true;

  client.on(
    'message',
    (topic, message) => {

      const msg = message.toString();

      if (topic === TOPIC_HISTORIAL_CONFIRMACIONES) {
        try {
          const history = JSON.parse(msg);
          if (Array.isArray(history)) {
            void guardarHistorialConfirmaciones(history).catch((error) => {
              console.log('No se pudo guardar el historial recibido:', error);
            });
          }
        } catch (error) {
          console.log('El historial MQTT recibido no es JSON válido:', error);
        }
        return;
      }

      // Mensaje de confirmación
      if (topic === TOPIC_CONFIRMACION) {

        console.log(
          '📩 Confirmación recibida:',
          msg
        );

        let body = msg;
        try {
          const confirmation = JSON.parse(msg) as {
            medicamento?: string;
            fecha_hora?: string;
          };
          if (confirmation.medicamento && confirmation.fecha_hora) {
            body = `${confirmation.medicamento} confirmado: ${confirmation.fecha_hora}`;
          }
        } catch {
          // Mantiene el texto plano enviado por versiones anteriores de la Raspberry.
        }

        scheduleLocalNotification('✅ Confirmación recibida', body);

      // Alerta
      } else if (topic === TOPIC_ALERTA) {

        console.log(
          '🚨 Alerta recibida:',
          msg
        );

        scheduleLocalNotification(
          '🚨 ¡Alerta!',
          msg
        );
      }
    }
  );
}

// ============================================================
// DESCONECTAR
// ============================================================

export function desconectar() {

  client.end(() => {

    console.log(
      '🔌 Desconectado del broker MQTT'
    );

    Alert.alert(
      'Desconectado',
      'Se cerró la conexión con el servidor MQTT'
    );
  });
}

escucharMensajes();
