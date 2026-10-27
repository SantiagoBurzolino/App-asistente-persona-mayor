import mqtt from 'mqtt';
import { Alert } from 'react-native';
import Constants from 'expo-constants';

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
// CONFIGURACIÓN MQTT
// ============================================================

const BROKER = '10.56.31.31';
const PORT_WS = 1095;

const TOPIC_MENSAJE = 'abuela/mensaje';
const TOPIC_CONFIRMACION = 'abuela/confirmacion';
const TOPIC_ALERTA = 'abuela/alerta';

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
        channelId: 'mqtt-alerts',
      },
      trigger: {
        seconds: 1,
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
    [TOPIC_CONFIRMACION, TOPIC_ALERTA],
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

export function enviarMensaje(mensaje: string) {
  if (client.connected) {

    client.publish(
      TOPIC_MENSAJE,
      mensaje,
      (error) => {

        if (error) {
          console.log(
            '❌ Error al enviar mensaje:',
            error
          );

          Alert.alert(
            'Error',
            'No se pudo enviar el mensaje'
          );

        } else {
          console.log(
            '✅ Mensaje enviado:',
            mensaje
          );
        }
      }
    );

  } else {

    console.log(
      '⚠️ Intento de enviar sin conexión MQTT'
    );

    Alert.alert(
      'Error',
      'No estás conectado al servidor MQTT'
    );
  }
}

// ============================================================
// ESCUCHAR MENSAJES
// ============================================================

export function escucharMensajes() {

  client.on(
    'message',
    (topic, message) => {

      const msg = message.toString();

      // Mensaje de confirmación
      if (topic === TOPIC_CONFIRMACION) {

        console.log(
          '📩 Confirmación recibida:',
          msg
        );

        scheduleLocalNotification(
          '✅ Confirmación Recibida',
          msg
        );

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
