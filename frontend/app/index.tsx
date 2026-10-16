import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';
import { checkHealth } from '../services/api';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const [result, setResult] = useState('Not checked');
  const [loading, setLoading] = useState(false);
  async function testConnection() {
    setLoading(true);
    try {
      const response = await checkHealth();
      setResult(response.status === 'ok' ? 'API reachable ✓' : 'Unexpected API response');
    } catch (error) { setResult(error instanceof Error ? error.message : 'Connection failed'); }
    finally { setLoading(false); }
  }
  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>LIFE STRONG</Text>
        <Text accessibilityRole="header" style={styles.title}>Build strength for life.</Text>
        <Text style={styles.subtitle}>Your training foundation</Text>
        <Link href="./browse" style={styles.buttonText} accessibilityRole="link">
          <Text style={{ color: '#65dcc0', fontSize: 20,paddingVertical: 12 }}>Browse programs and exercises →</Text>
        </Link>
        <Link href="./sessions" style={{ color: '#65dcc0',fontSize: 20,paddingVertical: 12 }}>Continue or review a workout →</Link>
        <Link href="./reminders" style={{ color: '#65dcc0',fontSize: 20,paddingVertical: 12 }}>Reminders and rest alerts →</Link>
        <Link href="./progress" style={{ color: '#65dcc0',fontSize: 20,paddingVertical: 12 }}>Progress and training history →</Link>
        <Link href="./account" style={{ color: '#65dcc0',fontSize: 20,paddingVertical: 12 }}>Account and data →</Link>
        <Pressable onPress={testConnection} disabled={loading} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Test API Connection</Text>
        </Pressable>
        {loading ? <ActivityIndicator /> : <Text style={styles.result}>{result}</Text>}
        <Text style={styles.note}>Choose a template, record your sets, and build your training history.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#10232a' },
  content: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 20 },
  brand: { color: '#65dcc0', letterSpacing: 4, fontSize: 16, fontWeight: '700' },
  title: { color: '#fff', fontSize: 34, fontWeight: '700' },
  subtitle: { color: '#b2c4c9', fontSize: 16 },
  button: { backgroundColor: '#65dcc0', borderRadius: 12, padding: 17, alignItems: 'center' },
  buttonText: { color: '#10232a', fontWeight: '700', fontSize: 16 },
  result: { color: '#fff', fontSize: 16 },
  note: { color: '#93a9b0', marginTop: 16 },
});
