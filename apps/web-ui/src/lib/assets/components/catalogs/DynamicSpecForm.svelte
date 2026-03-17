<script lang="ts">
  import { _, isLoading } from '$lib/i18n';
  import type { CategorySpecDef, SpecFieldType } from '$lib/api/assetCatalogs';

  let {
    specDefs = [],
    spec = $bindable<Record<string, unknown>>({}),
    errors = {}
  } = $props<{
    specDefs?: CategorySpecDef[];
    spec?: Record<string, unknown>;
    errors?: Record<string, string>;
  }>();

  function setValue(key: string, value: unknown) {
    const next = { ...spec };
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      delete next[key];
    } else {
      next[key] = value;
    }
    spec = next;
  }

  function getStringValue(key: string): string {
    const value = spec[key];
    return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  }

  function getNumberValue(key: string): string {
    const value = spec[key];
    return typeof value === 'number' && !Number.isNaN(value) ? String(value) : '';
  }

  function getBooleanValue(key: string): boolean {
    return spec[key] === true;
  }

  function getMultiEnumValue(key: string): string[] {
    const value = spec[key];
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  }

  function toggleMultiEnum(key: string, option: string, checked: boolean) {
    const current = new Set(getMultiEnumValue(key));
    if (checked) {
      current.add(option);
    } else {
      current.delete(option);
    }
    setValue(key, Array.from(current));
  }

  let jsonDrafts = $state<Record<string, string>>({});
  let jsonErrors = $state<Record<string, string>>({});

  function getJsonDraftValue(key: string): string {
    if (jsonDrafts[key] !== undefined) return jsonDrafts[key];
    const value = spec[key];
    if (value === undefined || value === null || value === '') return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function setJsonValue(key: string, raw: string) {
    jsonDrafts = { ...jsonDrafts, [key]: raw };
    if (!raw.trim()) {
      setValue(key, undefined);
      clearJsonError(key);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setValue(key, parsed);
      clearJsonError(key);
    } catch {
      jsonErrors = { ...jsonErrors, [key]: 'Invalid JSON' };
    }
  }

  function clearJsonError(key: string) {
    if (!jsonErrors[key]) return;
    const next = { ...jsonErrors };
    delete next[key];
    jsonErrors = next;
  }

  const placeholderByType: Partial<Record<SpecFieldType, string>> = {
    ip: '192.168.10.10',
    mac: 'AA:BB:CC:DD:EE:FF',
    hostname: 'host-01',
    cidr: '192.168.10.0/24',
    port: '443',
    regex: 'Match pattern',
    json: '{ "key": "value" }'
  };

  $effect(() => {
    if (specDefs.length === 0) return;
    const next = { ...spec };
    let changed = false;
    for (const def of specDefs) {
      if (next[def.key] === undefined && def.defaultValue !== undefined && def.defaultValue !== null && def.defaultValue !== '') {
        next[def.key] = def.defaultValue;
        changed = true;
      }
    }
    if (changed) {
      spec = next;
    }
  });
</script>

<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  {#each specDefs as def}
    <div class="space-y-1">
      {#if def.fieldType !== 'boolean'}
        <p class="label-base mb-1">
          {def.label}{def.required ? ' *' : ''}{def.unit ? ` (${def.unit})` : ''}
        </p>
      {/if}

      {#if def.fieldType === 'string'}
        <input
          class="input-base"
          value={getStringValue(def.key)}
          disabled={def.isReadonly}
          oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
        />
      {:else if def.fieldType === 'number'}
        <input
          class="input-base"
          type="number"
          value={getNumberValue(def.key)}
          min={def.minValue ?? undefined}
          max={def.maxValue ?? undefined}
          step={def.stepValue ?? undefined}
          disabled={def.isReadonly}
          oninput={(event) => {
            const value = (event.currentTarget as HTMLInputElement).value;
            if (!value) {
              setValue(def.key, undefined);
              return;
            }
            const parsed = Number(value);
            setValue(def.key, Number.isNaN(parsed) ? undefined : parsed);
          }}
        />
      {:else if def.fieldType === 'boolean'}
        <label class="flex items-center gap-2 text-sm text-slate-400">
          <input
            type="checkbox"
            class="rounded border-slate-300"
            checked={getBooleanValue(def.key)}
            disabled={def.isReadonly}
            onchange={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).checked)}
          />
          {def.label}{def.required ? ' *' : ''}{def.unit ? ` (${def.unit})` : ''}
        </label>
      {:else if def.fieldType === 'enum'}
        <select
          class="select-base"
          value={getStringValue(def.key)}
          disabled={def.isReadonly}
          onchange={(event) => setValue(def.key, (event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="">{$isLoading ? 'Select option' : $_('assets.placeholders.selectOption')}</option>
          {#each def.enumValues ?? [] as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      {:else if def.fieldType === 'multi_enum'}
        <div class="flex flex-wrap gap-3">
          {#each def.enumValues ?? [] as option}
            <label class="flex items-center gap-2 text-sm text-slate-400">
              <input
                type="checkbox"
                class="rounded border-slate-300"
                checked={getMultiEnumValue(def.key).includes(option)}
                disabled={def.isReadonly}
                onchange={(event) => toggleMultiEnum(def.key, option, (event.currentTarget as HTMLInputElement).checked)}
              />
              {option}
            </label>
          {/each}
        </div>
      {:else if def.fieldType === 'date'}
        <input
          class="input-base"
          type="date"
          value={getStringValue(def.key)}
          disabled={def.isReadonly}
          oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
        />
      {:else if ['ip', 'mac', 'hostname', 'cidr', 'regex'].includes(def.fieldType)}
        <input
          class="input-base"
          value={getStringValue(def.key)}
          placeholder={(def.fieldType in placeholderByType ? placeholderByType[def.fieldType as keyof typeof placeholderByType] : '') ?? ''}
          disabled={def.isReadonly}
          oninput={(event) => setValue(def.key, (event.currentTarget as HTMLInputElement).value)}
        />
      {:else if def.fieldType === 'port'}
        <input
          class="input-base"
          type="number"
          value={getNumberValue(def.key)}
          min={def.minValue ?? 1}
          max={def.maxValue ?? 65535}
          step={def.stepValue ?? 1}
          disabled={def.isReadonly}
          oninput={(event) => {
            const value = (event.currentTarget as HTMLInputElement).value;
            if (!value) {
              setValue(def.key, undefined);
              return;
            }
            const parsed = Number(value);
            setValue(def.key, Number.isNaN(parsed) ? undefined : parsed);
          }}
        />
      {:else if def.fieldType === 'json'}
        <textarea
          class="textarea-base"
          rows={4}
          value={getJsonDraftValue(def.key)}
          placeholder={placeholderByType.json}
          disabled={def.isReadonly}
          oninput={(event) => setJsonValue(def.key, (event.currentTarget as HTMLTextAreaElement).value)}
        ></textarea>
      {/if}

      {#if def.computedExpr}
        <p class="text-xs text-blue-600">Auto: {def.computedExpr}</p>
      {/if}
      {#if def.helpText}
        <p class="text-xs text-slate-500">{def.helpText}</p>
      {/if}
      {#if errors[def.key] || jsonErrors[def.key]}
        <p class="text-xs text-red-600">{errors[def.key] ?? jsonErrors[def.key]}</p>
      {/if}
    </div>
  {/each}
</div>
