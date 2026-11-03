import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ConfirmationRecord {
  medicamento: string;
  fecha_hora: string;
}

const STORAGE_KEY = 'abuelaconecta:confirmaciones';

export async function obtenerHistorialConfirmaciones(): Promise<ConfirmationRecord[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  const records = JSON.parse(stored) as ConfirmationRecord[];
  return Array.isArray(records) ? records : [];
}

export async function guardarHistorialConfirmaciones(
  records: ConfirmationRecord[]
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}