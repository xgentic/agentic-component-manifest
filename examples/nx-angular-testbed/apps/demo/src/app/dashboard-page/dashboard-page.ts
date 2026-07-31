import { Component, computed, signal } from '@angular/core';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Tabs,
  TextField,
  Tooltip,
} from '@testbed/ui';

export type RunStatus = 'pass' | 'flaky' | 'fail';

export interface Run {
  id: number;
  suite: string;
  branch: string;
  sha: string;
  status: RunStatus;
  total: number;
  passed: number;
  duration: string;
  author: string;
  age: string;
}

type StatusFilter = RunStatus | 'all';

const RUNS: Run[] = [
  {
    id: 1240,
    suite: 'embed-viewer',
    branch: 'main',
    sha: '21b9ae',
    status: 'pass',
    total: 372,
    passed: 372,
    duration: '7m 12s',
    author: 'n.tanner',
    age: '2d ago',
  },
  {
    id: 1239,
    suite: 'sso-saml',
    branch: 'release/24.6',
    sha: 'd91f02',
    status: 'pass',
    total: 399,
    passed: 399,
    duration: '2m 5s',
    author: 'r.keller',
    age: '2d ago',
  },
  {
    id: 1238,
    suite: 'export-pdf',
    branch: 'release/24.6',
    sha: 'b3e019',
    status: 'pass',
    total: 243,
    passed: 243,
    duration: '1m 55s',
    author: 'j.frei',
    age: '3d ago',
  },
  {
    id: 1237,
    suite: 'auth-spec',
    branch: 'main',
    sha: '21b9ae',
    status: 'flaky',
    total: 430,
    passed: 425,
    duration: '4m 8s',
    author: 'r.keller',
    age: '2d ago',
  },
  {
    id: 1236,
    suite: 'i18n-checks',
    branch: 'chore/deps-bump',
    sha: '0c3a7b',
    status: 'pass',
    total: 97,
    passed: 97,
    duration: '6m 53s',
    author: 's.brunner',
    age: '2d ago',
  },
  {
    id: 1235,
    suite: 'profile-settings',
    branch: 'feat/inline-edit',
    sha: '8af2c1',
    status: 'flaky',
    total: 278,
    passed: 276,
    duration: '56s',
    author: 'j.frei',
    age: '1d ago',
  },
  {
    id: 1234,
    suite: 'mobile-nav',
    branch: 'fix/timezone-bug',
    sha: 'f5e612',
    status: 'fail',
    total: 252,
    passed: 228,
    duration: '3m 51s',
    author: 's.brunner',
    age: '1d ago',
  },
  {
    id: 1233,
    suite: 'embed-viewer',
    branch: 'feat/sso-okta',
    sha: '4e2f88',
    status: 'flaky',
    total: 221,
    passed: 220,
    duration: '10m 28s',
    author: 'j.frei',
    age: '1d ago',
  },
  {
    id: 1232,
    suite: 'i18n-checks',
    branch: 'hotfix/login-loop',
    sha: 'd91f02',
    status: 'pass',
    total: 132,
    passed: 132,
    duration: '10m 14s',
    author: 'p.meier',
    age: '10h ago',
  },
  {
    id: 1231,
    suite: 'onboarding',
    branch: 'perf/lcp',
    sha: '8af2c1',
    status: 'pass',
    total: 211,
    passed: 211,
    duration: '2m 47s',
    author: 'n.tanner',
    age: '2d ago',
  },
  {
    id: 1230,
    suite: 'dashboard-e2e',
    branch: 'feat/inline-edit',
    sha: '21b9ae',
    status: 'flaky',
    total: 359,
    passed: 356,
    duration: '11m 23s',
    author: 'n.tanner',
    age: '2d ago',
  },
  {
    id: 1229,
    suite: 'onboarding',
    branch: 'feat/inline-edit',
    sha: '7c5a44',
    status: 'pass',
    total: 125,
    passed: 125,
    duration: '1m 50s',
    author: 'r.keller',
    age: '1d ago',
  },
  {
    id: 1228,
    suite: 'billing-cycle',
    branch: 'feat/inline-edit',
    sha: '7c5a44',
    status: 'pass',
    total: 117,
    passed: 117,
    duration: '10m 15s',
    author: 'j.frei',
    age: '1d ago',
  },
  {
    id: 1227,
    suite: 'sso-saml',
    branch: 'feat/inline-edit',
    sha: '21b9ae',
    status: 'pass',
    total: 99,
    passed: 99,
    duration: '5m 43s',
    author: 'a.huber',
    age: '2d ago',
  },
  {
    id: 1226,
    suite: 'i18n-checks',
    branch: 'main',
    sha: 'd91f02',
    status: 'pass',
    total: 103,
    passed: 103,
    duration: '8m 50s',
    author: 'j.frei',
    age: '3d ago',
  },
  {
    id: 1225,
    suite: 'workspace-bootstrap',
    branch: 'main',
    sha: 'd91f02',
    status: 'flaky',
    total: 268,
    passed: 265,
    duration: '4m 21s',
    author: 'a.huber',
    age: '1d ago',
  },
];

const STATUS_TONES: Record<RunStatus, 'success' | 'warning' | 'danger'> = {
  pass: 'success',
  flaky: 'warning',
  fail: 'danger',
};

@Component({
  selector: 'tb-dashboard-page',
  imports: [Alert, Avatar, Badge, Button, Card, Tabs, TextField, Tooltip],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  readonly tabLabels = ['Runs', 'Suites', 'Flakes', 'Settings'];
  selectedTab = signal(0);

  status = signal<StatusFilter>('all');
  query = signal('');

  readonly runs = RUNS;

  readonly counts = computed(() => ({
    all: this.runs.length,
    fail: this.runs.filter((run) => run.status === 'fail').length,
    flaky: this.runs.filter((run) => run.status === 'flaky').length,
    pass: this.runs.filter((run) => run.status === 'pass').length,
  }));

  readonly visibleRuns = computed(() => {
    const status = this.status();
    const term = this.query().trim().toLowerCase();

    return this.runs.filter((run) => {
      if (status !== 'all' && run.status !== status) {
        return false;
      }
      if (!term) {
        return true;
      }
      return [run.suite, run.sha, run.author, run.branch, `#${run.id}`].some(
        (field) => field.toLowerCase().includes(term),
      );
    });
  });

  toneFor(status: RunStatus): 'success' | 'warning' | 'danger' {
    return STATUS_TONES[status];
  }

  /**
   * @testbed/ui has no progress-bar component, so the pass ratio each card would
   * show as a bar is surfaced as a Badge instead (see AGENTS.md rule 3).
   */
  ratioLabel(run: Run): string {
    return `${run.passed}/${run.total} passed`;
  }

  selectStatus(status: StatusFilter): void {
    this.status.set(status);
  }
}
