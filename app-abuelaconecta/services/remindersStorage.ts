import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredReminder {
  id: string;
  hora: string;
  dia: string;
  tipo: string;
  mensaje: string;
}

const STORAGE_KEY = 'abuelaconecta:recetas';

export async function obtenerRecordatorios(): Promise<StoredReminder[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as StoredReminder[]) : [];
}

export async function guardarRecordatorio(
  reminder: StoredReminder
): Promise<void> {
  const reminders = await obtenerRecordatorios();
  const updated = [
    ...reminders.filter((item) => item.id !== reminder.id),
    reminder,
  ];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export async function eliminarRecordatorio(id: string): Promise<void> {
  const reminders = await obtenerRecordatorios();
  const updated = reminders.filter((reminder) => reminder.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}