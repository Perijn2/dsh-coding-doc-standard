/**
 * @module coding-doc-standard-client
 * @author Perijn Huijser
 * Registers expanded documentation and formatter policy controls in the web client.
 *
 * @remarks
 * Usage:
 *   Core principle: Render host-owned policy controls without duplicating checker
 *   rules or formatter versions in the browser.
 *   Setup: The DSH client loads this package through the manifest client roster.
 *   Workflow: Bind the settings namespace, read the current snapshot, and persist
 *   user-selected enforcement and formatting policy through its settings scope.
 *   API guide: The module exports Cordis-compatible name, inject, and apply fields.
 *   Worked example: The host plugin exposes the coding-doc-standard namespace.
 */

window.__ModuleLoader__.load({
	id: "coding-doc-standard",
	factory: (require) => {
		const module = { exports: {} };
		const exports = module.exports;
		const React = require("react");
		const NS = "coding-doc-standard";
		const NAV_MARKER = "data-coding-doc-standard-settings-nav";
		const SETTINGS_LABEL = "Coding Documentation Standard";
		const documentationFields = [
			[
				"enabled",
				"Enforce documentation checks",
				"Block unsupported documentation changes before they are written.",
			],
			["python", "Python", "Check module and public-unit documentation."],
			[
				"typescriptJavascript",
				"TypeScript / JavaScript",
				"Check source-module documentation.",
			],
			["rust", "Rust", "Check Rust module documentation."],
			["cCpp", "C / C++", "Check Doxygen-compatible source headers."],
			[
				"dockerCompose",
				"Docker Compose",
				"Check human-readable YAML comment headers and service summaries.",
			],
		];
		const formatterFields = [
			[
				"formatOnWrite",
				"Enable pre-write formatting",
				"Use pinned, check-only fast formatters on pending content.",
			],
			[
				"formatPython",
				"Python — Ruff 0.16.6",
				"Check Python candidates with the provisioned Ruff formatter.",
			],
			[
				"formatTypescriptJavascript",
				"TypeScript / JavaScript — Biome 2.5.12",
				"Check JS and TS candidates with the package-pinned Biome formatter.",
			],
			[
				"formatRust",
				"Rust — rustfmt",
				"Check Rust candidates with the project toolchain's rustfmt formatter.",
			],
			[
				"formatDockerCompose",
				"Docker Compose — Prettier 3.9.6",
				"Check recognized Compose YAML candidates with the package-pinned Prettier formatter.",
			],
			[
				"blockOnMissingFormatter",
				"Block when a formatter is unavailable",
				"Fail closed instead of allowing unformatted pending content.",
			],
		];
		const settingsCss = `
.cds-settings-section { display: flex; width: 100%; max-width: 760px; flex-direction: column; gap: 16px; color: var(--dsw-alias-label-primary); }
.cds-settings-header { display: flex; flex-direction: column; gap: 5px; padding: 0 2px; }
.cds-settings-heading { margin: 0; font-size: 20px; font-weight: 600; line-height: 28px; }
.cds-settings-summary { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.cds-settings-overview { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.cds-settings-stat { display: flex; min-width: 0; flex-direction: column; gap: 2px; padding: 13px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-3); }
.cds-settings-stat-label { color: var(--dsw-alias-label-tertiary); font-size: 11px; font-weight: 500; line-height: 16px; }
.cds-settings-stat-value { font-size: 13px; font-weight: 600; line-height: 20px; }
.cds-settings-group { display: flex; box-sizing: border-box; flex-direction: column; padding: 18px 20px 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 16px; background: var(--dsw-alias-bg-layer-3); }
.cds-settings-group-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 0 2px 10px; }
.cds-settings-group-copy { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.cds-settings-group-heading { font-size: 14px; font-weight: 600; line-height: 21px; }
.cds-settings-group-summary { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.cds-settings-count { flex: none; border-radius: 999px; padding: 2px 8px; color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-bg-layer-2); font-size: 11px; font-weight: 500; line-height: 16px; }
.cds-settings-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 2px; border-top: 1px solid var(--dsw-alias-border-l2); }
.cds-settings-row-text { display: flex; min-width: 0; flex-direction: column; gap: 3px; }
.cds-settings-title { font-size: 13px; font-weight: 500; line-height: 20px; }
.cds-settings-description { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.cds-switch { position: relative; display: inline-flex; flex: none; cursor: pointer; }
.cds-switch-input { position: absolute; width: 1px; height: 1px; margin: 0; opacity: 0; }
.cds-switch-track { display: inline-flex; box-sizing: border-box; align-items: center; width: 36px; height: 20px; padding: 2px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; background: var(--dsw-alias-bg-layer-2); transition: background .15s, border-color .15s; }
.cds-switch-thumb { display: block; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: transform .15s, background .15s; }
.cds-switch:hover .cds-switch-track { border-color: var(--dsw-alias-label-dimmed); }
.cds-switch-input:checked + .cds-switch-track { border-color: var(--dsw-alias-button-primary-fill); background: var(--dsw-alias-button-primary-fill); }
.cds-switch-input:checked + .cds-switch-track .cds-switch-thumb { transform: translate(16px); background: var(--dsw-alias-bg-layer-3); }
.cds-switch-input:focus-visible + .cds-switch-track { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.cds-switch-input:disabled + .cds-switch-track { cursor: not-allowed; opacity: .5; }
@media (max-width: 520px) { .cds-settings-overview { grid-template-columns: minmax(0, 1fr); } .cds-settings-group { padding-right: 16px; padding-left: 16px; } }
@media (prefers-reduced-motion: reduce) { .cds-switch-track, .cds-switch-thumb { transition: none; } }
[data-coding-doc-standard-settings-nav] > svg:first-child { display: none; }
[data-coding-doc-standard-settings-nav]::before { content: ''; flex: none; width: 16px; height: 16px; background: currentColor; -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cpath d='M8 13h8'/%3E%3Cpath d='M8 17h8'/%3E%3Cpath d='M8 9h2'/%3E%3C/svg%3E") center / contain no-repeat; mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2 2V7.5z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3Cpath d='M8 13h8'/%3E%3Cpath d='M8 17h8'/%3E%3Cpath d='M8 9h2'/%3E%3C/svg%3E") center / contain no-repeat; }
`;

		if (
			typeof document !== "undefined" &&
			document.querySelector(
				'style[data-plugin-css="coding-doc-standard/settings"]',
			) === null
		) {
			const style = document.createElement("style");
			style.dataset.plugin = NS;
			style.dataset.pluginCss = "coding-doc-standard/settings";
			style.textContent = settingsCss;
			document.head.appendChild(style);
		}

		/**
		 * Marks the dedicated Settings navigation item with this plugin's icon.
		 *
		 * @returns {() => void} Disposer for the dialog observer.
		 */
		function registerSettingsNavIcon() {
			let disposed = false;
			const sync = () => {
				if (disposed) return;
				for (const button of document.querySelectorAll(
					'[role="dialog"] nav button',
				)) {
					if (button.textContent?.trim() === SETTINGS_LABEL)
						button.setAttribute(NAV_MARKER, "");
					else button.removeAttribute(NAV_MARKER);
				}
			};
			sync();
			const observer = new MutationObserver(sync);
			observer.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true,
			});
			return () => {
				disposed = true;
				observer.disconnect();
				document.querySelectorAll(`[${NAV_MARKER}]`).forEach((element) => {
					element.removeAttribute(NAV_MARKER);
				});
			};
		}

		/**
		 * Renders one policy row and its accessible switch.
		 *
		 * @param {{checked: boolean, description: string, disabled: boolean, label: string, onChange: Function}} properties - Control properties.
		 * @returns {React.ReactElement} A styled settings row.
		 */
		function Toggle({ checked, description, disabled, label, onChange }) {
			return React.createElement(
				"div",
				{ className: "cds-settings-row" },
				React.createElement(
					"span",
					{ className: "cds-settings-row-text" },
					React.createElement(
						"span",
						{ className: "cds-settings-title" },
						label,
					),
					React.createElement(
						"span",
						{ className: "cds-settings-description" },
						description,
					),
				),
				React.createElement(
					"label",
					{ className: "cds-switch" },
					React.createElement("input", {
						className: "cds-switch-input",
						type: "checkbox",
						checked,
						disabled,
						"aria-label": label,
						onChange: (event) => onChange(event.target.checked),
					}),
					React.createElement(
						"span",
						{ className: "cds-switch-track", "aria-hidden": "true" },
						React.createElement("span", { className: "cds-switch-thumb" }),
					),
				),
			);
		}

		/**
		 * Renders a card containing related policy controls.
		 *
		 * @param {{fields: Array<[string, string, string]>, heading: string, summary: string, status: string, scope: object, value: object, writable: boolean, disabled?: boolean}} properties - Group properties.
		 * @returns {React.ReactElement} Settings card.
		 */
		function SettingsGroup({
			fields,
			heading,
			summary,
			status,
			scope,
			value,
			writable,
			disabled = false,
		}) {
			return React.createElement(
				"section",
				{ className: "cds-settings-group" },
				React.createElement(
					"header",
					{ className: "cds-settings-group-header" },
					React.createElement(
						"div",
						{ className: "cds-settings-group-copy" },
						React.createElement(
							"div",
							{ className: "cds-settings-group-heading" },
							heading,
						),
						React.createElement(
							"div",
							{ className: "cds-settings-group-summary" },
							summary,
						),
					),
					React.createElement(
						"span",
						{ className: "cds-settings-count" },
						status,
					),
				),
				...fields.map(([key, label, description]) =>
					React.createElement(Toggle, {
						key,
						checked: value[key] === true,
						description,
						disabled: disabled || !writable,
						label,
						onChange: (next) => void scope.set(key, next),
					}),
				),
			);
		}

		/**
		 * Renders the documentation-policy settings controls.
		 *
		 * @param {{scope: {getSnapshot: Function, subscribe: Function, set: Function}}} properties - Bound settings scope.
		 * @returns {React.ReactElement | null} Settings content when the scope is ready.
		 */
		function Settings({ scope }) {
			const snapshot = React.useSyncExternalStore(
				(listener) => scope.subscribe(listener),
				() => scope.getSnapshot(),
				() => scope.getSnapshot(),
			);
			if (snapshot.status !== "ready") return null;
			const value = snapshot.value ?? {};
			const enabledLanguages = documentationFields
				.slice(1)
				.filter(([key]) => value[key] === true).length;
			const enabledFormatters = formatterFields
				.slice(1, 4)
				.filter(([key]) => value[key] === true).length;
			return React.createElement(
				"section",
				{ className: "cds-settings-section" },
				React.createElement(
					"header",
					{ className: "cds-settings-header" },
					React.createElement(
						"h1",
						{ className: "cds-settings-heading" },
						SETTINGS_LABEL,
					),
					React.createElement(
						"p",
						{ className: "cds-settings-summary" },
						"Manage pre-write documentation checks and the pinned formatter checks that keep pending content consistent.",
					),
				),
				React.createElement(
					"div",
					{ className: "cds-settings-overview" },
					React.createElement(
						"div",
						{ className: "cds-settings-stat" },
						React.createElement(
							"span",
							{ className: "cds-settings-stat-label" },
							"Documentation policy",
						),
						React.createElement(
							"span",
							{ className: "cds-settings-stat-value" },
							value.enabled === true ? "Active" : "Paused",
						),
					),
					React.createElement(
						"div",
						{ className: "cds-settings-stat" },
						React.createElement(
							"span",
							{ className: "cds-settings-stat-label" },
							"Fast formatters",
						),
						React.createElement(
							"span",
							{ className: "cds-settings-stat-value" },
							`${enabledFormatters} of 3 enabled`,
						),
					),
				),
				React.createElement(SettingsGroup, {
					fields: documentationFields,
					heading: "Documentation enforcement",
					summary:
						"Choose which source families must include their required documentation.",
					status: `${enabledLanguages} of 5 languages`,
					scope,
					value,
					writable: snapshot.writable,
				}),
				React.createElement(SettingsGroup, {
					fields: formatterFields,
					heading: "Pre-write formatter enforcement",
					summary:
						"Check pending content with provisioned, pinned formatters before it is written.",
					status: value.formatOnWrite === true ? "Enabled" : "Disabled",
					scope,
					value,
					writable: snapshot.writable,
					disabled: value.enabled !== true,
				}),
			);
		}

		exports.name = NS;
		exports.inject = ["slots", "settingsScope"];
		exports.apply = (ctx) => {
			const scope = ctx.settingsScope.bind({ namespace: NS });
			ctx.effect(
				() => registerSettingsNavIcon(),
				`${NS}: settings navigation icon`,
			);
			ctx.slots.inject("settings.section", () =>
				ctx.slots.register(
					{
						name: "settings.section",
						id: NS,
						order: 24,
						label: () => SETTINGS_LABEL,
						inject: () => ({ scope }),
					},
					Settings,
				),
			);
		};
		return module.exports;
	},
});
