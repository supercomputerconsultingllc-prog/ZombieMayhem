import base from './playwright.config.mjs';
export default {
  ...base,
  testMatch: '**/native/*.packaged.mjs',
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174' },
  webServer: { command: 'python3 -m http.server 4174 --directory apps/zombie-squad-run-ios-webwrap/web', url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI },
};
