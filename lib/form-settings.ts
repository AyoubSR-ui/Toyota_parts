import { database } from '@/lib/storage';
import { defaultFormSettings, parseFormSettings } from '@/lib/form-fields';
export async function readFormSettings() {
  const row=await database().prepare('SELECT value FROM form_settings WHERE id=?').bind('part_request').first<{value:string}>();
  if(!row)return defaultFormSettings();
  const settings=parseFormSettings(JSON.parse(row.value));
  if(!settings)throw new Error('Invalid form settings');
  return settings;
}
