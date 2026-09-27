import { styleTags, tags as t } from "@lezer/highlight";

export const luaHighlighting = styleTags({
  "if then elseif else end while do repeat until for in return break goto continue":
    t.controlKeyword,
  "function local global": t.definitionKeyword,
  "type export typeof read write": t.keyword,
  "and or not": t.operatorKeyword,
  nil: t.null,
  Boolean: t.bool,

  VariableName: t.variableName,
  VariableDefinition: t.definition(t.variableName),
  "LocalFunctionDeclaration/VariableDefinition GlobalDeclaration/VariableDefinition":
    t.function(t.definition(t.variableName)),
  "FunctionName/VariableName": t.function(t.variableName),
  "FunctionName/PropertyName": t.function(t.definition(t.propertyName)),
  "CallExpression/VariableName": t.function(t.variableName),
  "CallExpression/PropertyName CallExpression/MemberExpression/PropertyName": t.function(
    t.propertyName
  ),
  PropertyName: t.propertyName,
  "Field/PropertyName TypeProperty/PropertyName": t.definition(t.propertyName),
  VarArgs: t.special(t.variableName),

  TypeName: t.typeName,
  TypeDefinition: t.definition(t.typeName),
  ModuleName: t.namespace,
  Attribute: t.annotation,
  AttributeName: t.modifier,
  "Label LabelName": t.labelName,

  Number: t.number,
  "String LongString InterpolatedString": t.string,
  Escape: t.escape,
  'InterpolationStart Interpolation/"}"': t.special(t.brace),
  LineComment: t.lineComment,
  BlockComment: t.blockComment,

  ArithOp: t.arithmeticOperator,
  BitOp: t.bitwiseOperator,
  CompareOp: t.compareOperator,
  "ConcatOp LengthOp": t.operator,
  CompoundOp: t.updateOperator,
  "=": t.definitionOperator,
  '"::" "->" "?" UnionType/"|" IntersectionType/"&"': t.typeOperator,
  "( )": t.paren,
  "[ ]": t.squareBracket,
  "{ }": t.brace,
  ". :": t.derefOperator,
  ", ;": t.separator
});
