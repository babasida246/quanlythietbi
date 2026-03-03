<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
  type ButtonSize = 'sm' | 'md' | 'lg';

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    class?: string;
    leftIcon?: Snippet;
    rightIcon?: Snippet;
    children: Snippet;
    onclick?: (e: MouseEvent) => void;
    [key: string]: any;
  }

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    class: className = '',
    leftIcon,
    rightIcon,
    children,
    onclick,
    ...rest
  }: Props = $props();

  /* ── Ant-density dark-mode-first ── */
  const baseClasses = [
    'inline-flex items-center justify-center font-medium',
    'rounded transition-colors duration-150',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-1',
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none'
  ];

  const variantClasses = {
    primary: [
      'bg-primary text-white hover:bg-primary-hover active:bg-primary-active',
      'border border-transparent shadow-xs'
    ],
    secondary: [
      'bg-surface-3 text-slate-200 hover:bg-surface-3/80 active:bg-surface-2',
      'border border-slate-600'
    ],
    ghost: [
      'bg-transparent text-slate-300 hover:bg-surface-3/50 active:bg-surface-3',
      'border border-transparent'
    ],
    danger: [
      'bg-error text-white hover:bg-error-hover active:bg-error-active',
      'border border-transparent shadow-xs'
    ],
    link: [
      'bg-transparent text-primary hover:text-primary-hover active:text-primary-active',
      'border-0 p-0 h-auto font-normal underline-offset-4 hover:underline'
    ]
  };

  /* Ant Design density sizes: sm=28, md=32, lg=36 */
  const sizeClasses = $derived({
    sm: variant === 'link' ? 'text-xs' : 'h-7 px-2.5 text-xs gap-1.5',
    md: variant === 'link' ? 'text-sm' : 'h-8 px-3 text-sm gap-2',
    lg: variant === 'link' ? 'text-base' : 'h-9 px-4 text-sm gap-2'
  });

  const classes = $derived(cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  ));
</script>

<button
  {type}
  {disabled}
  class={classes}
  {onclick}
  {...rest}
>
  {#if leftIcon}
    {@render leftIcon()}
  {/if}
  {@render children()}
  {#if rightIcon}
    {@render rightIcon()}
  {/if}
</button>