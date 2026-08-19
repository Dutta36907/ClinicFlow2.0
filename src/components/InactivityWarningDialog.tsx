import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function InactivityWarningDialog({
  open,
  secondsLeft,
  onStayActive,
}: {
  open: boolean;
  secondsLeft: number;
  onStayActive: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onStayActive()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            You've been inactive for a while. For your security, you'll be signed out in{" "}
            {secondsLeft}s.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onStayActive}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
