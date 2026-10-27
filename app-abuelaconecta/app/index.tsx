
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function MessageScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AbuelaConecta</Text>
        <Text style={styles.subtitle}>
          ¡Siempre cerca de quienes queremos!
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.icon}>✉</Text>

        <Text style={styles.welcome}>
          Bienvenida
        </Text>

        <Text style={styles.description}>
          Conectate con tus seres queridos de manera fácil y sencilla.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.7}
        onPress={() => router.push('/screens/MenuScreen')}
        accessibilityRole="button"
        accessibilityLabel="Volver al menú principal"
      >
        <Text style={styles.buttonText}>←  Inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F7FB',
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    alignItems: 'center',
    marginBottom: 40,
  },

  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#17365D',
    textAlign: 'center',
    marginBottom: 12,
  },

  subtitle: {
    fontSize: 22,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 32,
  },

  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D6E0EC',
    paddingHorizontal: 24,
    paddingVertical: 35,
    alignItems: 'center',
    marginBottom: 35,
    elevation: 2,
    shadowColor: '#17365D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
  },

  icon: {
    fontSize: 48,
    color: '#1557A6',
    marginBottom: 18,
  },

  welcome: {
    fontSize: 28,
    fontWeight: '700',
    color: '#17365D',
    marginBottom: 14,
    textAlign: 'center',
  },

  description: {
    fontSize: 22,
    color: '#43536A',
    textAlign: 'center',
    lineHeight: 32,
  },

  button: {
    width: '100%',
    minHeight: 72,
    backgroundColor: '#17365D',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },

  buttonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
