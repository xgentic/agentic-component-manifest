import { Component, signal } from '@angular/core';
import { Alert, Button, Card, Checkbox, TextField } from '@testbed/ui';

@Component({
  selector: 'tb-add-customer-page',
  imports: [Alert, Button, Card, Checkbox, TextField],
  templateUrl: './add-customer-page.html',
  styleUrl: './add-customer-page.css',
})
export class AddCustomerPage {
  fullName = signal('');
  email = signal('');
  phone = signal('');
  subscribeToUpdates = signal(true);
  error = signal('');
  submitted = signal(false);

  onSubmit(): void {
    if (!this.fullName() || !this.email()) {
      this.error.set('Full name and email are required.');
      this.submitted.set(false);
      return;
    }
    this.error.set('');
    this.submitted.set(true);
    // TODO: wire up to a real customer service.
  }
}
