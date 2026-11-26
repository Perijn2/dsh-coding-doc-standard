; Names every declaration kind as a documentable unit.
; The engine derives each unit's name from the grammar's name field.
; Methods are units too, private ones included; closures are not.
(class_declaration) @unit
(interface_declaration) @unit
(trait_declaration) @unit
(enum_declaration) @unit
(function_definition) @unit
(method_declaration) @unit
