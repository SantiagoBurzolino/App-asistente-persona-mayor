
import {
  client,
  enviarMensaje,
  escucharMensajes,
  isConnected,
} from '@/hooks/mqttClient';

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MessageScreen() {
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(isConnected());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    escucharMensajes();

    const onConnect = () => setConnectionStatus(true);
    const onClose = () => setConnectionStatus(false);
    const onError = () => setConnectionStatus(false);

    client.on('connect', onConnect);
    client.on('close', onClose);
    client.on('error', onError);

    return () => {
      client.removeListener('connect', onConnect);
      client.removeListener('close', onClose);
      client.removeListener('error', onError);
    };
  }, []);

  const handleSendMessage = () => {
    if (!connectionStatus) {
      Alert.alert(
        'Sin conexión',
        'Estamos intentando conectar con el servidor. Inténtalo nuevamente en unos segundos.'
      );
      return;
    }

    if (!message.trim()) {
      Alert.alert(
        'Mensaje vacío',
        'Por favor, escribe un mensaje antes de enviarlo.'
      );
      return;
    }

    if (sending) return;

    setSending(true);

    try {
      enviarMensaje(message.trim());
      setMessage('');
      setShowSuccess(true);

      setTimeout(() => setShowSuccess(false), 3000);
      setTimeout(() => setSending(false), 1500);
    } catch (error) {
      setSending(false);

      Alert.alert(
        'Error al enviar',
        'No se pudo enviar el mensaje. Inténtalo nuevamente.'
      );
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>Enviar mensaje</Text>

        <Text style={styles.subtitle}>
          Escribe algo bonito para tus seres queridos
        </Text>
      </View>

      {/* Estado de conexión */}
      <View style={styles.connectionCard}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: connectionStatus
                ? '#238636'
                : '#C62828',
            },
          ]}
        />

        <Text style={styles.connectionText}>
          {connectionStatus
            ? 'Conexión disponible'
            : 'Conectando al servidor...'}
        </Text>
      </View>

      {/* Área para escribir */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>
          Tu mensaje
        </Text>

        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Escribe aquí tu mensaje..."
          placeholderTextColor="#697586"
          multiline
          textAlignVertical="top"
          accessibilityLabel="Escribe tu mensaje"
          accessibilityHint="Escribe el texto que deseas enviar"
          maxLength={500}
        />

        <Text style={styles.charCount}>
          {message.length}/500 caracteres
        </Text>
      </View>

      {/* Confirmación de envío */}
      {showSuccess && (
        <View
          style={styles.successCard}
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.successText}>
            ✓ Mensaje enviado
          </Text>
        </View>
      )}

      {/* Botón de envío */}
      <TouchableOpacity
        style={[
          styles.sendButton,
          (!connectionStatus || sending) &&
            styles.sendButtonDisabled,
        ]}
        onPress={handleSendMessage}
        disabled={!connectionStatus || sending}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
      >
        <Text style={styles.sendButtonText}>
          {sending
            ? 'Enviando...'
            : connectionStatus
              ? 'Enviar mensaje'
              : 'Esperando conexión...'}
        </Text>
      </TouchableOpacity>

      {/* Volver al menú */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Volver atrás"
      >
        <Text style={styles.backButtonText}>
          ←  Volver
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 24,
    paddingTop: 55,
    paddingBottom: 30,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 28,
  },

  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 21,
    lineHeight: 30,
    color: '#43536A',
    textAlign: 'center',
  },

  connectionCard: {
    minHeight: 65,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    paddingHorizontal: 18,
    marginBottom: 22,
  },

  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 14,
  },

  connectionText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '600',
    color: '#17365D',
  },

  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  inputLabel: {
    fontSize: 24,
    fontWeight: '700',
    color: '#17365D',
    marginBottom: 16,
  },

  textInput: {
    minHeight: 170,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#C8D5E5',
    borderRadius: 14,
    padding: 18,
    fontSize: 22,
    lineHeight: 32,
    color: '#172B4D',
  },

  charCount: {
    fontSize: 16,
    color: '#43536A',
    textAlign: 'right',
    marginTop: 12,
  },

  successCard: {
    backgroundColor: '#E7F5EA',
    borderColor: '#238636',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },

  successText: {
    fontSize: 21,
    fontWeight: '700',
    color: '#17652A',
    textAlign: 'center',
  },

  sendButton: {
    minHeight: 76,
    backgroundColor: '#17365D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },

  sendButtonDisabled: {
    backgroundColor: '#718096',
  },

  sendButtonText: {
    fontSize: 23,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  backButton: {
    minHeight: 66,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#17365D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  backButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#17365D',
    textAlign: 'center',
  },
});
