/**
 * @module coding-doc-standard-client
 * @author Perijn Huijser
 * Registers the Coding Documentation Standard settings section in the web client.
 *
 * @remarks
 * Usage:
 *   Core principle: Render policy controls from the host-owned settings namespace
 *   without duplicating validation rules in the browser.
 *   Setup: The DSH client loads this package through the manifest client roster.
 *   Workflow: Bind the namespace, read its snapshot, and write only user-selected
 *   language enablement changes through the settings scope.
 *   API guide: The module exports Cordis-compatible name, inject, and apply fields.
 *   Worked example: The host plugin exposes the coding-doc-standard namespace.
 */

window.__ModuleLoader__.load({
  id: 'coding-doc-standard',
  factory: (require) => {
    const React = require('react')
    const fields = [
      ['enabled', 'Enforce documentation checks'],
      ['python', 'Python'],
      ['typescriptJavascript', 'TypeScript / JavaScript'],
      ['rust', 'Rust'],
      ['cCpp', 'C / C++'],
      ['dockerCompose', 'Docker Compose'],
    ]

    /**
     * Renders the documentation-policy settings controls.
     *
     * @param {{scope: {getSnapshot: Function, subscribe: Function, set: Function}}} properties - Bound settings scope.
     * @returns {React.ReactElement | null} Settings content when the scope is ready.
     */
    function Settings({ scope }) {
      const snapshot = React.useSyncExternalStore(scope.subscribe, scope.getSnapshot, scope.getSnapshot)
      if (snapshot.status !== 'ready') return null
      const value = snapshot.value ?? {}
      return React.createElement('section', null,
        React.createElement('h1', null, 'Coding Documentation Standard'),
        React.createElement('p', null, 'Validate documentation before code and Compose changes are written.'),
        ...fields.map(([key, label]) => React.createElement('label', { key },
          React.createElement('input', {
            type: 'checkbox', checked: value[key] === true, disabled: !snapshot.writable,
            onChange: (event) => { void scope.set(key, event.target.checked) },
          }),
          ` ${label}`,
        )),
      )
    }

    return {
      name: 'coding-doc-standard',
      inject: ['slots', 'settingsScope'],
      apply: (ctx) => {
        const scope = ctx.settingsScope.bind({ namespace: 'coding-doc-standard' })
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'coding-doc-standard', order: 24,
          label: () => 'Coding Documentation Standard', inject: () => ({ scope }),
        }, Settings))
      },
    }
  },
})
