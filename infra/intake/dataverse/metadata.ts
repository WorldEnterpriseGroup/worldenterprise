/**
 * Dataverse metadata request bodies, built from `definition.json`. Pure: no network, so tests can check every body the
 * applier would send. The definition's types are validated here, and an unknown type or a malformed column fails loudly
 * instead of producing a half-created table.
 */

export type ColumnType = 'string' | 'memo' | 'integer' | 'boolean' | 'datetime' | 'picklist';

export interface PicklistOption {
  readonly name: string;
  readonly value: number;
  readonly label: string;
}

export interface Column {
  readonly schemaName: string;
  readonly displayName: string;
  readonly type: ColumnType;
  readonly maxLength?: number;
  readonly options?: readonly PicklistOption[];
}

export interface Lookup {
  readonly schemaName: string;
  readonly displayName: string;
  readonly target: string;
  readonly relationship: string;
}

export interface KeyDefinition {
  readonly schemaName: string;
  readonly displayName: string;
  readonly attributes: readonly string[];
}

export interface Table {
  readonly schemaName: string;
  readonly logicalName: string;
  readonly entitySetName: string;
  readonly displayName: string;
  readonly pluralDisplayName: string;
  readonly description: string;
  readonly primaryName: { readonly schemaName: string; readonly displayName: string; readonly maxLength: number };
  readonly columns: readonly Column[];
  readonly lookups: readonly Lookup[];
  readonly keys: readonly KeyDefinition[];
}

export interface Extension {
  readonly table: string;
  readonly tableSchemaName: string;
  readonly columns: readonly Column[];
  readonly keys: readonly KeyDefinition[];
}

export interface PrivilegeGrant {
  readonly table: string;
  readonly actions: readonly string[];
}

export interface Definition {
  readonly version: number;
  readonly publisher: { readonly uniqueName: string; readonly friendlyName: string; readonly customizationPrefix: string; readonly customizationOptionValuePrefix: number };
  readonly solution: { readonly uniqueName: string; readonly friendlyName: string; readonly version: string };
  readonly businessUnit: { readonly name: string };
  readonly ownerTeam: { readonly name: string };
  readonly role: { readonly name: string; readonly depth: 'Basic' | 'Local' | 'Deep' | 'Global'; readonly privileges: readonly PrivilegeGrant[] };
  readonly applicationUser: { readonly firstName: string; readonly lastName: string };
  readonly tables: readonly Table[];
  readonly extensions: readonly Extension[];
}

const LANGUAGE = 1033;
const NONE = { Value: 'None' } as const;

export function label(text: string): Record<string, unknown> {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text, LanguageCode: LANGUAGE }],
  };
}

/** The logical name of a schema name: Dataverse lower-cases it. */
export function logicalName(schemaName: string): string {
  return schemaName.toLowerCase();
}

function base(column: Column): Record<string, unknown> {
  return { SchemaName: column.schemaName, DisplayName: label(column.displayName), RequiredLevel: NONE };
}

export function attributeBody(column: Column): Record<string, unknown> {
  switch (column.type) {
    case 'string':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', AttributeType: 'String', AttributeTypeName: { Value: 'StringType' },
        FormatName: { Value: 'Text' }, MaxLength: requireLength(column), ...base(column),
      };
    case 'memo':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', AttributeType: 'Memo', AttributeTypeName: { Value: 'MemoType' },
        Format: 'TextArea', MaxLength: requireLength(column), ...base(column),
      };
    case 'integer':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', AttributeType: 'Integer', AttributeTypeName: { Value: 'IntegerType' },
        Format: 'None', MinValue: 0, MaxValue: 1_000_000, ...base(column),
      };
    case 'boolean':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata', AttributeType: 'Boolean', AttributeTypeName: { Value: 'BooleanType' },
        DefaultValue: false,
        OptionSet: { TrueOption: { Value: 1, Label: label('Yes') }, FalseOption: { Value: 0, Label: label('No') }, OptionSetType: 'Boolean' },
        ...base(column),
      };
    case 'datetime':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', AttributeType: 'DateTime', AttributeTypeName: { Value: 'DateTimeType' },
        Format: 'DateAndTime', DateTimeBehavior: { Value: 'UserLocal' }, ...base(column),
      };
    case 'picklist':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata', AttributeType: 'Picklist', AttributeTypeName: { Value: 'PicklistType' },
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata', IsGlobal: false, OptionSetType: 'Picklist',
          Options: requireOptions(column).map((option) => ({ Value: option.value, Label: label(option.label) })),
        },
        ...base(column),
      };
  }
}

function requireLength(column: Column): number {
  if (column.maxLength === undefined || !Number.isInteger(column.maxLength) || column.maxLength < 1) throw new Error(`definition: ${column.schemaName} needs a maxLength`);
  return column.maxLength;
}

function requireOptions(column: Column): readonly PicklistOption[] {
  if (column.options === undefined || column.options.length === 0) throw new Error(`definition: ${column.schemaName} needs options`);
  return column.options;
}

export function entityBody(table: Table): Record<string, unknown> {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: table.schemaName,
    DisplayName: label(table.displayName),
    DisplayCollectionName: label(table.pluralDisplayName),
    Description: label(table.description),
    OwnershipType: 'UserOwned',
    HasActivities: false,
    HasNotes: false,
    IsActivity: false,
    Attributes: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', AttributeType: 'String', AttributeTypeName: { Value: 'StringType' },
        FormatName: { Value: 'Text' }, IsPrimaryName: true, MaxLength: table.primaryName.maxLength, SchemaName: table.primaryName.schemaName,
        DisplayName: label(table.primaryName.displayName), RequiredLevel: { Value: 'None' },
      },
    ],
  };
}

export function lookupBody(table: Table, lookup: Lookup): Record<string, unknown> {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
    SchemaName: lookup.relationship,
    ReferencedEntity: lookup.target,
    ReferencingEntity: table.logicalName,
    Lookup: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata', AttributeType: 'Lookup', AttributeTypeName: { Value: 'LookupType' },
      SchemaName: lookup.schemaName, DisplayName: label(lookup.displayName), RequiredLevel: NONE,
    },
    AssociatedMenuConfiguration: { Behavior: 'UseCollectionName', Group: 'Details', Label: label(table.pluralDisplayName), Order: 10000 },
    // Deleting a contact or an account must never delete the record of what they submitted.
    CascadeConfiguration: { Assign: 'NoCascade', Delete: 'RemoveLink', Merge: 'NoCascade', Reparent: 'NoCascade', Share: 'NoCascade', Unshare: 'NoCascade' },
  };
}

export function keyBody(key: KeyDefinition): Record<string, unknown> {
  return { SchemaName: key.schemaName, DisplayName: label(key.displayName), KeyAttributes: [...key.attributes] };
}

/** `prvCreatewe_Engagement`, `prvReadContact`: the privilege name Dataverse generates for an action on a table's schema name. */
export function privilegeName(action: string, tableSchemaName: string): string {
  return `prv${action}${tableSchemaName}`;
}

export function privilegeNames(definition: Definition): readonly string[] {
  return definition.role.privileges.flatMap((grant) => grant.actions.map((action) => privilegeName(action, grant.table)));
}

export function parseDefinition(text: string): Definition {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('definition: not valid JSON');
  }
  const definition = raw as Definition;
  if (definition.version !== 1) throw new Error('definition: unsupported version');
  const prefix = `${definition.publisher.customizationPrefix}_`;
  for (const table of definition.tables) {
    if (!table.logicalName.startsWith(prefix) || logicalName(table.schemaName) !== table.logicalName) throw new Error(`definition: table ${table.schemaName} does not match its logical name or the publisher prefix`);
    const names = new Set<string>();
    for (const column of table.columns) {
      if (!column.schemaName.startsWith(prefix) || column.schemaName !== logicalName(column.schemaName)) throw new Error(`definition: column ${column.schemaName} must be a lower-case ${prefix} name`);
      if (names.has(column.schemaName)) throw new Error(`definition: duplicate column ${column.schemaName}`);
      names.add(column.schemaName);
      attributeBody(column);
    }
    for (const key of table.keys) {
      for (const attribute of key.attributes) if (!names.has(attribute)) throw new Error(`definition: key ${key.schemaName} names an unknown column ${attribute}`);
    }
  }
  for (const extension of definition.extensions) {
    for (const column of extension.columns) {
      if (!column.schemaName.startsWith(prefix)) throw new Error(`definition: extension column ${column.schemaName} must carry the ${prefix} prefix`);
      attributeBody(column);
    }
  }
  return definition;
}
