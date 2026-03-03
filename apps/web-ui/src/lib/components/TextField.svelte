<script lang="ts">
  type Props = {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
    type?: 'text' | 'email' | 'tel' | 'number' | 'date';
    required?: boolean;
    disabled?: boolean;
    readonly?: boolean;
    error?: string;
    hint?: string;
    dataTestid?: string;
    onValueChange?: (value: string) => void;
  };

  let {
    id,
    label,
    value = $bindable(''),
    placeholder = '',
    type = 'text',
    required = false,
    disabled = false,
    readonly = false,
    error = '',
    hint = '',
    dataTestid,
    onValueChange
  }: Props = $props();
</script>

<div class="space-y-1">
  <label for={id} class="label-base" class:label-required={required}>
    {label}
  </label>
  <input
    {id}
    {type}
    bind:value
    {placeholder}
    {required}
    {disabled}
    {readonly}
    data-testid={dataTestid}
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
    oninput={(event) => onValueChange?.((event.currentTarget as HTMLInputElement).value)}
    class={`input-base ${error ? 'input-error' : ''} ${disabled ? 'input-disabled' : ''} ${readonly ? 'input-disabled' : ''}`}
  />
  {#if hint && !error}
    <p id="{id}-hint" class="field-hint">{hint}</p>
  {/if}
  {#if error}
    <p id="{id}-error" class="field-error" role="alert">
      <svg class="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>
      {error}
    </p>
  {/if}
</div>
