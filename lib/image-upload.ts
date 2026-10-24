export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const imageTypes: Record<string,string> = { 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp' };
export async function validImage(file: File) {
  if (file.size > MAX_IMAGE_BYTES || !imageTypes[file.type]) return false;
  const bytes = new Uint8Array(await file.slice(0,16).arrayBuffer());
  if(file.type==='image/jpeg')return bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  if(file.type==='image/png')return [137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  return file.type==='image/webp'&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
}
