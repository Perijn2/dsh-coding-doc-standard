/**
 * @module coding-doc-standard-client
 * @author Perijn Huijser
 * Registers language-focused documentation and formatter controls in the web client.
 *
 * @remarks
 * Usage:
 *   Core principle: Render one settings group per installed language pack from
 *   the host registry catalog, keeping engine-wide controls under General.
 *   Setup: The DSH client loads this package through the manifest client roster.
 *   Workflow: Bind the settings namespace, tune General, then expand a pack
 *   card to toggle its profiles and formatters.
 *   API guide: The module exports Cordis-compatible name, inject, and apply fields.
 *   Worked example: Open Coding Documentation Standard in Settings and disable a
 *   pack profile to stop its pending-write checks.
 */

window.__ModuleLoader__.load({
	id: "coding-doc-standard",
	factory: (require) => {
		const module = { exports: {} };
		const exports = module.exports;
		const React = require("react");
		const NS = "coding-doc-standard";
		const SETTINGS_LABEL = "Coding Documentation Standard";
		const settingsCss = `
.cds-settings-section { display:flex; width:100%; max-width:820px; flex-direction:column; gap:26px; color:var(--dsw-alias-label-primary); }
.cds-settings-header { display:flex; flex-direction:column; gap:6px; }
.cds-settings-heading { margin:0; font-size:22px; font-weight:600; line-height:30px; }
.cds-settings-summary { margin:0; max-width:62ch; color:var(--dsw-alias-label-secondary); font-size:13px; line-height:20px; }
.cds-settings-block { display:flex; flex-direction:column; gap:10px; }
.cds-section-title { margin:0 2px; font-size:15px; font-weight:600; line-height:22px; }
.cds-section-note { margin:0 2px; color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.cds-settings-card { overflow:hidden; border:1px solid var(--dsw-alias-border-l2); border-radius:14px; background:var(--dsw-alias-bg-layer-3); }
.cds-settings-row { display:flex; align-items:center; justify-content:space-between; gap:20px; padding:15px 18px; }
.cds-settings-row + .cds-settings-row,.cds-field-grid { border-top:1px solid var(--dsw-alias-border-l2); }
.cds-settings-row-text,.cds-text-field { display:flex; min-width:0; flex:1; flex-direction:column; gap:3px; }
.cds-settings-title,.cds-field-label { font-size:13px; font-weight:500; line-height:20px; }
.cds-settings-description,.cds-language-description,.cds-field-help { color:var(--dsw-alias-label-tertiary); font-size:12px; line-height:18px; }
.cds-switch { position:relative; display:inline-flex; flex:none; cursor:pointer; }
.cds-switch-input { position:absolute; width:1px; height:1px; margin:0; opacity:0; }
.cds-switch-track { display:inline-flex; box-sizing:border-box; align-items:center; width:36px; height:20px; padding:2px; border:1px solid var(--dsw-alias-border-l2); border-radius:10px; background:var(--dsw-alias-bg-layer-2); transition:background .15s,border-color .15s; }
.cds-switch-thumb { display:block; width:14px; height:14px; border-radius:50%; background:var(--dsw-alias-label-tertiary); transition:transform .15s,background .15s; }
.cds-switch-input:checked + .cds-switch-track { border-color:var(--dsw-alias-button-primary-fill); background:var(--dsw-alias-button-primary-fill); }
.cds-switch-input:checked + .cds-switch-track .cds-switch-thumb { transform:translate(16px); background:var(--dsw-alias-bg-layer-3); }
.cds-switch-input:focus-visible + .cds-switch-track { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:2px; }
.cds-switch-input:disabled + .cds-switch-track { cursor:not-allowed; opacity:.5; }
.cds-field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 18px; padding:16px 18px; }
.cds-text-input { box-sizing:border-box; width:100%; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; padding:8px 10px; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); font:inherit; font-size:12px; }
.cds-text-input:focus { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:1px; }
.cds-language-card { overflow:hidden; border:1px solid var(--dsw-alias-border-l2); border-radius:14px; background:var(--dsw-alias-bg-layer-3); }
.cds-language-summary { display:flex; align-items:center; gap:14px; padding:15px 18px; cursor:pointer; list-style:none; }
.cds-language-summary::-webkit-details-marker { display:none; }
.cds-language-chevron { flex:none; width:8px; height:8px; border-right:2px solid currentColor; border-bottom:2px solid currentColor; transform:rotate(-45deg); transition:transform .15s; }
.cds-language-card[open] .cds-language-chevron { transform:rotate(45deg); }
.cds-language-copy { display:flex; min-width:0; flex:1; flex-direction:column; gap:2px; }
.cds-language-title { font-size:14px; font-weight:600; line-height:20px; }
.cds-language-status { flex:none; border-radius:999px; padding:3px 10px; color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-2); font-size:11px; line-height:16px; }
.cds-language-body { border-top:1px solid var(--dsw-alias-border-l2); }
@media (max-width:560px) { .cds-field-grid { grid-template-columns:minmax(0,1fr); } }
@media (prefers-reduced-motion:reduce) { .cds-language-chevron,.cds-switch-track,.cds-switch-thumb { transition:none; } }
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
		 * Parses the host-served JSON pack catalog (REQ-022).
		 *
		 * @param {string} [raw] - The packCatalog config value.
		 * @returns {{packs: object[], stale: string[]} | null} Catalog, or null when absent or malformed.
		 */
		function parseCatalog(raw) {
			if (typeof raw !== "string") return null;
			try {
				const parsed = JSON.parse(raw);
				if (!parsed || !Array.isArray(parsed.packs)) return null;
				return { packs: parsed.packs, stale: parsed.stale ?? [] };
			} catch {
				return null;
			}
		}

		/**
		 * Renders a section heading with an optional note.
		 *
		 * @param {object} properties - Heading text plus optional note.
		 * @returns {React.ReactElement} Section heading block.
		 */
		function SectionTitle({ note, title }) {
			return React.createElement(
				React.Fragment,
				null,
				React.createElement("h2", { className: "cds-section-title" }, title),
				note
					? React.createElement("p", { className: "cds-section-note" }, note)
					: null,
			);
		}

		/**
		 * Answers whether a pack's documentation currently enforces.
		 *
		 * @param {object} pack - Catalog pack entry.
		 * @param {object} value - Current settings values.
		 * @returns {boolean} Whether documentation checks run for this pack.
		 */
		function packDocsEnabled(pack, value) {
			if (pack.legacyDocsKey) return value[pack.legacyDocsKey] !== false;
			return !pack.profiles.some(
				(profile) => value.packs?.[pack.id]?.[profile.id] === false,
			);
		}

		/**
		 * Renders one expandable card for an installed language pack: one
		 * toggle per profile with its language version range (REQ-022,
		 * REQ-023) plus the formatters it declares.
		 *
		 * @param {object} properties - Pack entry plus scope, values, and writability.
		 * @returns {React.ReactElement} Pack card.
		 */
		function PackCard({ pack, scope, value, writable }) {
			const masterEnabled = value.enabled === true;
			const docsEnabled = packDocsEnabled(pack, value);
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
							pack.label,
						),
						React.createElement(
							"span",
							{ className: "cds-language-description" },
							pack.profiles
								.map((profile) => `${profile.id} · ${profile.languageVersions}`)
								.join(", "),
						),
					),
					React.createElement(
						"span",
						{ className: "cds-language-status" },
						docsEnabled ? "Enabled" : "Disabled",
					),
				),
				React.createElement(
					"div",
					{ className: "cds-language-body" },
					pack.legacyDocsKey
						? React.createElement(Toggle, {
								checked: value[pack.legacyDocsKey] === true,
								disabled: !writable || !masterEnabled,
								label: "Documentation",
								description:
									"Enforce this language's documentation rules before a write lands.",
								onChange: (next) => void scope.set(pack.legacyDocsKey, next),
							})
						: pack.profiles.map((profile) =>
								React.createElement(Toggle, {
									key: profile.id,
									checked: value.packs?.[pack.id]?.[profile.id] !== false,
									disabled: !writable || !masterEnabled,
									label: `Documentation (${profile.id})`,
									description: `Language versions ${profile.languageVersions}. Disable to stop this profile from enforcing.`,
									onChange: (next) =>
										void scope.mutate([
											{
												op: "set",
												path: ["packs", pack.id, profile.id],
												value: next,
											},
										]),
								}),
							),
					...pack.profiles.map((profile) =>
						profile.formatterSettingsKey
							? React.createElement(Toggle, {
									key: profile.id,
									checked: value[profile.formatterSettingsKey] === true,
									disabled:
										!writable || !docsEnabled || value.formatOnWrite !== true,
									label: `Format (${profile.formatterLabel ?? "formatter"})`,
									description:
										"Check pending content with this pack formatter before writing.",
									onChange: (next) =>
										void scope.set(profile.formatterSettingsKey, next),
								})
							: null,
					),
				),
			);
		}

		/**
		 * Renders the not-installed entry for policy that references an absent
		 * pack, so stale policy stays visible (REQ-024).
		 *
		 * @param {object} properties - Stale pack id.
		 * @returns {React.ReactElement} Not-installed card.
		 */
		function StalePackCard({ id }) {
			return React.createElement(
				"div",
				{ className: "cds-language-card" },
				React.createElement(
					"div",
					{ className: "cds-language-summary" },
					React.createElement(
						"span",
						{ className: "cds-language-copy" },
						React.createElement(
							"span",
							{ className: "cds-language-title" },
							id,
						),
						React.createElement(
							"span",
							{ className: "cds-language-description" },
							"Policy references a pack that is absent. Reinstall the pack to enforce it again.",
						),
					),
					React.createElement(
						"span",
						{ className: "cds-language-status" },
						"Not installed",
					),
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
			const catalog = parseCatalog(value.packCatalog);
			const packs = catalog ? catalog.packs : [];
			const stalePacks = catalog ? catalog.stale : [];
			const writable = snapshot.writable;
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
						"Enforcement follows the installed language packs; engine-wide controls live under General.",
					),
				),
				React.createElement(
					"div",
					{ className: "cds-settings-card" },
					React.createElement(Toggle, {
						checked: value.enabled === true,
						disabled: !writable,
						label: "Enable coding documentation enforcement",
						description: "Master control for every pack and formatter below.",
						onChange: (next) => void scope.set("enabled", next),
					}),
				),
				React.createElement(
					"section",
					{ className: "cds-settings-block" },
					React.createElement(SectionTitle, {
						title: "General",
						note: "Engine-wide controls shared by every language pack.",
					}),
					React.createElement(
						"div",
						{ className: "cds-settings-card" },
						React.createElement(Toggle, {
							checked: value.formatOnWrite === true,
							disabled: !writable || value.enabled !== true,
							label: "Enable pre-write formatter enforcement",
							description: "Master control for language formatter checks.",
							onChange: (next) => void scope.set("formatOnWrite", next),
						}),
						React.createElement(Toggle, {
							checked: value.blockOnMissingFormatter === true,
							disabled: !writable || value.formatOnWrite !== true,
							label: "Block when a formatter is unavailable",
							description:
								"Fail closed instead of allowing unformatted pending content.",
							onChange: (next) =>
								void scope.set("blockOnMissingFormatter", next),
						}),
						React.createElement(Toggle, {
							checked: value.systemPromptAdvisory === true,
							disabled: !writable,
							label: "System-prompt advisory",
							description:
								"Tell the agent the documentation rules before it writes.",
							onChange: (next) => void scope.set("systemPromptAdvisory", next),
						}),
						React.createElement(Toggle, {
							checked: value.validatorFailOpen === true,
							disabled: !writable,
							label: "Allow writes when a check cannot finish",
							description:
								"Fail open with a visible notice. Turn off to block instead.",
							onChange: (next) => void scope.set("validatorFailOpen", next),
						}),
						React.createElement(
							"div",
							{ className: "cds-field-grid" },
							React.createElement(TextSetting, {
								disabled: !writable,
								label: "Validation budget (ms)",
								type: "number",
								help: "Shared budget for every check on one pending write, at least 1000.",
								value: `${value.validatorTimeoutMs ?? ""}`,
								onCommit: (next) =>
									scope.set("validatorTimeoutMs", Number(next) || 20000),
							}),
							React.createElement(TextSetting, {
								disabled: !writable,
								label: "Maximum findings per denial",
								type: "number",
								help: "Longer finding lists are truncated in the denial message.",
								value: `${value.aggregateMaxFindings ?? ""}`,
								onCommit: (next) =>
									scope.set("aggregateMaxFindings", Number(next) || 15),
							}),
							React.createElement(TextSetting, {
								disabled: !writable,
								label: "Matched tools",
								help: "Comma-separated tool names or globs the guard watches.",
								value: value.matchedTools ?? "",
								onCommit: (next) => scope.set("matchedTools", next),
							}),
							React.createElement(TextSetting, {
								disabled: !writable,
								label: "Ignored paths",
								help: "Extra comma-separated globs to skip. Vendored, generated, minified, and lockfile paths are always skipped.",
								value: value.ignoredPaths ?? "",
								onCommit: (next) => scope.set("ignoredPaths", next),
							}),
						),
					),
				),
				React.createElement(
					"section",
					{ className: "cds-settings-block" },
					React.createElement(SectionTitle, {
						title: "Language packs",
						note: "One group per installed pack, listing each profile's language version range.",
					}),
					catalog
						? React.createElement(
								React.Fragment,
								null,
								...packs.map((pack) =>
									React.createElement(PackCard, {
										key: pack.id,
										pack,
										scope,
										value,
										writable,
									}),
								),
								...stalePacks.map((id) =>
									React.createElement(StalePackCard, { key: id, id }),
								),
								packs.length === 0 && stalePacks.length === 0
									? React.createElement(
											"p",
											{ className: "cds-section-note" },
											"No language packs are installed.",
										)
									: null,
							)
						: React.createElement(
								"p",
								{ className: "cds-section-note" },
								"The pack catalog is unavailable; restart the application after installing language packs.",
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
			// A full Settings page registers through the `settings.section`
			// slot, the same contribution the built-in feature pages use,
			// while the host serves this namespace.
			const mount = () =>
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
			if (typeof ctx.configForms?.whileServed === "function") {
				ctx.effect(
					() => ctx.configForms.whileServed([NS], mount),
					`${NS}: settings.section registration`,
				);
			} else {
				ctx.effect(mount, `${NS}: settings.section registration`);
			}
		};
		return module.exports;
	},
});
