
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';

interface Reminder {
  id: string;
  text: string;
  hour: number;
  minute: number;
}

const SERVER_URL = 'http://10.56.31.31:1095';

export default function ViewRemindersScreen() {
  const router = useRouter();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReminders = useCallback(async () => {
    setIsRefreshing(true);

    try {
      const res = await fetch(`${SERVER_URL}/reminders`);

      if (!res.ok) {
        throw new Error('Error al cargar los recordatorios');
      }

      const data: Reminder[] = await res.json();

      const sorted = data.sort(
        (a, b) =>
          a.hour * 60 + a.minute - (b.hour * 60 + b.minute)
      );

      setReminders(sorted);
    } catch (error) {
      console.error('Error al cargar recordatorios:', error);

      Alert.alert(
        'No se pudieron cargar',
        'No pudimos obtener los recordatorios. Revisá que el servidor esté encendido e intentá nuevamente.'
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReminders();
    }, [loadReminders])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Eliminar recordatorio',
      '¿Estás seguro de que querés eliminar este recordatorio?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(
                `${SERVER_URL}/delete-reminder`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ id }),
                }
              );

              if (!res.ok) {
                throw new Error('Error al eliminar');
              }

              setReminders((prev) =>
                prev.filter((reminder) => reminder.id !== id)
              );

              Alert.alert(
                'Recordatorio eliminado',
                'El recordatorio se eliminó correctamente.'
              );
            } catch (error) {
              console.error('Error al eliminar:', error);

              Alert.alert(
                'No se pudo eliminar',
                'Ocurrió un problema al eliminar el recordatorio. Intentá nuevamente.'
              );
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/screens/MenuScreen');
    }
  };

  return (
    <View style={styles.container}>
      {/* Encabezado */}
      <View style={styles.header}>
        <Text style={styles.title}>
          Mis recordatorios
        </Text>

        <Text style={styles.subtitle}>
          Consultá los horarios de tus actividades.
        </Text>
      </View>

      {/* Cantidad de recordatorios */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryNumber}>
          {reminders.length}
        </Text>

        <Text style={styles.summaryText}>
          {reminders.length === 1
            ? 'recordatorio activo'
            : 'recordatorios activos'}
        </Text>
      </View>

      {/* Lista */}
      <ScrollView
        style={styles.remindersContainer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={loadReminders}
            tintColor="#17365D"
            colors={['#17365D']}
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {reminders.length > 0 ? (
          reminders.map((reminder) => (
            <View key={reminder.id} style={styles.item}>
              {/* Hora */}
              <View style={styles.timeContainer}>
                <Text style={styles.time}>
                  {`${String(reminder.hour).padStart(2, '0')}:${String(
                    reminder.minute
                  ).padStart(2, '0')}`}
                </Text>

                <Text style={styles.timeLabel}>
                  Todos los días
                </Text>
              </View>

              {/* Texto */}
              <View style={styles.messageContainer}>
                <Text style={styles.messageLabel}>
                  Recordatorio
                </Text>

                <Text style={styles.messageText}>
                  {reminder.text}
                </Text>
              </View>

              {/* Eliminar */}
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(reminder.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Eliminar recordatorio: ${reminder.text}`}
              >
                <Text style={styles.deleteIcon}>×</Text>
                <Text style={styles.deleteButtonText}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◷</Text>

            <Text style={styles.emptyTitle}>
              No hay recordatorios
            </Text>

            <Text style={styles.emptyText}>
              Cuando crees un recordatorio, aparecerá aquí.
            </Text>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() =>
                router.push('/screens/ReminderScreen')
              }
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Crear un recordatorio"
            >
              <Text style={styles.createButtonText}>
                + Crear recordatorio
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Acciones inferiores */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Volver al menú anterior"
        >
          <Text style={styles.backButtonText}>
            ←  Volver
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 22,
    paddingTop: 45,
    paddingBottom: 25,
  },

  header: {
    alignItems: 'center',
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 20,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 29,
  },

  summaryCard: {
    minHeight: 85,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    marginBottom: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },

  summaryNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1557A6',
    marginRight: 12,
  },

  summaryText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#17365D',
    flexShrink: 1,
  },

  remindersContainer: {
    flex: 1,
  },

  listContent: {
    paddingBottom: 15,
    flexGrow: 1,
  },

  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    padding: 18,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
  },

  timeContainer: {
    backgroundColor: '#EDF3FA',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    alignItems: 'center',
  },

  time: {
    fontSize: 34,
    fontWeight: '700',
    color: '#17365D',
  },

  timeLabel: {
    fontSize: 17,
    color: '#43536A',
    marginTop: 4,
  },

  messageContainer: {
    marginBottom: 18,
  },

  messageLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#43536A',
    marginBottom: 7,
  },

  messageText: {
    fontSize: 22,
    lineHeight: 31,
    color: '#172B4D',
  },

  deleteButton: {
    minHeight: 58,
    backgroundColor: '#FFF0F0',
    borderWidth: 1,
    borderColor: '#C62828',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  deleteIcon: {
    fontSize: 28,
    fontWeight: '700',
    color: '#B42318',
    marginRight: 9,
  },

  deleteButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#B42318',
  },

  emptyCard: {
    flex: 1,
    minHeight: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    paddingHorizontal: 22,
    paddingVertical: 30,
    marginTop: 8,
  },

  emptyIcon: {
    fontSize: 54,
    color: '#1557A6',
    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 20,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 30,
    marginBottom: 24,
  },

  createButton: {
    minHeight: 64,
    width: '100%',
    backgroundColor: '#17365D',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  createButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  footer: {
    paddingTop: 15,
  },

  backButton: {
    minHeight: 66,
    backgroundColor: '#17365D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  backButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
