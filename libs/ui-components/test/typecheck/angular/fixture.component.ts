// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- consumers load generated ambient typings this way
/// <reference path="../../../types/dom.d.ts" />
import { CUSTOM_ELEMENTS_SCHEMA, Component, ElementRef, viewChild } from '@angular/core';
import type { ChipToggleDetail, ThemeChangeDetail } from '../../../src/types';

/**
 * Angular uses CUSTOM_ELEMENTS_SCHEMA for bf-* tags; the generated DOM typings make
 * `$event` and element refs typed under strictTemplates.
 */
@Component({
  selector: 'bf-fixture',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <bf-button variant="secondary" (click)="saved = true">Save</bf-button>
    <bf-chip interactive value="aws" (bf-toggle)="onToggle($event)">AWS</bf-chip>
    <bf-theme-toggle (bf-theme-change)="onTheme($event)"></bf-theme-toggle>
    <bf-dialog #dialog><span slot="heading">Hi</span></bf-dialog>
  `,
})
export class FixtureComponent {
  saved = false;
  selected = false;
  theme: 'light' | 'dark' = 'light';
  readonly dialog = viewChild.required<ElementRef<HTMLElementTagNameMap['bf-dialog']>>('dialog');

  onToggle(e: CustomEvent<ChipToggleDetail>): void {
    this.selected = e.detail.selected;
  }

  onTheme(e: CustomEvent<ThemeChangeDetail>): void {
    this.theme = e.detail.theme;
  }

  openDialog(): void {
    this.dialog().nativeElement.open = true;
  }
}
