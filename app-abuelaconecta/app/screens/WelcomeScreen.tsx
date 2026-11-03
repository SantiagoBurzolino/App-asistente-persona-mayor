import { client, enviarMensaje, escucharMensajes, isConnected } from '@/hooks/mqttClient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function MessageScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(isConnected());
  
  // 👈 NUEVO ESTADO: Para manejar el tiempo de espera del botón (debounce)
  const [isSending, setIsSending] = useState(false); 

  // Escuchar mensajes MQTT y estado de conexión al montar
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

  const handleSendMessage = async () => {
    // 👈 Comprobación adicional: Si el botón está desactivado o la app está enviando, salimos.
    if (!connectionStatus || isSending) {
      if (!connectionStatus) Alert.alert("Error", "Esperando conexión con el servidor...");
      return;
    }

    if (!message.trim()) return;

    setIsSending(true);
    try {
      await enviarMensaje(message.trim());
      setMessage("");
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        router.push('/screens/MenuScreen');
      }, 2000);
    } catch (error) {
      Alert.alert(
        "Error al enviar",
        error instanceof Error ? error.message : "No se pudo enviar el mensaje."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  // El botón estará deshabilitado si NO hay conexión O si isSending es TRUE
  const buttonDisabled = !connectionStatus || isSending;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backButtonText}>← atrás</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Mensaje</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={message}
          onChangeText={setMessage}
          placeholder="Escribe el mensaje"
          placeholderTextColor="#999"
          multiline
        />
      </View>

      {/* Botón dinámico */}
      <TouchableOpacity
        style={[styles.sendButton, buttonDisabled && styles.sendButtonDisabled]}
        onPress={handleSendMessage}
        disabled={buttonDisabled} // Usamos la nueva variable de estado combinado
      >
        <Text style={styles.sendButtonText}>
          {/* Mostramos 'Enviando...' o 'Conectando...' o 'Enviar' */}
          {isSending ? "Enviando..." : (connectionStatus ? "Enviar" : "Conectando...")}
        </Text>
      </TouchableOpacity>

      {showSuccess && <Text style={styles.successText}>Se envió el mensaje</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1033a3", padding: 24 },
  backButton: { backgroundColor: "#000", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, alignSelf: "flex-start", marginBottom: 24 },
  backButtonText: { color: "#fff", fontSize: 14 },
  title: { fontSize: 24, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 24 },
  inputContainer: { backgroundColor: "#fff", borderRadius: 8, padding: 24, marginBottom: 24 },
  textInput: { fontSize: 18, backgroundColor: "#f5f5f5", padding: 16, borderRadius: 4, minHeight: 100, textAlignVertical: "top" },
  sendButton: { backgroundColor: "#000", padding: 16, borderRadius: 8, alignItems: "center" },
  sendButtonDisabled: {
    backgroundColor: "#555", 
  },
  sendButtonText: { color: "#fff", fontSize: 20, fontWeight: "600" },
  successText: { color: "#0f0", fontSize: 20, fontWeight: "bold", textAlign: "center", marginTop: 16 },
});