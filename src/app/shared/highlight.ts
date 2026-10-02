import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
@Component({
  selector: 'gx-highlight',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '@for(part of parts();track $index){@if(part.match){<mark>{{part.text}}</mark>}@else{<span>{{part.text}}</span>}}',
})
export class Highlight {
  text = input('');
  query = input('');
  parts = computed(() => {
    const value = this.text(),
      q = this.query().trim().toLowerCase();
    if (!q) return [{ text: value, match: false }];
    const result: { text: string; match: boolean }[] = [];
    let start = 0,
      index: number;
    while ((index = value.toLowerCase().indexOf(q, start)) >= 0) {
      if (index > start) result.push({ text: value.slice(start, index), match: false });
      result.push({ text: value.slice(index, index + q.length), match: true });
      start = index + q.length;
    }
    if (start < value.length) result.push({ text: value.slice(start), match: false });
    return result;
  });
}
