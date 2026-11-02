
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Keyboard,
  ScrollView,
} from 'react-native';

import {
  client,
  enviarReceta,
  isConnected,
} from '@/hooks/mqttClient';
import { guardarRecordatorio } from '@/services/remindersStorage';
import { useRouter } from 'expo-router';

const DIAS_SEMANA = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];

export default function ReminderMqttScreen() {
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [medicationType, setMedicationType] = useState('');
  const [day, setDay] = useState('');
  const [hour, setHour] = useState('17');
  const [minute, setMinute] = useState('00');
  const [connectionStatus, setConnectionStatus] = useState(isConnected());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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

  const handleSchedule = async () => {
    if (saving) return;

    Keyboard.dismiss();

    if (!day) {
      Alert.alert(
        'Falta elegir el día',
        'Seleccioná el día de la semana para este recordatorio.'
      );
      return;
    }

    if (!connectionStatus) {
      Alert.alert(
        'Sin conexión',
        'Esperá a que MQTT se conecte e intentá nuevamente.'
      );
      return;
    }

    if (!message.trim()) {
      Alert.alert(
        'Falta el mensaje',
        'Escribí qué querés recordar antes de continuar.'
      );
      return;
    }

    if (!medicationType.trim()) {
      Alert.alert(
        'Falta el tipo de medicamento',
        'Indicá qué medicamento o tratamiento corresponde al recordatorio.'
      );
      return;
    }

    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);

    if (
      hour.trim() === '' ||
      minute.trim() === '' ||
      isNaN(h) ||
      h < 0 ||
      h > 23 ||
      isNaN(m) ||
      m < 0 ||
      m > 59
    ) {
      Alert.alert(
        'Hora incorrecta',
        'Ingresá una hora válida. Por ejemplo, 17:30.'
      );
      return;
    }

    const formattedHour = String(h).padStart(2, '0');
    const formattedMinute = String(m).padStart(2, '0');

    const receta = {
      hora: `${formattedHour}:${formattedMinute}`,
      dia: day,
      tipo: medicationType.trim(),
      mensaje: message.trim(),
    };
    const recordatorioLocal = {
      ...receta,
      id: `${Date.now()}`,
    };

    setSaving(true);

    try {
      await enviarReceta(receta);

      setMessage('');
      setMedicationType('');

      try {
        await guardarRecordatorio(recordatorioLocal);
      } catch (storageError) {
        console.error('Error al guardar el historial local:', storageError);
        Alert.alert(
          'Receta enviada',
          'El broker aceptó la receta, pero no se pudo guardar en el historial de este dispositivo. No la reenvíes para evitar duplicarla.'
        );
        return;
      }

      Alert.alert(
        'Receta enviada',
        `El broker MQTT aceptó la receta para ${day} a las ${formattedHour}:${formattedMinute}. Ya aparece en el historial de este dispositivo.`
      );
    } catch (error) {
      console.error('Error al enviar la receta MQTT:', error);

      Alert.alert(
        'No se pudo enviar',
        error instanceof Error
          ? error.message
          : 'El broker MQTT no confirmó la recepción. Revisá la conexión e intentá nuevamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/screens/MenuScreen');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Nuevo recordatorio
        </Text>

        <Text style={styles.subtitle}>
          Elegí qué querés recordar y a qué hora.
        </Text>
      </View>

      {/* Estado de conexión */}
      <View style={styles.statusCard}>
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

        <Text style={styles.statusText}>
          MQTT: {connectionStatus ? 'Conectado' : 'Desconectado'}
        </Text>
      </View>

      {/* Formulario */}
      <View style={styles.card}>
        <Text style={styles.label}>Día</Text>

        <View style={styles.daysRow}>
          {DIAS_SEMANA.map((weekday) => {
            const selected = day === weekday;

            return (
              <TouchableOpacity
                key={weekday}
                style={[
                  styles.dayButton,
                  selected && styles.selectedDayButton,
                ]}
                onPress={() => setDay(weekday)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Día ${weekday}`}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    selected && styles.selectedDayButtonText,
                  ]}
                >
                  {weekday}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Tipo de medicamento</Text>

        <TextInput
          style={styles.singleLineInput}
          placeholder="Ej.: Presión"
          placeholderTextColor="#697586"
          value={medicationType}
          onChangeText={setMedicationType}
          maxLength={100}
          accessibilityLabel="Tipo de medicamento"
        />

        <Text style={[styles.label, styles.messageLabel]}>
          Mensaje para el parlante
        </Text>

        <TextInput
          style={styles.messageInput}
          placeholder="Ej.: Hola, es hora de tomar la pastilla de la presión."
          placeholderTextColor="#697586"
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          maxLength={300}
          accessibilityLabel="Texto del recordatorio"
        />

        <Text style={styles.helperText}>
          Este texto se enviará en el campo “mensaje” para que lo lea el TTS.
        </Text>

        <Text style={styles.label}>
          ¿A qué hora?
        </Text>

        <Text style={styles.timeHint}>
          Elegí la hora en formato de 24 horas.
        </Text>

        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Hora</Text>

            <TextInput
              style={styles.timeInput}
              value={hour}
              onChangeText={(value) =>
                setHour(
                  value.replace(/[^0-9]/g, '').substring(0, 2)
                )
              }
              keyboardType="number-pad"
              maxLength={2}
              placeholder="17"
              placeholderTextColor="#697586"
              selectTextOnFocus
              accessibilityLabel="Hora del recordatorio"
            />
          </View>

          <Text style={styles.timeColon}>:</Text>

          <View style={styles.timeField}>
            <Text style={styles.timeLabel}>Minutos</Text>

            <TextInput
              style={styles.timeInput}
              value={minute}
              onChangeText={(value) =>
                setMinute(
                  value.replace(/[^0-9]/g, '').substring(0, 2)
                )
              }
              keyboardType="number-pad"
              maxLength={2}
              placeholder="00"
              placeholderTextColor="#697586"
              selectTextOnFocus
              accessibilityLabel="Minutos del recordatorio"
            />
          </View>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>
            Hora seleccionada
          </Text>

          <Text style={styles.previewTime}>
            {hour || '--'}:{minute || '--'}
          </Text>
        </View>
      </View>

      {/* Guardar */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          saving && styles.disabledButton,
        ]}
        onPress={handleSchedule}
        disabled={saving}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Guardar recordatorio diario"
      >
        <Text style={styles.saveButtonText}>
          {saving ? 'Guardando...' : 'Guardar recordatorio'}
        </Text>
      </TouchableOpacity>

      {/* Volver */}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },

  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 45,
    paddingBottom: 35,
    justifyContent: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 26,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 21,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 30,
  },

  statusCard: {
    minHeight: 64,
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

  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#17365D',
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    padding: 22,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  label: {
    fontSize: 23,
    fontWeight: '700',
    color: '#17365D',
    marginBottom: 14,
  },

  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },

  dayButton: {
    width: '31%',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#C8D5E5',
    borderRadius: 10,
    paddingHorizontal: 6,
  },

  selectedDayButton: {
    backgroundColor: '#17365D',
    borderColor: '#17365D',
  },

  dayButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#17365D',
  },

  selectedDayButtonText: {
    color: '#FFFFFF',
  },

  singleLineInput: {
    minHeight: 64,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#C8D5E5',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 21,
    color: '#172B4D',
    marginBottom: 20,
  },

  messageLabel: {
    marginTop: 4,
  },

  messageInput: {
    minHeight: 115,
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#C8D5E5',
    borderRadius: 14,
    padding: 16,
    fontSize: 21,
    lineHeight: 30,
    color: '#172B4D',
  },

  helperText: {
    fontSize: 17,
    color: '#43536A',
    lineHeight: 25,
    marginTop: 10,
    marginBottom: 28,
  },

  timeHint: {
    fontSize: 18,
    lineHeight: 26,
    color: '#43536A',
    marginTop: -4,
    marginBottom: 20,
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  timeField: {
    alignItems: 'center',
  },

  timeLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#43536A',
    marginBottom: 10,
  },

  timeInput: {
    width: 90,
    height: 76,
    backgroundColor: '#F4F7FB',
    borderWidth: 2,
    borderColor: '#C8D5E5',
    borderRadius: 14,
    fontSize: 30,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    padding: 8,
  },

  timeColon: {
    fontSize: 34,
    fontWeight: '700',
    color: '#17365D',
    marginHorizontal: 16,
    marginTop: 26,
  },

  preview: {
    backgroundColor: '#EDF3FA',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },

  previewLabel: {
    fontSize: 18,
    color: '#43536A',
    marginBottom: 6,
  },

  previewTime: {
    fontSize: 32,
    fontWeight: '700',
    color: '#17365D',
  },

  saveButton: {
    minHeight: 76,
    backgroundColor: '#17365D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
  },

  disabledButton: {
    backgroundColor: '#718096',
  },

  saveButtonText: {
    fontSize: 22,
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
