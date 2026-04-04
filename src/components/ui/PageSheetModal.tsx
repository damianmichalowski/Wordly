import type { ReactNode } from "react";
import { Modal, Platform, type ModalProps } from "react-native";

export type PageSheetModalProps = Omit<
  ModalProps,
  "animationType" | "presentationStyle"
> & {
  children: ReactNode;
};

/**
 * Natywny **sheet** na iOS (`UIModalPresentationPageSheet`): przeciągnięcie w dół
 * zamyka modal tak jak w Hubie przy opisie sesji. Na Androidzie zwykły modal pełnoekranowy (slide).
 */
export function PageSheetModal({ children, ...rest }: PageSheetModalProps) {
  return (
    <Modal
      {...rest}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
    >
      {children}
    </Modal>
  );
}
