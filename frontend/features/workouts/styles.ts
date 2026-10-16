import { StyleSheet } from 'react-native';
export const workoutStyles = StyleSheet.create({
  screen: { flex: 1,backgroundColor: '#10232a' },content: { padding: 22,paddingBottom: 70,gap: 16 },
  title: { color: '#fff',fontSize: 28,fontWeight: '700' },heading: { color: '#fff',fontSize: 21,fontWeight: '600' },
  body: { color: '#b2c4c9',fontSize: 16,lineHeight: 24 },accent: { color: '#65dcc0',fontSize: 17,fontWeight: '600' },
  card: { backgroundColor: '#19353e',padding: 18,borderRadius: 12,gap: 12 },
  row: { flexDirection: 'row',gap: 10,flexWrap: 'wrap',alignItems: 'center' },
  button: { backgroundColor: '#65dcc0',padding: 15,borderRadius: 10,minHeight: 48,alignItems: 'center' },
  buttonText: { color: '#10232a',fontWeight: '700',fontSize: 16 },
  secondary: { padding: 14,borderRadius: 10,borderColor: '#65dcc0',borderWidth: 1,minHeight: 48,alignItems: 'center' },
  disabled: { opacity: 0.45 },error: { color: '#ffb4ab',fontSize: 16,lineHeight: 24 },
  input: { backgroundColor: '#0b1b21',color: '#fff',borderWidth: 1,borderColor: '#68818a',borderRadius: 8,padding: 14,fontSize: 20,minHeight: 52 },
  timer: { color: '#65dcc0',fontSize: 40,fontWeight: '700',fontVariant: ['tabular-nums'] },
});
