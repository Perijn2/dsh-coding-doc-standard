; Names every top-level type and function declaration as a documentable unit.
; Top-level functions are function_signature nodes with a sibling
; function_body; anchoring at program keeps nested function types and method
; signatures out of the unit list. Mixins carry no name field, so the engine
; falls back to the first identifier child.
(program (class_definition) @unit)
(program (mixin_declaration) @unit)
(program (enum_declaration) @unit)
(program (extension_declaration) @unit)
(program (function_signature) @unit)
