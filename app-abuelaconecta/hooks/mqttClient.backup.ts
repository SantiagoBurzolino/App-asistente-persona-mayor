import * as Notifications from 'expo-notifications';
import mqtt from 'mqtt';
import { Alert } from 'react-native';

// --- Configuración de Notificaciones de Expo ---
// 1. Manejador para permitir que las notificaciones se muestren mientras la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, // Mostrar la notificación emergente/banner
    shouldShowList: true,   // Mostrar la notificación en la lista de notificaciones
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// 2. Canal de notificación para Android: establece la máxima prioridad (MAX)
Notifications.setNotificationChannelAsync('mqtt-alerts', {
  name: 'Alertas MQTT de Abuela',
  importance: Notifications.AndroidImportance.MAX, // IMPORTANCIA MÁXIMA para pop-ups
  vibrationPattern: [0, 250, 250, 250], 
  lightColor: '#FF231F7C',
});

// --- Configuración MQTT ---
const BROKER = '10.56.31.31';
const PORT_WS = 9015; // Puerto para WebSockets

const TOPIC_MENSAJE = 'abuela/mensaje';
const TOPIC_CONFIRMACION = 'abuela/confirmacion';
const TOPIC_ALERTA = 'abuela/alerta';

// Conexión usando WebSockets
const client = mqtt.connect(`ws://${BROKER}:${PORT_WS}`);

export { client };
export const isConnected = () => client.connected;
// ----------------------------------------------------

// Función para enviar una notificación local 
/**
 * @param {string} title
 * @param {string} body
 */
async function scheduleLocalNotification(title, body) {
  // 1. SOLICITUD DE PERMISOS: Aquí se le pide al celular el permiso si no lo tiene
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.log('Permiso de notificación no concedido. Usando Alert.alert.');
    Alert.alert(title, body); 
    return;
  }
  
  // La prioridad MAX está establecida en el canal 'mqtt-alerts' al inicio del archivo.

  // Programa la notificación para que aparezca en 1 segundo
  await Notifications.scheduleNotificationAsync({
    content: {
      title: title,
      body: body,
      sound: true,
      // Especificamos el canal aquí para que Android aplique la prioridad MAX
      channelId: 'mqtt-alerts', 
    },
    trigger: { 
        seconds: 1, // El trigger solo necesita el tiempo de retardo
    }, 
  });
}

// Conexión exitosa
client.on('connect', () => {
  console.log('✅ Conectado al broker MQTT via WebSockets');
  
  // Suscripción a los tópicos de respuesta
  /**
   * @param {Error} err
   */
  client.subscribe([TOPIC_CONFIRMACION, TOPIC_ALERTA], (err) => {
    if (err) {
      console.log('❌ Error al suscribirse:', err);
    } else {
      console.log('📡 Suscripción exitosa a los topics');
    }
  });
});

// Error de conexión
/**
 * @param {Error} err
 */
client.on('error', (err) => {
  console.log('❌ Error de conexión MQTT:', err);
});

client.on('close', () => {
  console.log('🔌 Desconectado del broker MQTT');
});

// Función para enviar mensaje 
export function enviarMensaje(mensaje) {
  if (client.connected) {
    client.publish(TOPIC_MENSAJE, mensaje, (error) => {
      if (error) {
        console.log('❌ Error al enviar mensaje:', error);
        Alert.alert('Error', 'No se pudo enviar el mensaje');
      } else {
        console.log('✅ Mensaje enviado:', mensaje);
      }
    });
  } else {
    console.log('⚠️ Intento de enviar sin conexión MQTT');
    Alert.alert('Error', 'No estás conectado al servidor MQTT');
  }
}

// Función para escuchar mensajes de confirmación o alerta 
export function escucharMensajes() {
  /**
   * @param {string} topic
   * @param {Buffer} message
   */
  client.on('message', (topic, message) => {
    const msg = message.toString();
    
    if (topic === TOPIC_CONFIRMACION) {
      console.log('📩 Confirmación recibida:', msg);
      // Notificación estándar
      scheduleLocalNotification('✅ Confirmación Recibida', msg); 
    } else if (topic === TOPIC_ALERTA) {
      console.log('🚨 Alerta recibida:', msg);
      // Notificación de ALTA PRIORIDAD (la que quieres que aparezca como pop-up)
      scheduleLocalNotification('🚨 ¡Alerta!', msg); 
    }
  });
}

// Función para desconectar
export function desconectar() {
  client.end(() => {
    console.log('🔌 Desconectado del broker MQTT');
    Alert.alert('Desconectado', 'Se cerró la conexión con el servidor MQTT');
  });}