<script lang="ts">
  /**
   * BarcodeScanner - Keyboard-wedge barcode/QR scanner input.
   * Listens for rapid keystrokes (typical of barcode scanners) and
   * emits the scanned code. Also works as a manual input field.
   */
  import { ScanLine } from 'lucide-svelte';

  interface Props {
    placeholder?: string;
    onScan: (code: string) => void;
  }

  let { placeholder = 'Quet ma vach / nhap ma...', onScan }: Props = $props();

  let inputValue = $state('');
  let lastKeyTime = $state(0);
  let buffer = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  const SCANNER_THRESHOLD_MS = 50; // barcode scanners type faster than humans
  const MIN_SCAN_LENGTH = 3;

  function handleKeydown(e: KeyboardEvent) {
    const now = Date.now();
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = (buffer.length >= MIN_SCAN_LENGTH ? buffer : inputValue).trim();
      if (code) {
        onScan(code);
        inputValue = '';
        buffer = '';
      }
      return;
    }
    if (e.key.length === 1) {
      if (now - lastKeyTime < SCANNER_THRESHOLD_MS) {
        buffer += e.key;
      } else {
        buffer = e.key;
      }
      lastKeyTime = now;
    }
  }

  function handleSubmit() {
    const code = inputValue.trim();
    if (code) {
      onScan(code);
      inputValue = '';
      buffer = '';
    }
  }
</script>

<div class="flex gap-2 items-center">
  <div class="relative flex-1">
    <ScanLine class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
    <input
      bind:this={inputEl}
      bind:value={inputValue}
      type="text"
      class="input-base pl-9"
      {placeholder}
      data-testid="barcode-input"
      onkeydown={handleKeydown}
    />
  </div>
  <button
    type="button"
    class="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90"
    data-testid="barcode-submit"
    onclick={handleSubmit}
  >
    Tim
  </button>
</div>
