import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { GxIsotype } from './gx-isotype';
@Component({
  selector: 'gx-public-nav',
  imports: [RouterLink, RouterLinkActive, GxIsotype],
  template: `<header><a class="brand" routerLink="/" aria-label="Gamexid, inicio"><gx-isotype [compact]="true" />GAMEXID</a>
    <nav aria-label="Navegación pública">
      @for (item of links; track item.url) { <a [routerLink]="item.url" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" ariaCurrentWhenActive="page">{{ item.label }}</a> }
    </nav><a class="access" routerLink="/login">Entrar</a></header>`,
  styles: `:host{display:block;position:sticky;top:0;z-index:20;background:#080c14ed;backdrop-filter:blur(16px);border-bottom:1px solid #ffffff18}
    header{max-width:1200px;margin:auto;min-height:68px;padding:12px max(16px,4vw);display:flex;align-items:center;gap:24px;flex-wrap:wrap}
    a{color:#94a3b8;text-decoration:none;font-weight:600}.brand{display:flex;align-items:center;gap:10px;color:#f8fafc;font-family:var(--font-display)}
    nav{display:flex;gap:22px;margin-left:auto}nav a{padding:8px 0;border-bottom:2px solid transparent}nav a.active{color:#fff;border-color:#8b5cf6}
    .access{background:#8b5cf6;color:#fff;padding:8px 16px;border-radius:10px}a:focus-visible{outline:2px solid #a78bfa;outline-offset:4px}
    @media(max-width:640px){header{gap:12px}.access{margin-left:auto}nav{order:3;margin:0;width:100%;justify-content:space-between;gap:12px}}
  `,
})
export class PublicNav {
  readonly links = [{url:'/',label:'Inicio'},{url:'/flujo',label:'Flujo'},{url:'/marca',label:'Marca'},{url:'/sedes',label:'Sedes'}];
}
