// Accept national or pasted international Algerian mobile numbers; store one format.
export function normalizeAlgerianWhatsApp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  let digits=value.trim().replace(/[٠-٩]/g,char=>String(char.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,char=>String(char.charCodeAt(0)-0x6f0)).replace(/[\s().-]/g,'');
  if(digits.startsWith('+213'))digits=digits.slice(4);
  else if(digits.startsWith('00213'))digits=digits.slice(5);
  else if(digits.startsWith('213')&&digits.length===12)digits=digits.slice(3);
  if(digits.length===10&&digits.startsWith('0'))digits=digits.slice(1);
  return /^[567]\d{8}$/.test(digits)?`+213${digits}`:null;
}
