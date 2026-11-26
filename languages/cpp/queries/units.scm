; Names every function definition and class as a documentable unit.
; The engine takes class names from the grammar's name field and function
; names from the declarator's identifier.
(function_definition) @unit
(class_specifier) @unit
