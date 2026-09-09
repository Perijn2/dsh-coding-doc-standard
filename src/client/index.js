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
		const React = require("react");
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

		/**
		 * Renders one accessible boolean settings control.
		 *
		 * @param {{checked: boolean, description: string, disabled: boolean, label: string, onChange: Function}} properties - Control properties.
		 * @returns {React.ReactElement} Labeled checkbox control.
		 */
		function Toggle({ checked, description, disabled, label, onChange }) {
			return React.createElement(
				"label",
				{ style: { display: "block", margin: "12px 0" } },
				React.createElement("input", {
					type: "checkbox",
					checked,
					disabled,
					onChange: (event) => {
						onChange(event.target.checked);
					},
				}),
				React.createElement("strong", { style: { marginLeft: 8 } }, label),
				React.createElement(
					"span",
					{ style: { display: "block", marginLeft: 24, opacity: 0.75 } },
					description,
				),
			);
		}

		/**
		 * Renders a grouped set of settings controls.
		 *
		 * @param {{fields: Array<[string, string, string]>, heading: string, scope: object, value: object, disabled?: boolean}} properties - Group properties.
		 * @returns {React.ReactElement} Settings group.
		 */
		function SettingsGroup({
			fields,
			heading,
			scope,
			value,
			disabled = false,
		}) {
			return React.createElement(
				"section",
				{ style: { marginTop: 24 } },
				React.createElement("h2", null, heading),
				...fields.map(([key, label, description]) =>
					React.createElement(Toggle, {
						key,
						checked: value[key] === true,
						description,
						disabled: disabled || !scope.writable,
						label,
						onChange: (next) => {
							void scope.set(key, next);
						},
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
				scope.subscribe,
				scope.getSnapshot,
				scope.getSnapshot,
			);
			if (snapshot.status !== "ready") return null;
			const value = snapshot.value ?? {};
			return React.createElement(
				"section",
				null,
				React.createElement("h1", null, "Coding Documentation Standard"),
				React.createElement(
					"p",
					null,
					"Control documentation validation and pinned fast formatting before writes.",
				),
				React.createElement(SettingsGroup, {
					fields: documentationFields,
					heading: "Documentation enforcement",
					scope,
					value,
				}),
				React.createElement(SettingsGroup, {
					fields: formatterFields,
					heading: "Pre-write formatter enforcement",
					scope,
					value,
					disabled: value.enabled !== true,
				}),
			);
		}

		return {
			name: "coding-doc-standard",
			inject: ["slots", "settingsScope"],
			apply: (ctx) => {
				const scope = ctx.settingsScope.bind({
					namespace: "coding-doc-standard",
				});
				ctx.slots.inject("settings.section", () =>
					ctx.slots.register(
						{
							name: "settings.section",
							id: "coding-doc-standard",
							order: 24,
							label: () => "Coding Documentation Standard",
							inject: () => ({ scope }),
						},
						Settings,
					),
				);
			},
		};
	},
});
