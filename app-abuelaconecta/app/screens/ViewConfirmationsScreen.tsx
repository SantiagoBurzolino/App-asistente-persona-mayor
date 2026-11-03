import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { client, isConnected } from '@/hooks/mqttClient';
import {
  ConfirmationRecord,
  obtenerHistorialConfirmaciones,
} from '@/services/confirmationsStorage';

const TOPIC_HISTORIAL_CONFIRMACIONES = 'abuela/confirmaciones/historial';

export default function ViewConfirmationsScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<ConfirmationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadRecords = useCallback(async () => {
    setRefreshing(true);
    try {
      const saved = await obtenerHistorialConfirmaciones();
      setRecords(saved.slice().sort((first, second) =>
        second.fecha_hora.localeCompare(first.fecha_hora)
      ));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRecords();
    }, [loadRecords])
  );

  useEffect(() => {
    const handleHistoryMessage = (topic: string, payload: Buffer) => {
      if (topic !== TOPIC_HISTORIAL_CONFIRMACIONES) return;
      try {
        const history = JSON.parse(payload.toString()) as ConfirmationRecord[];
        if (Array.isArray(history)) {
          setRecords(history.slice().sort((first, second) =>
            second.fecha_hora.localeCompare(first.fecha_hora)
          ));
        }
      } catch (error) {
        console.error('No se pudo leer el historial MQTT:', error);
      }
    };

    client.on('message', handleHistoryMessage);
    if (isConnected()) {
      client.subscribe(TOPIC_HISTORIAL_CONFIRMACIONES);
    }

    return () => {
      client.removeListener('message', handleHistoryMessage);
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/screens/MenuScreen');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tomas confirmadas</Text>
        <Text style={styles.subtitle}>Registro recibido desde la Raspberry</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.count}>{records.length}</Text>
        <Text style={styles.summaryText}>
          {records.length === 1 ? 'toma registrada' : 'tomas registradas'}
        </Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadRecords} />
        }
      >
        {records.length ? records.map((record, index) => (
          <View key={`${record.fecha_hora}-${index}`} style={styles.record}>
            <Text style={styles.medicine}>{record.medicamento}</Text>
            <Text style={styles.timestamp}>
              {new Date(record.fecha_hora).toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'medium',
              })}
            </Text>
          </View>
        )) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Todavía no hay tomas confirmadas.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        accessibilityRole="button"
        accessibilityLabel="Volver al menú"
      >
        <Text style={styles.backButtonText}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#17365D',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: '#43536A',
    fontSize: 18,
    marginTop: 8,
    textAlign: 'center',
  },
  summary: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E0EC',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    minHeight: 68,
  },
  count: {
    color: '#1557A6',
    fontSize: 30,
    fontWeight: '700',
    marginRight: 10,
  },
  summaryText: {
    color: '#17365D',
    fontSize: 18,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  record: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E0EC',
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    padding: 16,
  },
  medicine: {
    color: '#17365D',
    fontSize: 20,
    fontWeight: '700',
  },
  timestamp: {
    color: '#43536A',
    fontSize: 16,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E0EC',
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 120,
    padding: 20,
  },
  emptyText: {
    color: '#43536A',
    fontSize: 18,
    textAlign: 'center',
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: '#17365D',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 58,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '600',
  },
});