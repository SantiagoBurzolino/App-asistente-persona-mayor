
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function MenuScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Menú principal</Text>
        <Text style={styles.subtitle}>
          ¿Qué desea hacer hoy?
        </Text>
      </View>

      <View style={styles.menu}>
        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.7}
          onPress={() => router.push('/screens/MessageScreen')}
          accessibilityRole="button"
          accessibilityLabel="Enviar un mensaje"
        >
          <Text style={styles.icon}>✉</Text>
          <Text style={styles.buttonText}>Mensaje</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.7}
          onPress={() => router.push('/screens/ReminderScreen')}
          accessibilityRole="button"
          accessibilityLabel="Crear un recordatorio"
        >
          <Text style={styles.icon}>◷</Text>
          <Text style={styles.buttonText}>Crear recordatorio</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.7}
          onPress={() => router.push('/screens/ViewRemindersScreen')}
          accessibilityRole="button"
          accessibilityLabel="Ver mis recordatorios"
        >
          <Text style={styles.icon}>☷</Text>
          <Text style={styles.buttonText}>Ver recordatorios</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.homeButton}
        activeOpacity={0.7}
        onPress={() => router.push('/')}
        accessibilityRole="button"
        accessibilityLabel="Volver al inicio"
      >
        <Text style={styles.homeButtonText}>
          Volver al inicio
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
    paddingTop: 70,
    paddingBottom: 35,
    justifyContent: 'center',
  },

  header: {
    marginBottom: 35,
    alignItems: 'center',
  },

  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 23,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 32,
  },

  menu: {
    width: '100%',
    gap: 18,
  },

  button: {
    minHeight: 88,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
  },

  icon: {
    fontSize: 32,
    color: '#1557A6',
    width: 48,
    textAlign: 'center',
    marginRight: 12,
  },

  buttonText: {
    flex: 1,
    fontSize: 23,
    fontWeight: '600',
    color: '#17365D',
    lineHeight: 30,
  },

  arrow: {
    fontSize: 34,
    color: '#1557A6',
    marginLeft: 8,
  },

  homeButton: {
    minHeight: 68,
    marginTop: 30,
    backgroundColor: '#17365D',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  homeButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
