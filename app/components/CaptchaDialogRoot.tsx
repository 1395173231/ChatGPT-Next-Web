import React, { ElementRef, useEffect, useRef, useState } from "react";
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
  const dialogRef = useRef<ElementRef<"div">>(null);

  useEffect(() => {
    if (!dialogRef.current) return;

    if (open) {
        // 回退方案：使用 div 模拟 dialog
        document.body.style.overflow = 'hidden';
        (dialogRef.current as HTMLDivElement).style.display = 'flex';
    } else {
        document.body.style.overflow = '';
        (dialogRef.current as HTMLDivElement).style.display = 'none';
    }
  }, [open]);

  // const DialogComponent =  'div';

  const content = (
    <div
      ref={dialogRef as any}
      className={`${styles["captcha-dialog"]} ${ styles["captcha-dialog-fallback"]}`}
    >
      <div className={styles["captcha-dialog-content"]}>
        <div className={styles["captcha-dialog-title"]}>
          {title ?? "验证"}
        </div>
        <div className={styles["captcha-dialog-body"]}>
          {open && children}
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
    </div>
  );

  return (
    <div className={styles["modal-overlay"]} style={{ display: open ? 'flex' : 'none' }}>
      {content}
    </div>
  );
};