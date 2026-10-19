import { useId, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Props a field hands to its control so label, description and error are wired up for a11y. */
export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  'aria-required': true | undefined;
}

interface FieldProps {
  /** Visible label text (already translated). */
  label: string;
  /** Optional hint below the control (already translated). */
  description?: string | undefined;
  /** Validation message (already translated); marks the control as invalid. */
  error?: string | undefined;
  required?: boolean;
  /** Element shown at the end of the label row, e.g. a "Passwort vergessen?" link. */
  labelAction?: ReactNode;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * Label + control + description + error. The control is rendered through a render prop so the
 * field can pass id, aria-invalid and aria-describedby (ids via useId) to any input component.
 */
function Field({
  label,
  description,
  error,
  required = false,
  labelAction,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy =
    [description ? descriptionId : undefined, error ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div data-slot="field" className={cn('grid gap-2', className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        'aria-required': required ? true : undefined,
      })}
      {description ? (
        <p id={descriptionId} className="text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field };
