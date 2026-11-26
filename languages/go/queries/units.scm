; Names every function, method, and named type as a documentable unit.
; The engine derives each unit's name from the grammar's name field, or,
; for a type, from the first identifier inside the declaration. type_spec
; is not captured because its node starts after the "type" keyword, which
; breaks the doc comment binding above the declaration.
(function_declaration) @unit
(method_declaration) @unit
(type_declaration) @unit
