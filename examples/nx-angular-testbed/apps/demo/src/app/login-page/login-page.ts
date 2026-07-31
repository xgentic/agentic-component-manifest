import { Component, signal } from '@angular/core';
import { Alert, Button, Card, Checkbox, TextField } from '@testbed/ui';

@Component({
  selector: 'tb-login-page',
  imports: [Alert, Button, Card, Checkbox, TextField],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  email = signal('');
  password = signal('');
  rememberMe = signal(false);
  error = signal('');

  onSubmit(): void {
    if (!this.email() || !this.password()) {
      this.error.set('Email and password are required.');
      return;
    }
    this.error.set('');
    // TODO: wire up to a real authentication service.
  }
}
