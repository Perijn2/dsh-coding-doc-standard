# Declaration naming

Naming is a style policy, not a replacement for the compiler's identifier rules. Profile naming rules select declaration names with Tree-sitter queries; they do not rename code, inspect arbitrary references, or infer that an immutable-looking variable is a semantic constant. External interfaces, overrides, generated names, operators, and framework-mandated names need conservative exclusions.

## Authoritative conventions

`UpperCamelCase` below includes names commonly called PascalCase. These recommendations are not syntax requirements unless explicitly marked.

| Language | Types | Functions / methods | Constants / enum members | Important qualification and source |
| --- | --- | --- | --- | --- |
| Python | CapWords | snake_case | UPPER_CASE; enum members strongly recommended UPPER_CASE | Existing APIs may retain mixedCase; callable-style classes can follow function naming. Preserve documented dunder methods. Acronyms stay uppercase, e.g. HTTPServerError. [PEP 8](https://peps.python.org/pep-0008/#naming-conventions), [Enum HOWTO](https://docs.python.org/3/howto/enum.html) |
| Rust | UpperCamelCase types and traits | snake_case | SCREAMING_SNAKE_CASE constants/statics; UpperCamelCase enum variants | Acronyms are words: Uuid, not UUID. Trait implementations must preserve the trait's names. [Rust API Guidelines](https://rust-lang.github.io/api-guidelines/naming.html) |
| Go | MixedCaps or mixedCaps | MixedCaps or mixedCaps | Same MixedCaps/mixedCaps rule; no special ALL_CAPS convention | Initial capitalization controls export visibility in the language. Packages use short lowercase names. Go has enumerated constants rather than an enum declaration. [Effective Go](https://go.dev/doc/effective_go#names) |
| Java | UpperCamelCase classes/interfaces | lowerCamelCase | UPPER_CASE constants; enum constants conventionally UPPER_CASE | Oracle's guide is archived, last revised 1999, and predates enums/records. It must not be described as a current language specification. [Oracle naming conventions](https://www.oracle.com/java/technologies/javase/codeconventions-namingconventions.html), [Java enum tutorial](https://docs.oracle.com/javase/tutorial/java/javaOO/enum.html) |
| Kotlin | UpperCamelCase classes/objects | lowerCamelCase | UPPER_CASE qualifying constants; enum entries may use UPPER_CASE **or** UpperCamelCase | Class-like factory functions can use UpperCamelCase; tests can use backtick names with spaces or underscores. Not every val is a constant. Two-letter acronyms stay uppercase; longer ones become words. [Kotlin coding conventions](https://kotlinlang.org/docs/coding-conventions.html#naming-rules) |
| C# | PascalCase; interfaces conventionally start with I | PascalCase | PascalCase constants, including local constants; PascalCase enum members | Microsoft's conventions are not compiler-enforced. Local variables/parameters use camelCase. Private-field prefix rules are team conventions, not universal .NET requirements. [C# identifier rules and conventions](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/identifier-names), [.NET enum naming](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/names-of-classes-structs-and-interfaces#names-of-enumerations) |
| Scala | UpperCamelCase classes/traits/objects | lowerCamelCase | True constants UpperCamelCase, not necessarily ALL_CAPS | Function-like objects may use lowerCamelCase; symbolic methods are valid. Ordinary vals are not automatically constants. Annotation classes conventionally start lowercase. [Scala style guide](https://docs.scala-lang.org/style/naming-conventions.html) |
| PHP | StudlyCaps classes/interfaces/traits in PSR-1 | camelCase **methods** | UPPER_CASE **class constants** | PHP-FIG is a community interoperability standard, not PHP syntax. PSR-1 deliberately leaves property naming unspecified and does not prescribe free-function or enum-case casing. PHP's enum examples use Hearts/Diamonds, not ALL_CAPS. [PSR-1](https://www.php-fig.org/psr/psr-1/), [PHP enums](https://www.php.net/manual/en/language.enumerations.basics.php) |
| Swift | UpperCamelCase types/protocols | lowerCamelCase | lowerCamelCase constants and enum cases | Official API guide says types/protocols UpperCamelCase, everything else lowerCamelCase. Preserve conventional acronym capitalization: URL/utf8 as appropriate to position. Operators are not word-case names. [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/) |
| Dart | UpperCamelCase classes/enums/typedefs/type parameters/extensions | lowerCamelCase | Prefer lowerCamelCase, including enum values | Existing APIs/generated code may retain SCREAMING_CAPS. Acronyms longer than two letters become words. Leading underscore denotes library privacy. [Effective Dart: Style](https://dart.dev/effective-dart/style) |

These tables describe the guides, not a promise that every declaration kind or exception is statically checked. Profiles deliberately select a narrower, mechanically identifiable subset; they do not infer Python constants, deeply immutable Kotlin values, or Scala constant semantics.

## Enabled check/block coverage

| Profile | Checked declarations |
| --- | --- |
| Python | Classes and functions/methods; explicit `@override` and `@typing.override` methods exempt |
| Rust | Structs, enums, traits, type aliases, variants; functions/signatures, inherent methods; constants/statics and inherent associated constants; modules and named fields. Trait implementation methods/constants exempt |
| Go | Functions, methods, named types and every name in constant declarations; either exported or unexported capitalization retained |
| Java | Classes, interfaces, enums, records; methods except `@Override`; enum constants and explicitly `static final` fields |
| Kotlin | Classes/objects; unmodified, unannotated functions (MixedCaps permits class-like factories); `const` properties. Modified/annotated functions and backtick names exempt; enum entries unchecked because both conventions are valid |
| C# | Classes, structs, interfaces, enums, records; methods except explicit interface implementations and `override`; enum members; `const` fields and locals |
| Scala | Classes/traits except directly identified `StaticAnnotation` subclasses; named function definitions. Symbolic and backtick names exempt; objects and vals unchecked |
| PHP | Classes/interfaces/traits, methods except magic `__` methods, class/interface/trait constants. Free functions and enum cases unchecked |
| Swift | Types/protocols, identifier-named functions except `override`, enum cases. Operators and backtick identifiers exempt; ordinary bindings unchecked |
| Dart | Classes/enums, function signatures except explicitly `@override` methods, enum values. Ordinary const bindings unchecked |

These are syntax-level casing checks, not semantic style-guide compliance. They
cannot infer whether Python classes are callable-style exceptions, resolve
inherited names without explicit override markers, distinguish all legacy API
exceptions, or verify acronym spelling (`Uuid` versus `UUID`). Untagged foreign
names can still be blocked. Leading/trailing underscores are conservatively
ignored for casing; this does not authorize reserved identifiers. Rust raw
identifier prefixes and C# verbatim identifier prefixes do not change casing.
Comments, string contents and references are not declaration names.

Naming is enabled with its language profile and follows the existing write-gate
language/profile switches and ignored-path rules. The detailed verifier checks
explicitly supplied paths using the default profiles before running external
tools. No conversion mode, new dependency or separate naming setting is added.

### Pack-owned rule shape

```json
{
  "naming": {
    "source": "https://rust-lang.github.io/api-guidelines/naming.html",
    "grammar": "rust",
    "rules": [{
      "query": "(struct_item name: (_) @name)",
      "style": "UpperCamelCase",
      "label": "struct"
    }]
  }
}
```

`query` selects declarations with `@name`; an `@exclude` capture exempts that
match. Optional `excludeQuery` selects exempt `@name` nodes for that rule,
`excludeNamePattern` matches raw names with a Unicode JavaScript regexp, and
`skipAncestors` lists exempt syntax-node types. Queries and regexps are trusted
pack configuration, not source-provided commands. The styles supported are
`snake_case`, `UpperCamelCase`, `lowerCamelCase`, `SCREAMING_SNAKE_CASE`,
`MixedCaps` and `lowercase`. Missing naming configuration leaves the profile
unchanged; invalid naming configuration or an unavailable grammar returns a
blocking pack finding rather than reporting a successful check.

## No universal official casing policy

Do not substitute a project's style guide for a language-wide mandate.

| Language | What an authoritative source actually establishes |
| --- | --- |
| Ruby | Official documentation specifies uppercase-initial constants, class/module constant names, and variable prefixes as syntax; methods may even start uppercase. Predicate `?` and dangerous-method `!` suffixes are conventions. This does not establish one official universal snake_case/UpperCamelCase/ALL_CAPS policy. [Ruby from other languages](https://www.ruby-lang.org/en/documentation/ruby-from-other-languages/), [Ruby syntax](https://docs.ruby-lang.org/en/master/syntax/modules_and_classes_rdoc.html) |
| Haskell | The report lexically distinguishes variable identifiers (lowercase or underscore initial) from constructor identifiers (uppercase initial); subsequent letters need not follow camelCase. Functions and ordinary constant bindings share the variable namespace; constructors of enum-like algebraic data types use constructor syntax. Operators have separate lexical rules. No whole-word casing policy is inferred. [Haskell 2010 lexical structure](https://www.haskell.org/onlinereport/haskell2010/haskellch2.html) |
| Lua | The manual defines case-sensitive identifiers and advises avoiding underscore-plus-uppercase names reserved by convention for Lua. It does not mandate snake_case functions, PascalCase types, or ALL_CAPS constants. Lua tables are not intrinsically class/enum declarations. [Lua 5.4 manual §3.1](https://www.lua.org/manual/5.4/manual.html#3.1), [Programming in Lua §1.3](https://www.lua.org/pil/1.3.html) |
| Shell | POSIX specifies portable name syntax, not a universal declaration-case style. Google's Bash guide recommends snake_case functions/variables, UPPER_CASE constants and exported variables, and optionally `package::function` names; that last form is not portable POSIX function naming. No native types/enums. [Google Shell Style Guide](https://google.github.io/styleguide/shellguide.html#s7-naming-conventions), [POSIX shell language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html) |
| C | ISO C does not mandate a coding-style casing scheme. GNU recommends lowercase underscore-separated functions/variables and uppercase macro/enum constants, but this is GNU project style, not a universal C rule. Reserved identifiers also constrain otherwise stylistic choices. [GNU naming guide](https://www.gnu.org/prep/standards/html_node/Names.html) |
| C++ | No universal official casing policy. Google's guide uses PascalCase types/functions, snake_case variables, kConstant constants and enum members, and ALL_CAPS macros; accessors may use snake_case and STL-like entities may retain STL naming. These are Google rules, not C++ requirements. [Google C++ naming](https://google.github.io/styleguide/cppguide.html#Naming) |
| TypeScript | The handbook documents enums, not a universal casing standard. The compiler repository's contributor guidelines use PascalCase types/enum values and camelCase functions, but are scoped to that repository, not a language-wide policy. [TypeScript handbook](https://www.typescriptlang.org/docs/handbook/enums.html), [TypeScript contributor guidelines](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines) |
| JavaScript | ECMAScript defines identifier syntax, not a universal casing policy. MDN's example-code guide recommends PascalCase classes and camelCase functions/methods; `const` alone does not imply an ALL_CAPS semantic constant. JavaScript has no native enum declaration. [MDN JavaScript style](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Code_style_guide/JavaScript), [ECMAScript names](https://tc39.es/ecma262/#sec-names-and-keywords) |

## Research provenance

Research used `web_search`. The `web_fetch` tool was attempted but failed because multiple fetch providers were registered without a selected provider; its schema exposed no provider selector. The primary guide pages were instead read over HTTPS using PowerShell `Invoke-WebRequest`. Links to supplementary Java enum, .NET enum, POSIX, and ECMAScript references are provided for scope/context; they were not separately fetched in this research pass.
