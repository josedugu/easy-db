const encode = (value: string) => encodeURIComponent(value);

export const connectionNodeId = (connectionId: string) =>
  `conn:${encode(connectionId)}`;

export const schemaNodeId = (connectionId: string, schema: string) =>
  `${connectionNodeId(connectionId)}:schema:${encode(schema)}`;

export const categoryNodeId = (
  connectionId: string,
  schema: string,
  category: string
) =>
  `${schemaNodeId(connectionId, schema)}:category:${encode(category)}`;

export const itemNodeId = (
  connectionId: string,
  schema: string,
  category: string,
  name: string
) =>
  `${categoryNodeId(connectionId, schema, category)}:item:${encode(name)}`;
