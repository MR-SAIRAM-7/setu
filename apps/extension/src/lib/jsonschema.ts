import { z } from 'zod';

/**
 * A minimal Zod → JSON Schema converter for the on-device Prompt API's
 * `responseConstraint`.
 *
 * We do NOT pull in `zod-to-json-schema` here: the extension bundle is
 * shipped to every user's browser, MV3 forbids remote code, and this covers
 * exactly the constructs used in `packages/core/src/schemas.ts` in ~90 lines.
 * The cloud path uses the AI SDK's own converter, so this is only ever
 * exercised on the L1 rung.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return convert(schema);
}

function convert(s: z.ZodTypeAny): Record<string, unknown> {
  const def = s._def as Record<string, unknown>;
  const typeName = def.typeName as string;
  const description = s.description;

  const withMeta = (o: Record<string, unknown>): Record<string, unknown> =>
    description ? { ...o, description } : o;

  switch (typeName) {
    case 'ZodString': {
      const out: Record<string, unknown> = { type: 'string' };
      for (const c of (def.checks as Array<{ kind: string; value?: number }>) ?? []) {
        if (c.kind === 'max' && c.value !== undefined) out.maxLength = c.value;
        if (c.kind === 'min' && c.value !== undefined) out.minLength = c.value;
      }
      return withMeta(out);
    }
    case 'ZodNumber': {
      const isInt = ((def.checks as Array<{ kind: string }>) ?? []).some((c) => c.kind === 'int');
      const out: Record<string, unknown> = { type: isInt ? 'integer' : 'number' };
      for (const c of (def.checks as Array<{ kind: string; value?: number }>) ?? []) {
        if (c.kind === 'min' && c.value !== undefined) out.minimum = c.value;
        if (c.kind === 'max' && c.value !== undefined) out.maximum = c.value;
      }
      return withMeta(out);
    }
    case 'ZodBoolean':
      return withMeta({ type: 'boolean' });
    case 'ZodLiteral':
      return withMeta({ type: 'string', enum: [def.value] });
    case 'ZodEnum':
      return withMeta({ type: 'string', enum: def.values as string[] });
    case 'ZodArray': {
      const out: Record<string, unknown> = {
        type: 'array',
        items: convert(def.type as z.ZodTypeAny),
      };
      const exact = def.exactLength as { value: number } | null;
      const min = def.minLength as { value: number } | null;
      const max = def.maxLength as { value: number } | null;
      if (exact) {
        out.minItems = exact.value;
        out.maxItems = exact.value;
      }
      if (min) out.minItems = min.value;
      if (max) out.maxItems = max.value;
      return withMeta(out);
    }
    case 'ZodObject': {
      const shape = (def.shape as () => Record<string, z.ZodTypeAny>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!isOptional(value)) required.push(key);
      }
      return withMeta({ type: 'object', properties, required, additionalProperties: false });
    }
    case 'ZodOptional':
    case 'ZodDefault':
      return convert(def.innerType as z.ZodTypeAny);
    case 'ZodNullable': {
      const inner = convert(def.innerType as z.ZodTypeAny);
      return withMeta({ ...inner, nullable: true });
    }
    case 'ZodDiscriminatedUnion':
    case 'ZodUnion': {
      const options = (def.options as z.ZodTypeAny[]) ?? [];
      return withMeta({ anyOf: options.map(convert) });
    }
    default:
      // Unknown construct: emit the permissive shape rather than crashing.
      // A loose constraint still beats no on-device path at all.
      return withMeta({ type: 'object' });
  }
}

function isOptional(s: z.ZodTypeAny): boolean {
  const t = (s._def as { typeName?: string }).typeName;
  return t === 'ZodOptional' || t === 'ZodDefault';
}
