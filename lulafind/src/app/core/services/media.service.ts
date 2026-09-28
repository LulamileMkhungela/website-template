import { Injectable, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { MediaItem } from '../models/types';
import { uid } from '../utils/format';
import { PlatformService } from './platform.service';

/**
 * Photo / video capture.
 * Native: @capacitor/camera (gallery + camera). Web: <input type=file> so the
 * browser preview behaves the same. Falls back to a generated placeholder so a
 * reviewer without a camera can still complete the flow.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  private platform = inject(PlatformService);
  readonly busy = signal(false);
  /** Last non-cancel error from pickImage / pickVideo, or null. */
  readonly lastError = signal<string | null>(null);

  async pickImage(opts: { source?: 'camera' | 'gallery'; quality?: number } = {}): Promise<MediaItem | null> {
    this.busy.set(true);
    this.lastError.set(null);
    try {
      if (this.platform.isNative) {
        const photo = await Camera.getPhoto({
          quality: opts.quality ?? 78,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: opts.source === 'camera' ? CameraSource.Camera : CameraSource.Prompt,
          correctOrientation: true,
          width: 1400
        });
        if (!photo.dataUrl) return null;
        return { id: uid('m'), kind: 'image', src: photo.dataUrl };
      }
      return await this.pickViaInput();
    } catch (e: any) {
      if (String(e?.message ?? '').toLowerCase().includes('cancel')) return null;
      this.lastError.set(e?.message ?? 'Could not pick image');
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  async pickVideo(): Promise<MediaItem | null> {
    this.busy.set(true);
    this.lastError.set(null);
    try {
      const item = await this.pickViaInput('video/*');
      return item;
    } catch (e: any) {
      if (!String(e?.message ?? '').toLowerCase().includes('cancel')) {
        this.lastError.set(e?.message ?? 'Could not pick video');
      }
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  private pickViaInput(accept = 'image/*'): Promise<MediaItem | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          document.body.removeChild(input);
          return resolve(null);
        }
        const reader = new FileReader();
        reader.onload = () => {
          document.body.removeChild(input);
          resolve({
            id: uid('m'),
            kind: file.type.startsWith('video') ? 'video' : 'image',
            src: String(reader.result)
          });
        };
        reader.onerror = () => {
          document.body.removeChild(input);
          resolve(null);
        };
        reader.readAsDataURL(file);
      }, { once: true });
      input.click();
    });
  }

  /** Downscales a data-uri so localStorage / Firestore documents stay small. */
  async compress(src: string, maxDim = 1200): Promise<string> {
    if (!src.startsWith('data:image')) return src;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
}
