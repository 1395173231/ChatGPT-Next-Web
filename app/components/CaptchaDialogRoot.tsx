import React, { useRef } from "react";
import styles from "./CaptchaDialogRoot.module.scss";

interface CaptchaProps {
  title?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CaptchaDialogRoot: React.FC<CaptchaProps> = ({
                                                            children,
                                                            title,
                                                            footer,
                                                            open,
                                                            onOpenChange
                                                          }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles["captcha-dialog"]}
      onClose={() => onOpenChange(false)}
    >
      <div className={styles["captcha-dialog-content"]}>
        <div className={styles["captcha-dialog-title"]}>
          {title ?? "验证"}
        </div>
        <div className={styles["captcha-dialog-body"]}>
          {open&&children}
        </div>
        <div className={styles["captcha-dialog-footer"]}>
          {footer}
        </div>
      </div>
      <button
        onClick={() => onOpenChange(false)}
        className={styles["captcha-dialog-close"]}
      >
        ×
      </button>
    </dialog>
  );
};
