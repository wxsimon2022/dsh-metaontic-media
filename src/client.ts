import { createSettingsPage } from './platform/dsh/settings/page.js';
declare const window: { __ModuleLoader__: { load(plugin: unknown): void } };
window.__ModuleLoader__.load({ id: 'dsh-metaontic-media', factory(require: (id: string) => any) {
  const React = require('react');
  return { inject: ['slots', 'configForms'], apply(ctx: any) {
    const form = ctx.configForms.get('dsh-metaontic-media');
    const Page = createSettingsPage(React, form);
    ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: 'dsh-metaontic-media' }, Page)), 'metaontic-media: model settings');
  } };
} });
