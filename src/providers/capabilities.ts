import type { MediaRequest, ModelCapabilities } from '../types/media.js';
export function validateRequest(r: MediaRequest, c: ModelCapabilities): void {
  const reject = () => { throw new Error('UNSUPPORTED_CAPABILITY'); };
  if (!r.prompt.trim() || r.mediaType !== c.mediaType || !c.modes.includes(r.mode)) reject();
  if (r.references.length > c.maxReferences) reject();
  if (r.mode === 'text' && r.references.length) reject();
  if (r.mode !== 'text' && !r.references.length) reject();
  if (r.mode === 'first-last-frame' && (r.references.filter(x => x.role === 'first').length !== 1 || r.references.filter(x => x.role === 'last').length !== 1)) reject();
  if (r.negativePrompt && !c.negativePrompt || r.generateAudio && !c.nativeAudio) reject();
  if (r.duration !== undefined && !c.durations?.includes(r.duration)) reject();
  if (r.aspectRatio !== undefined && !c.aspectRatios?.includes(r.aspectRatio)) reject();
  if (r.resolution !== undefined && !c.resolutions?.includes(r.resolution)) reject();
}
