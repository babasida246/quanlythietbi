<script lang="ts">
  export type SelectOption = {
    value: string;
    label: string;
  };

  type Props = {
    id: string;
    label: string;
    value?: string;
    options: SelectOption[];
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
    dataTestid?: string;
    onValueChange?: (value: string) => void;
  };

  let {
    id,
    label,
    value = $bindable(''),
    options = [],
    placeholder = '',
    required = false,
    disabled = false,
    error = '',
    dataTestid,
    onValueChange
  }: Props = $props();
</script>

<div class="space-y-1">
  <label for={id} class="label-base" class:label-required={required}>
    {label}
  </label>
  <select
    {id}
    bind:value
    {required}
    {disabled}
    data-testid={dataTestid}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : undefined}
    onchange={(event) => onValueChange?.((event.currentTarget as HTMLSelectElement).value)}
    class={`select-base ${error ? 'input-error' : ''} ${disabled ? 'input-disabled' : ''}`}
  >
    {#if placeholder}
      <option value="" class="text-slate-500">{placeholder}</option>
    {/if}
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if error}
    <p id="{id}-error" class="field-error" role="alert">
      <svg class="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>
      {error}
    </p>
  {/if}
</div>
