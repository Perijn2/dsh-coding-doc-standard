/**
 * @module coding-doc-standard-client
 * @author Perijn Huijser
 * Registers language-focused documentation, formatter, and hook controls in the web client.
 *
 * @remarks
 * Usage:
 *   Core principle: Group every language's policy in one expandable card while
 *   leaving policy execution and formatter versions to the host plugin.
 *   Setup: The DSH client loads this package through the manifest client roster.
 *   Workflow: Bind the settings namespace, expand a language card, and persist
 *   documentation, formatter, and custom public-unit hook settings through it.
 *   API guide: The module exports Cordis-compatible name, inject, and apply fields.
 *   Worked example: Open Coding Documentation Standard in Settings and configure
 *   the language whose pending writes should be checked.
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
		const languages = [
			{
				key: "python",
				label: "Python",
				summary: "Module and public-unit documentation.",
				formatter: ["formatPython", "Ruff 0.16.6"],
			},
			{
				key: "typescriptJavascript",
				label: "TypeScript / JavaScript",
				summary: "Module and exported-unit documentation.",
				formatter: ["formatTypescriptJavascript", "Biome 2.5.12"],
			},
			{
				key: "rust",
				label: "Rust",
				summary: "Module and public-item documentation.",
				formatter: ["formatRust", "rustfmt"],
				hook: true,
			},
			{
				key: "cCpp",
				label: "C / C++",
				summary: "Doxygen-compatible file and public-unit documentation.",
				hook: true,
			},
			{
				key: "dockerCompose",
				label: "Docker Compose",
				summary: "Root and service documentation comments.",
				formatter: ["formatDockerCompose", "Prettier 3.9.6"],
			},
			{
				key: "go",
				label: "Go",
				summary: "Package and public-unit documentation.",
				hook: true,
			},
			{
				key: "csharp",
				label: "C#",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "java",
				label: "Java",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "kotlin",
				label: "Kotlin",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "shell",
				label: "Shell",
				summary: "Script and project-defined public-unit documentation.",
				hook: true,
			},
			{
				key: "php",
				label: "PHP",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "ruby",
				label: "Ruby",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "swift",
				label: "Swift",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "dart",
				label: "Dart",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
			{
				key: "haskell",
				label: "Haskell",
				summary: "Module and public-unit documentation.",
				hook: true,
			},
			{
				key: "lua",
				label: "Lua",
				summary: "Source and project-defined public-unit documentation.",
				hook: true,
			},
			{
				key: "scala",
				label: "Scala",
				summary: "Source and public-unit documentation.",
				hook: true,
			},
		];
		const settingsCss = `
.cds-settings-section { display:flex; width:100%; max-width:760px; flex-direction:column; gap:16px; color:var(--dsw-alias-label-primary); }
.cds-settings-header { display:flex; flex-direction:column; gap:5px; padding:0 2px; }
.cds-settings-heading { margin:0; font-size:20px; font-weight:600; line-height:28px; }
.cds-settings-summary { margin:0; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
.cds-settings-overview { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
.cds-settings-stat { display:flex; min-width:0; flex-direction:column; gap:2px; padding:13px 14px; border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-layer-3); }
.cds-settings-stat-label { color:var(--dsw-alias-label-tertiary); font-size:11px; font-weight:500; line-height:16px; }
.cds-settings-stat-value { font-size:13px; font-weight:600; line-height:20px; }
.cds-settings-list { display:flex; flex-direction:column; gap:10px; }
.cds-language-card { overflow:hidden; border:1px solid var(--dsw-alias-border-l2); border-radius:14px; background:var(--dsw-alias-bg-layer-3); }
.cds-language-summary { display:flex; align-items:center; gap:12px; padding:14px 16px; cursor:pointer; list-style:none; }
.cds-language-summary::-webkit-details-marker { display:none; }
.cds-language-chevron { width:8px; height:8px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(-45deg); transition:transform .15s; }
.cds-language-card[open] .cds-language-chevron { transform:rotate(45deg); }
.cds-language-copy { display:flex; min-width:0; flex:1; flex-direction:column; gap:2px; }
.cds-language-title { font-size:14px; font-weight:600; line-height:20px; }
.cds-language-description,.cds-settings-description,.cds-field-help { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.cds-language-status { border-radius:999px; padding:2px 8px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); font-size:11px; line-height:16px; }
.cds-language-body { padding:0 16px 8px; border-top:1px solid var(--dsw-alias-border-l2); }
.cds-settings-row { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 2px; border-bottom:1px solid var(--dsw-alias-border-l2); }
.cds-settings-row-text,.cds-text-field { display:flex; min-width:0; flex-direction:column; gap:3px; }
.cds-settings-title,.cds-field-label { font-size:13px; font-weight:500; line-height:20px; }
.cds-switch { position:relative; display:inline-flex; flex:none; cursor:pointer; }
.cds-switch-input { position:absolute; width:1px; height:1px; margin:0; opacity:0; }
.cds-switch-track { display:inline-flex; box-sizing:border-box; align-items:center; width:36px; height:20px; padding:2px; border:1px solid var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-layer-2); transition:background .15s,border-color .15s; }
.cds-switch-thumb { display:block; width:14px; height:14px; border-radius:50%; background:var(--dsw-alias-label-tertiary); transition:transform .15s,background .15s; }
.cds-switch-input:checked + .cds-switch-track { border-color:var(--dsw-alias-button-primary-fill); background:var(--dsw-alias-button-primary-fill); }
.cds-switch-input:checked + .cds-switch-track .cds-switch-thumb { transform:translate(16px); background:var(--dsw-alias-bg-layer-3); }
.cds-switch-input:focus-visible + .cds-switch-track { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.cds-switch-input:disabled + .cds-switch-track { cursor:not-allowed; opacity:.5; }
.cds-hook { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; padding:14px 2px 8px; }
.cds-hook-heading { grid-column:1/-1; font-size:12px; font-weight:600; }
.cds-text-input { box-sizing:border-box; width:100%; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:7px 9px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); font:inherit; font-size:12px; }
.cds-text-input:focus { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
@media (max-width:520px) { .cds-settings-overview,.cds-hook { grid-template-columns:minmax(0,1fr); } }
@media (prefers-reduced-motion:reduce) { .cds-language-chevron,.cds-switch-track,.cds-switch-thumb { transition:none; } }
[data-coding-doc-standard-settings-nav] > svg:first-child { display:none; }
[data-coding-doc-standard-settings-nav]::before { content:''; flex:none; width:16px; height:16px; background:currentColor; -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z'/%3E%3Cpath d='M14 2v6h6M8 13h8M8 17h8M8 9h2'/%3E%3C/svg%3E") center/contain no-repeat; mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z'/%3E%3Cpath d='M14 2v6h6M8 13h8M8 17h8M8 9h2'/%3E%3C/svg%3E") center/contain no-repeat; }
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
		 * Marks the plugin Settings navigation item.
		 *
		 * @returns {() => void} Observer disposer.
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
		 * Renders an accessible boolean setting.
		 *
		 * @param {object} properties - Toggle properties.
		 * @returns {React.ReactElement} Toggle row.
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
		 * Renders a setting committed when focus leaves the field.
		 *
		 * @param {object} properties - Text setting properties.
		 * @returns {React.ReactElement} Text field.
		 */
		function TextSetting({
			disabled,
			help,
			label,
			onCommit,
			type = "text",
			value,
		}) {
			const [draft, setDraft] = React.useState(value ?? "");
			React.useEffect(() => setDraft(value ?? ""), [value]);
			return React.createElement(
				"label",
				{ className: "cds-text-field" },
				React.createElement("span", { className: "cds-field-label" }, label),
				React.createElement("input", {
					className: "cds-text-input",
					type,
					disabled,
					value: draft,
					onChange: (event) => setDraft(event.target.value),
					onBlur: () => {
						if (`${value ?? ""}` !== draft) void onCommit(draft);
					},
				}),
				help
					? React.createElement("span", { className: "cds-field-help" }, help)
					: null,
			);
		}

		/**
		 * Renders one expandable language configuration card.
		 *
		 * @param {object} properties - Language card properties.
		 * @returns {React.ReactElement} Language card.
		 */
		function LanguageCard({ language, scope, value, writable }) {
			const enabled = value[language.key] === true;
			const hookPrefix = `${language.key}Hook`;
			return React.createElement(
				"details",
				{ className: "cds-language-card" },
				React.createElement(
					"summary",
					{ className: "cds-language-summary" },
					React.createElement("span", {
						className: "cds-language-chevron",
						"aria-hidden": "true",
					}),
					React.createElement(
						"span",
						{ className: "cds-language-copy" },
						React.createElement(
							"span",
							{ className: "cds-language-title" },
							language.label,
						),
						React.createElement(
							"span",
							{ className: "cds-language-description" },
							language.summary,
						),
					),
					React.createElement(
						"span",
						{ className: "cds-language-status" },
						enabled ? "Enabled" : "Disabled",
					),
				),
				React.createElement(
					"div",
					{ className: "cds-language-body" },
					React.createElement(Toggle, {
						checked: enabled,
						disabled: !writable || value.enabled !== true,
						label: `Enable ${language.label}`,
						description:
							"Enforce both file/header and public-unit documentation supported by this profile.",
						onChange: (next) => void scope.set(language.key, next),
					}),
					language.formatter
						? React.createElement(Toggle, {
								checked: value[language.formatter[0]] === true,
								disabled: !writable || !enabled || value.formatOnWrite !== true,
								label: `Enable formatter (${language.formatter[1]})`,
								description:
									"Check pending content with this language formatter before writing.",
								onChange: (next) => void scope.set(language.formatter[0], next),
							})
						: null,
					language.hook
						? React.createElement(
								"div",
								{ className: "cds-hook" },
								React.createElement(
									"div",
									{ className: "cds-hook-heading" },
									"Custom public-unit hook",
								),
								React.createElement(TextSetting, {
									disabled: !writable || !enabled,
									label: "Command",
									help: "Leave empty to use no custom adapter.",
									value: value[`${hookPrefix}Command`],
									onCommit: (next) => scope.set(`${hookPrefix}Command`, next),
								}),
								React.createElement(TextSetting, {
									disabled: !writable || !enabled,
									label: "Arguments",
									help: 'JSON string array, for example ["--project","."].',
									value: value[`${hookPrefix}Args`],
									onCommit: (next) => scope.set(`${hookPrefix}Args`, next),
								}),
								React.createElement(TextSetting, {
									disabled: !writable || !enabled,
									label: "Working directory",
									help: "Optional; defaults to the pending write workspace.",
									value: value[`${hookPrefix}Cwd`],
									onCommit: (next) => scope.set(`${hookPrefix}Cwd`, next),
								}),
								React.createElement(TextSetting, {
									disabled: !writable || !enabled,
									label: "Timeout (ms)",
									type: "number",
									help: "From 1 to 60000 milliseconds.",
									value: value[`${hookPrefix}TimeoutMs`],
									onCommit: (next) =>
										scope.set(`${hookPrefix}TimeoutMs`, Number(next) || 10000),
								}),
							)
						: null,
				),
			);
		}

		/**
		 * Renders the complete language-focused policy settings.
		 *
		 * @param {object} properties - Bound scope.
		 * @returns {React.ReactElement | null} Settings content.
		 */
		function Settings({ scope }) {
			if (!scope) {
				return React.createElement(
					"section",
					{ className: "cds-settings-section" },
					React.createElement(
						"p",
						null,
						"Settings are unavailable in this host: the client settings service is not provided.",
					),
				);
			}
			const snapshot = React.useSyncExternalStore(
				(listener) => scope.subscribe(listener),
				() => scope.getSnapshot(),
				() => scope.getSnapshot(),
			);
			if (snapshot.status !== "ready") return null;
			const value = snapshot.value ?? {};
			const enabledLanguages = languages.filter(
				({ key }) => value[key] === true,
			).length;
			const enabledFormatters = languages.filter(
				({ formatter }) => formatter && value[formatter[0]] === true,
			).length;
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
						"Configure documentation enforcement, formatters, and custom hooks by language.",
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
							"Languages",
						),
						React.createElement(
							"span",
							{ className: "cds-settings-stat-value" },
							`${enabledLanguages} of ${languages.length} enabled`,
						),
					),
					React.createElement(
						"div",
						{ className: "cds-settings-stat" },
						React.createElement(
							"span",
							{ className: "cds-settings-stat-label" },
							"Formatters",
						),
						React.createElement(
							"span",
							{ className: "cds-settings-stat-value" },
							`${enabledFormatters} of 4 enabled`,
						),
					),
				),
				React.createElement(Toggle, {
					checked: value.enabled === true,
					disabled: !snapshot.writable,
					label: "Enable coding documentation enforcement",
					description: "Master control for all language documentation checks.",
					onChange: (next) => void scope.set("enabled", next),
				}),
				React.createElement(Toggle, {
					checked: value.formatOnWrite === true,
					disabled: !snapshot.writable || value.enabled !== true,
					label: "Enable pre-write formatter enforcement",
					description: "Master control for language formatter checks.",
					onChange: (next) => void scope.set("formatOnWrite", next),
				}),
				React.createElement(Toggle, {
					checked: value.blockOnMissingFormatter === true,
					disabled: !snapshot.writable || value.formatOnWrite !== true,
					label: "Block when a formatter is unavailable",
					description:
						"Fail closed instead of allowing unformatted pending content.",
					onChange: (next) => void scope.set("blockOnMissingFormatter", next),
				}),
				React.createElement(
					"div",
					{ className: "cds-settings-list" },
					...languages.map((language) =>
						React.createElement(LanguageCard, {
							key: language.key,
							language,
							scope,
							value,
							writable: snapshot.writable,
						}),
					),
				),
			);
		}

		exports.name = NS;
		// Cordis throws when `apply` reads a service property that the plugin
		// did not declare, so both required services must be listed here;
		// the shipped Web composition always provides `configForms`.
		exports.inject = ["slots", "configForms"];
		exports.apply = (ctx) => {
			const scope = ctx.configForms.get(NS);
			ctx.effect(
				() => registerSettingsNavIcon(),
				`${NS}: settings navigation icon`,
			);
			// Third-party plugin pages register into the Plugins page's
			// `plugins.item` slot while the host serves this namespace.
			const mount = () =>
				ctx.slots.inject("plugins.item", () =>
					ctx.slots.register(
						{
							name: "plugins.item",
							id: NS,
							order: 24,
							label: () => SETTINGS_LABEL,
							inject: () => ({ scope }),
						},
						Settings,
					),
				);
			if (typeof ctx.configForms?.whileServed === "function") {
				ctx.effect(
					() => ctx.configForms.whileServed([NS], mount),
					`${NS}: plugins.item registration`,
				);
			} else {
				ctx.effect(mount, `${NS}: plugins.item registration`);
			}
		};
		return module.exports;
	},
});
