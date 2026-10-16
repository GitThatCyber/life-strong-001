import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { offline } from '../offline/store';
import { notificationPlans, type Preferences } from './planner';
export type { Preferences } from './planner';
const key = 'life-strong:notification-preferences:v1';
const prefix = 'life-strong.';
export const preferences = (): Preferences => JSON.parse(Storage.getItemSync(key) ?? '{"reminders":false,"rest":false,"hour":18,"minute":0,"days":[2,4,6]}');
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true,shouldShowList: true,shouldPlaySound: true,shouldSetBadge: false }) });
export async function allowNotifications() {
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are disabled. Allow notifications for Expo Go in iPhone Settings, then try again.');
}
let reconciliation = Promise.resolve();
export function reconcileNotifications() {
  reconciliation = reconciliation.catch(() => {}).then(async () => {
    const p = preferences();
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of scheduled) if (item.identifier.startsWith(prefix) && item.identifier !== `${prefix}test`) await Notifications.cancelScheduledNotificationAsync(item.identifier);
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    for (const plan of notificationPlans(p,offline.getSnapshot().workouts,Date.now())) {
      await Notifications.scheduleNotificationAsync({ identifier: plan.id,
        content: { title: plan.title,body: plan.body,sound: true,...(plan.kind === 'rest' ? { data: { sessionId: plan.sessionId } } : {}) },
        trigger: plan.kind === 'weekly'
          ? { type: Notifications.SchedulableTriggerInputTypes.WEEKLY,weekday: plan.weekday,hour: plan.hour,minute: plan.minute }
          : { type: Notifications.SchedulableTriggerInputTypes.DATE,date: new Date(plan.deadline) },
      });
    }
  });
  return reconciliation;
}
export async function savePreferences(p: Preferences) {
  if (!Number.isInteger(p.hour) || p.hour < 0 || p.hour > 23 || !Number.isInteger(p.minute) || p.minute < 0 || p.minute > 59 || !p.days.length || p.days.some(d => !Number.isInteger(d) || d < 1 || d > 7)) throw new Error('Choose a valid time and at least one day.');
  const previous = preferences();
  const disabling = (previous.reminders && !p.reminders) || (previous.rest && !p.rest);
  if ((p.reminders || p.rest) && !disabling) await allowNotifications();
  Storage.setItemSync(key,JSON.stringify(p));
  await reconcileNotifications();
}
export async function testNotification() {
  await allowNotifications();
  return Notifications.scheduleNotificationAsync({ identifier: `${prefix}test`,content: { title: 'Life Strong test',body: 'Local reminders are working.',sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,seconds: 10,repeats: false },
  });
}
