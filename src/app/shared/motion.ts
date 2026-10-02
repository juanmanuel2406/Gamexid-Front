import { Injectable } from '@angular/core';
import { animate } from 'animejs';
import { gsap } from 'gsap';
@Injectable({ providedIn: 'root' })
export class Motion {
  private audio?: AudioContext;
  enabled = false;
  private reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  async enableFeedback(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) {
      try {
        this.audio ??= new AudioContext();
        await this.audio.resume();
      } catch {
        this.audio = undefined;
      }
    }
  }
  accepted(element?: HTMLElement | null) {
    if (element && !this.reduced())
      animate(element, { scale: [0.985, 1], opacity: [0.55, 1], duration: 220, ease: 'outQuad' });
    if (this.enabled) {
      navigator.vibrate?.(35);
      if (this.audio?.state === 'running') {
        const o = this.audio.createOscillator(),
          g = this.audio.createGain();
        o.connect(g);
        g.connect(this.audio.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.04, this.audio.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + 0.07);
        o.start();
        o.stop(this.audio.currentTime + 0.08);
      }
    }
  }
  discrepancy(element: HTMLElement) {
    if (!this.reduced())
      gsap.fromTo(
        element,
        { x: -4 },
        { x: 0, duration: 0.1, repeat: 3, yoyo: true, clearProps: 'transform' },
      );
  }
  laser(element: HTMLElement) {
    return this.reduced()
      ? undefined
      : animate(element, {
          translateY: [0, 130],
          opacity: [0.2, 0.8],
          duration: 850,
          loop: true,
          alternate: true,
          ease: 'inOutSine',
        });
  }
}
