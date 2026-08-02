import { Component, input, output } from '@angular/core';

/**
 * Displays a prominent message about status or a required action.
 * @acmSemantic alert - Announces an important message in place; does not steal focus.
 * @slot - Default message content.
 * @slot actions - Action buttons shown alongside the message (ng-content select="[actions]").
 * @example Dismissible error with actions
 * ```html
 * <tb-alert type="error" [dismissible]="true" (dismissed)="onDismiss()">
 *   Could not save your changes.
 *   <tb-button actions variant="ghost">Retry</tb-button>
 * </tb-alert>
 * ```
 */
@Component({
  selector: 'tb-alert',
  template: `
    <div [class]="'tb-alert tb-alert--' + type()">
      <ng-content></ng-content>
      <ng-content select="[actions]"></ng-content>
      @if (dismissible()) {
        <button type="button" (click)="dismissed.emit()">&times;</button>
      }
    </div>
  `,
  styleUrl: './alert.css',
})
export class Alert {
  /** Severity of the alert. */
  type = input<'info' | 'success' | 'warning' | 'error'>('info');

  /** Whether a dismiss control is shown. */
  dismissible = input<boolean>(false);

  /** Fired when the alert is dismissed via its dismiss control. */
  dismissed = output<void>();
}
