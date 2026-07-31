import { Route } from '@angular/router';
import { LoginPage } from './login-page/login-page';
import { AddCustomerPage } from './add-customer-page/add-customer-page';
import { DashboardPage } from './dashboard-page/dashboard-page';

export const appRoutes: Route[] = [
  { path: 'login', component: LoginPage },
  { path: 'add-customer', component: AddCustomerPage },
  { path: 'dashboard', component: DashboardPage },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
];
