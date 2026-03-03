<script lang="ts">
  type Props = {
    id: string;
    label: string;
    value?: string;
    placeholder?: string;
    rows?: number;
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
    placeholder = '',
    rows = 3,
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
  <textarea
    {id}
    bind:value
    {rows}
    {placeholder}
    {required}
    {disabled}
    data-testid={dataTestid}
    oninput={(event) => onValueChange?.((event.currentTarget as HTMLTextAreaElement).value)}
    class={`textarea-base ${error ? 'input-error' : ''} ${disabled ? 'input-disabled' : ''}`}
  ></textarea>
  {#if error}
    <p class="field-error">{error}</p>
  {/if}
</div>
