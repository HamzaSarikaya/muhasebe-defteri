import {Slot} from '@radix-ui/react-slot';
import {cva, type VariantProps} from 'class-variance-authority';
import type {ComponentProps} from 'react';
import {cn} from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {variants: {variant: {
    default: 'bg-accent text-white hover:bg-blue-500',
    outline: 'border border-input bg-surface text-primary hover:bg-surface-hover',
    ghost: 'text-secondary hover:bg-surface-hover hover:text-primary'
  }}, defaultVariants: {variant: 'default'}}
);

export function Button({className, variant, asChild = false, type, ...props}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & {asChild?: boolean}) {
  const Component = asChild ? Slot : 'button';
  return <Component data-slot="button" type={asChild ? undefined : (type ?? 'button')} className={cn(buttonVariants({variant}), className)} {...props} />;
}
