import { Injectable, signal, inject, effect, untracked } from '@angular/core';
import { Workspace } from '../../core/workspace';
export type PcPlatform = 'amd' | 'intel';
export interface PcProduct { id: string; name: string; code: string; description?: string; stock: number | null; price?: number | null; webUrl?: string | null; }
export interface PcOffer { id: string; source: string; title: string; amount: number; currency: string | null; url: string | null; checkedUtc: string; listingId?: string; }
export interface PcItem { slot: string; product: PcProduct; quantity: number; offers: PcOffer[]; notices: string[]; selected?: PcOffer; confirmedCurrency?: string; }
export interface PcQuote { lines: { slot: string; product: PcProduct; quantity: number; subtotal: number | null; currency: string | null; offer: PcOffer | null }[];
  checks: { status: string; title: string; detail: string }[]; totals: { currency: string; amount: number }[]; missingPrices: number; checkedUtc: string; }
@Injectable({ providedIn: 'root' })
export class PcBuilderStore {
  private workspace = inject(Workspace);
  private branch = 0;
  constructor() { effect(() => { const id = this.workspace.branchId(); if (id !== this.branch) { this.branch = id; untracked(() => this.clear()); } }); }
  readonly platform = signal<PcPlatform | null>(null);
  readonly items = signal<PcItem[]>([]);
  readonly quote = signal<PcQuote | null>(null);
  context() { return this.items().map(i => ({ slot: i.slot, productId: i.product.id, quantity: i.quantity })); }
  clear() { this.items.set([]); this.quote.set(null); this.platform.set(null); }
}
