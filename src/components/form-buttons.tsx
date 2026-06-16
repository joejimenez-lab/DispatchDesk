"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingText?: string;
};

export function SubmitButton({ children, pendingText = "Saving...", disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

type ConfirmSubmitButtonProps = SubmitButtonProps & {
  message: string;
};

export function ConfirmSubmitButton({
  children,
  message,
  pendingText = "Deleting...",
  disabled,
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      {...props}
    >
      {pending ? pendingText : children}
    </Button>
  );
}
